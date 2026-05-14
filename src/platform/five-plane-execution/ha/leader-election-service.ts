/**
 * @fileoverview Leader Election Service
 *
 * Provides:
 * - Lease-based leader election using HaCoordinatorService
 * - Periodic lease renewal loop while node holds leadership
 * - Graceful leader abdication on shutdown
 * - Leader stickiness (prefer current leader to reduce churn)
 * - HA level-aware behavior
 *
 * HA Level Behavior:
 * - HA-1: No lease needed (single-node mode)
 * - HA-2: Basic lease with renewal every 5s
 * - HA-3: Aggressive renewal every 3s + cross-region failover
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 */

import { EventEmitter } from "node:events";

import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { RuntimeError } from "../../contracts/errors.js";
import type { HaLevel, HaLevelConfig, LeadershipQueryResult } from "./types.js";
import { HA_LEVEL_CONFIGS, type LeaderLease } from "./types.js";
import type { HaCoordinatorService } from "./ha-coordinator-service-inner.js";

// ── Logger ─────────────────────────────────────────────────────────

const logger = new StructuredLogger({ retentionLimit: 200 });

// ── Service Interface ───────────────────────────────────────────────

/**
 * Leader election state machine states.
 */
export type LeaderElectionState =
  | "stopped"
  | "starting"
  | "candidate"
  | "follower"
  | "leader"
  | "shutdown";

/**
 * Leader election event types for observability.
 */
export type LeaderElectionEvent =
  | "election_start"
  | "leadership_acquired"
  | "leadership_lost"
  | "leadership_renewed"
  | "leadership_expired"
  | "failover_triggered"
  | "abdication"
  | "follower_elected";

/**
 * Leader election service options.
 */
export interface LeaderElectionServiceOptions {
  /** Node ID for this coordinator node */
  nodeId: string;
  /** Region identifier for this node */
  region: string;
  /** HA level (defaults to HA_2) */
  haLevel?: HaLevel;
  /** Custom HA config (overrides haLevel defaults) */
  haConfig?: Partial<HaLevelConfig>;
  /** TTL for leadership lease in milliseconds */
  leaseTtlMs?: number;
  /** Interval for renewal attempts (derived from HA level if not specified) */
  renewalIntervalMs?: number;
  /** Maximum number of election attempts before giving up */
  maxElectionAttempts?: number;
  /** Metadata to attach to this node */
  nodeMetadata?: Record<string, unknown>;
}

/**
 * Leader election service for HA coordination.
 *
 * Manages the lifecycle of leadership acquisition, renewal, and release.
 * Uses a state machine to track election progress and handles graceful
 * transitions between leader and follower roles.
 */
export class LeaderElectionService extends EventEmitter {
  // State
  private state: LeaderElectionState = "stopped";
  private currentLease: LeaderLease | null = null;
  private currentEpoch: number = 0;
  private currentFencingToken: number = 0;
  private electionAttempts: number = 0;
  private renewalIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private heartbeatIntervalHandle: ReturnType<typeof setInterval> | null = null;
  private disposed: boolean = false;

  // Config
  private readonly config: HaLevelConfig;
  private readonly haLevel: HaLevel;
  private readonly effectiveNodeId: string;
  private readonly effectiveRegion: string;
  private readonly maxElectionAttempts: number;
  private readonly nodeMetadata: Record<string, unknown>;

  // Dependencies
  private readonly coordinator: HaCoordinatorService;

  // Observability
  private readonly electionId: string;

  constructor(coordinator: HaCoordinatorService, options: LeaderElectionServiceOptions) {
    super();
    this.coordinator = coordinator;
    this.effectiveNodeId = options.nodeId;
    this.effectiveRegion = options.region;
    this.nodeMetadata = options.nodeMetadata ?? {};

    // Determine effective HA config
    this.haLevel = options.haLevel ?? "HA_2";
    const baseConfig = HA_LEVEL_CONFIGS[this.haLevel];
    this.config = {
      ...baseConfig,
      ...options.haConfig,
      leaseTtlMs: options.leaseTtlMs ?? options.haConfig?.leaseTtlMs ?? baseConfig.leaseTtlMs,
      leaseRenewalIntervalMs:
        options.renewalIntervalMs ?? options.haConfig?.leaseRenewalIntervalMs ?? baseConfig.leaseRenewalIntervalMs,
    };

    this.maxElectionAttempts = options.maxElectionAttempts ?? 5;
    this.electionId = newId("election");

    logger.log({
      level: "info",
      message: "leader_election.service_created",
      data: {
        nodeId: this.effectiveNodeId,
        region: this.effectiveRegion,
        haLevel: this.haLevel,
        config: this.config,
      },
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Starts the leader election process.
   * Registers the node and begins attempting to acquire leadership.
   */
  public async start(): Promise<void> {
    if (this.disposed) {
      throw new RuntimeError(
        "leader_election.disposed",
        "Cannot start disposed leader election service",
      );
    }

    if (this.state !== "stopped") {
      logger.log({
        level: "warn",
        message: "leader_election.already_started",
        data: { state: this.state },
      });
      return;
    }

    this.state = "starting";
    this.emitEvent("election_start", { nodeId: this.effectiveNodeId });

    try {
      // Register this node with the coordinator
      this.registerNode();

      // For HA-1, skip leader election (single-node mode)
      if (this.config.haLevel === "HA_1") {
        const acquiredAt = nowIso();
        this.currentEpoch = Math.max(this.currentEpoch, 1);
        this.currentFencingToken = Math.max(this.currentFencingToken, 1);
        this.currentLease = {
          leaseId: `single-node-${this.effectiveNodeId}`,
          nodeId: this.effectiveNodeId,
          epoch: this.currentEpoch,
          acquiredAt,
          expiresAt: new Date(Date.now() + this.config.leaseTtlMs).toISOString(),
          status: "active",
          ttlMs: this.config.leaseTtlMs,
        };
        this.state = "leader";
        this.emitEvent("leadership_acquired", {
          nodeId: this.effectiveNodeId,
          isSingleNode: true,
        });
        return;
      }

      // Start heartbeat to keep node alive
      this.startHeartbeat();

      // Attempt initial leadership acquisition
      await this.attemptElection();

    } catch (error) {
      this.state = "stopped";
      logger.log({
        level: "error",
        message: "leader_election.start_failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      throw error;
    }
  }

  /**
   * Stops the leader election service gracefully.
   * Releases leadership if held and stops all background tasks.
   */
  public async stop(): Promise<void> {
    if (this.disposed || this.state === "stopped" || this.state === "shutdown") {
      return;
    }

    const previousState = this.state;
    this.state = "shutdown";

    // Stop background tasks
    this.stopRenewalLoop();
    this.stopHeartbeat();

    // Release leadership if we hold it
    if (previousState === "leader" && this.currentLease) {
      try {
        await this.releaseLeadership();
        this.emitEvent("abdication", { nodeId: this.effectiveNodeId });
      } catch (error) {
        logger.log({
          level: "error",
          message: "leader_election.abdication_failed",
          data: { error: error instanceof Error ? error.message : String(error) },
        });
      }
    }

    this.state = "stopped";
    logger.log({
      level: "info",
      message: "leader_election.service_stopped",
      data: { nodeId: this.effectiveNodeId },
    });
  }

  /**
   * Disposes of the service and releases all resources.
   */
  public dispose(): void {
    this.stopRenewalLoop();
    this.stopHeartbeat();
    this.disposed = true;
    this.state = "stopped";
    this.currentLease = null;
  }

  /**
   * Returns the current leader election state.
   */
  public getState(): LeaderElectionState {
    return this.state;
  }

  /**
   * Returns the current leadership status.
   */
  public isLeader(): boolean {
    return this.state === "leader";
  }

  public isFollower(): boolean {
    return this.state === "follower";
  }

  public hasLeadership(): boolean {
    return this.state === "leader" && this.currentLease !== null;
  }

  public getLeaseInfo(): LeaderLease | null {
    return this.currentLease;
  }

  public getNodeId(): string {
    return this.effectiveNodeId;
  }

  public getRegion(): string {
    return this.effectiveRegion;
  }

  public getHaLevel(): HaLevel {
    return this.haLevel;
  }

  public getConfig(): HaLevelConfig {
    return this.getHaConfig();
  }

  public getFencingToken(): number {
    return this.currentFencingToken;
  }

  /**
   * Returns the current leader node ID, or null if no leader.
   */
  public getLeaderNodeId(): string | null {
    if (this.config.haLevel === "HA_1") {
      return this.state === "leader" ? this.effectiveNodeId : null;
    }
    const leader = typeof (this.coordinator as any).getCurrentLeader === "function"
      ? (this.coordinator as any).getCurrentLeader()
      : null;
    return leader?.nodeId ?? null;
  }

  /**
   * Returns whether this node is the current leader.
   */
  public isCurrentLeader(): boolean {
    if (this.config.haLevel === "HA_1") {
      return this.state === "leader";
    }
    const leadership = this.queryLeadership();
    return this.state === "leader"
      && !(leadership instanceof Promise)
      && leadership.isLeader;
  }

  /**
   * Returns the current lease information if this node is leader.
   */
  public getCurrentLease(): LeaderLease | null {
    return this.currentLease;
  }

  /**
   * Returns the current leadership query result.
   */
  public queryLeadership(): LeadershipQueryResult | Promise<LeadershipQueryResult> {
    if (this.config.haLevel === "HA_1") {
      return {
        isLeader: this.state === "leader",
        leaderNodeId: this.state === "leader" ? this.effectiveNodeId : null,
        epoch: this.currentEpoch,
        fencingToken: this.currentFencingToken,
        expiresAt: this.currentLease?.expiresAt ?? null,
        isExpired: this.state !== "leader",
      };
    }
    return this.queryLeadershipCompat();
  }

  /**
   * Returns the HA level configuration in use.
   */
  public getHaConfig(): HaLevelConfig {
    return { ...this.config };
  }

  /**
   * Manually triggers a leadership transfer to another node.
   * Only works if this node is currently leader.
   */
  public async transferLeadership(targetNodeId: string): Promise<boolean> {
    if (!this.isCurrentLeader()) {
      return false;
    }

    try {
      await this.releaseLeadership();
      // The target node should now be able to acquire leadership
      this.emitEvent("leadership_lost", { nodeId: this.effectiveNodeId, cause: "transfer" });
      return true;
    } catch (error) {
      logger.log({
        level: "error",
        message: "leader_election.transfer_failed",
        data: { targetNodeId, error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  /**
   * Forces this node to attempt to become leader, preempting any existing leader.
   */
  public async forceAcquireLeadership(): Promise<boolean> {
    if (this.state === "shutdown" || this.disposed) {
      return false;
    }

    try {
      const result = await this.acquireLeadershipCompat(true);

      if (result.acquired) {
        this.currentLease = result.lease;
        this.currentEpoch = result.epoch;
        this.currentFencingToken = result.fencingToken;
        this.state = "leader";
        this.electionAttempts = 0;
        this.startRenewalLoop();
        this.emitEvent("leadership_acquired", {
          nodeId: this.effectiveNodeId,
          preempted: true,
        });
        return true;
      }

      return false;
    } catch (error) {
      logger.log({
        level: "error",
        message: "leader_election.force_acquire_failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
      return false;
    }
  }

  // ── Private Methods ───────────────────────────────────────────────

  /**
   * Attempts to acquire leadership.
   * Implements leader stickiness to reduce unnecessary failovers.
   */
  private async attemptElection(): Promise<void> {
    if (this.state === "shutdown" || this.disposed) {
      return;
    }

    this.state = "candidate";
    this.electionAttempts++;

    // Check if there's already a valid leader
    const leadership = await this.queryLeadershipCompat();

    if (leadership.isLeader && leadership.leaderNodeId) {
      // There's an active leader - check if it's us or if we should defer
      if (leadership.leaderNodeId === this.effectiveNodeId) {
        // We're already the leader (lease might have been refreshed)
        this.state = "leader";
        this.currentLease = typeof (this.coordinator as any).getActiveLease === "function"
          ? (this.coordinator as any).getActiveLease()
          : this.currentLease;
        this.currentEpoch = leadership.epoch;
        this.currentFencingToken = leadership.fencingToken;
        this.electionAttempts = 0;
        this.startRenewalLoop();
        this.emitEvent("leadership_acquired", { nodeId: this.effectiveNodeId, renewed: true });
        return;
      }

      // Another node is leader - check lease expiration
      if (!leadership.isExpired) {
        // Leader has valid lease, become follower
        this.state = "follower";
        this.emitEvent("follower_elected", { leaderNodeId: leadership.leaderNodeId });
        return;
      }
    }

    // Try to acquire leadership
    try {
      const result = await this.acquireLeadershipCompat(false);

      if (result.acquired) {
        this.currentLease = result.lease;
        this.currentEpoch = result.epoch;
        this.currentFencingToken = result.fencingToken;
        this.state = "leader";
        this.electionAttempts = 0;
        this.startRenewalLoop();
        this.emitEvent("leadership_acquired", { nodeId: this.effectiveNodeId });
      } else {
        // Failed to acquire - become follower
        this.state = "follower";
        this.emitEvent("follower_elected", {
          leaderNodeId: leadership.leaderNodeId,
          cause: result.cause,
        });

        // Schedule retry if we haven't exhausted attempts
        if (this.electionAttempts < this.maxElectionAttempts) {
          setTimeout(() => {
            if (this.state === "follower" && !this.disposed) {
              void this.attemptElection();
            }
          }, this.config.leaseRenewalIntervalMs);
        }
      }
    } catch (error) {
      logger.log({
        level: "error",
        message: "leader_election.attempt_failed",
        data: { attempt: this.electionAttempts, error: error instanceof Error ? error.message : String(error) },
      });

      this.state = "follower";

      if (this.electionAttempts < this.maxElectionAttempts) {
        setTimeout(() => {
          if (this.state === "follower" && !this.disposed) {
            void this.attemptElection();
          }
        }, this.config.leaseRenewalIntervalMs);
      }
    }
  }

  /**
   * Releases leadership gracefully.
   */
  private async releaseLeadership(): Promise<void> {
    this.stopRenewalLoop();

    const released = await this.releaseLeadershipCompat();
    if (released) {
      this.emitEvent("leadership_lost", { nodeId: this.effectiveNodeId, cause: "voluntary" });
    }

    this.currentLease = null;
    this.state = "follower";
  }

  /**
   * Starts the lease renewal loop.
   */
  private startRenewalLoop(): void {
    if (this.renewalIntervalHandle !== null) {
      return; // Already running
    }

    if (this.config.leaseRenewalIntervalMs <= 0) {
      return; // Renewal not needed (HA-1)
    }

    this.renewalIntervalHandle = setInterval(() => {
      this.renewLeadership();
    }, this.config.leaseRenewalIntervalMs);
    this.renewalIntervalHandle.unref?.();

    logger.log({
      level: "debug",
      message: "leader_election.renewal_loop_started",
      data: {
        intervalMs: this.config.leaseRenewalIntervalMs,
        leaseTtlMs: this.config.leaseTtlMs,
      },
    });
  }

  /**
   * Stops the lease renewal loop.
   */
  private stopRenewalLoop(): void {
    if (this.renewalIntervalHandle !== null) {
      clearInterval(this.renewalIntervalHandle);
      this.renewalIntervalHandle = null;
    }
  }

  /**
   * Starts the node heartbeat.
   */
  private startHeartbeat(): void {
    if (this.heartbeatIntervalHandle !== null) {
      return;
    }

    // Heartbeat every 5 seconds
    this.heartbeatIntervalHandle = setInterval(() => {
      if (typeof (this.coordinator as any).updateNodeHeartbeat === "function") {
        (this.coordinator as any).updateNodeHeartbeat(this.effectiveNodeId, "active");
      }
    }, 5_000);
    this.heartbeatIntervalHandle.unref?.();
  }

  /**
   * Stops the node heartbeat.
   */
  private stopHeartbeat(): void {
    if (this.heartbeatIntervalHandle !== null) {
      clearInterval(this.heartbeatIntervalHandle);
      this.heartbeatIntervalHandle = null;
    }
  }

  /**
   * Renews the leadership lease.
   */
  private renewLeadership(): void {
    if (this.state !== "leader" || this.disposed) {
      this.stopRenewalLoop();
      return;
    }

    try {
      const result = this.renewLeadershipCompat();

      if (result.renewed) {
        this.currentLease = result.lease;
        this.emitEvent("leadership_renewed", {
          nodeId: this.effectiveNodeId,
          fencingToken: result.fencingToken,
        });
      } else {
        // Lease renewal failed - we may have lost leadership
        logger.log({
          level: "warn",
          message: "leader_election.renewal_failed",
          data: { nodeId: this.effectiveNodeId },
        });
        this.state = "follower";
        this.currentLease = null;
        this.emitEvent("leadership_expired", { nodeId: this.effectiveNodeId });
        this.stopRenewalLoop();

        // Try to re-acquire
        if (this.electionAttempts < this.maxElectionAttempts) {
          setTimeout(() => {
            if (this.state === "follower" && !this.disposed) {
              void this.attemptElection();
            }
          }, this.config.leaseRenewalIntervalMs);
        }
      }
    } catch (error) {
      logger.log({
        level: "error",
        message: "leader_election.renewal_error",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }
  }

  /**
   * Emits an election event for observability.
   */
  private emitEvent(event: LeaderElectionEvent, data: Record<string, unknown> = {}): void {
    this.emit(event, data);
    logger.log({
      level: "info",
      message: `leader_election.${event}`,
      data: {
        electionId: this.electionId,
        nodeId: this.effectiveNodeId,
        region: this.effectiveRegion,
        state: this.state,
        ...data,
      },
    });
  }

  private registerNode(): void {
    if (typeof (this.coordinator as any).registerNode !== "function") {
      return;
    }
    (this.coordinator as any).registerNode(
      this.effectiveNodeId,
      this.effectiveRegion,
      this.nodeMetadata,
    );
  }

  private async queryLeadershipCompat(): Promise<LeadershipQueryResult> {
    const query = (this.coordinator as any).queryLeadership;
    if (typeof query !== "function") {
      return {
        isLeader: false,
        leaderNodeId: null,
        epoch: 0,
        fencingToken: 0,
        expiresAt: null,
        isExpired: false,
      };
    }
    const result = query.length >= 1
      ? query.call(this.coordinator, this.effectiveNodeId)
      : query.call(this.coordinator);
    return await Promise.resolve(result);
  }

  private async acquireLeadershipCompat(forceAcquire: boolean): Promise<{
    acquired: boolean;
    lease: LeaderLease;
    epoch: number;
    fencingToken: number;
    cause?: string;
  }> {
    const acquire = (this.coordinator as any).acquireLeadership;
    const usesObjectInput = typeof (this.coordinator as any).getCurrentLeader === "function";
    const result = !usesObjectInput
      ? acquire.call(this.coordinator, this.effectiveNodeId, this.config.leaseTtlMs)
      : acquire.call(this.coordinator, {
          nodeId: this.effectiveNodeId,
          ttlMs: this.config.leaseTtlMs,
          forceAcquire,
        });
    const resolved = await Promise.resolve(result);
    if (resolved?.acquired !== undefined) {
      return resolved;
    }
    return {
      acquired: resolved != null,
      lease: resolved,
      epoch: resolved?.epoch ?? 0,
      fencingToken: resolved?.fencingToken ?? 1,
    };
  }

  private renewLeadershipCompat(): {
    renewed: boolean;
    lease: LeaderLease | null;
    fencingToken: number;
  } {
    const renew = (this.coordinator as any).renewLeadership;
    if (typeof renew !== "function") {
      return { renewed: false, lease: null, fencingToken: this.currentFencingToken };
    }
    const usesObjectInput = typeof (this.coordinator as any).getActiveLease === "function";
    const result = !usesObjectInput
      ? renew.call(this.coordinator, this.effectiveNodeId, this.currentLease?.leaseId)
      : renew.call(this.coordinator, {
          nodeId: this.effectiveNodeId,
          ttlMs: this.config.leaseTtlMs,
        });
    if (result?.renewed !== undefined) {
      return result;
    }
    return {
      renewed: result != null,
      lease: result ?? null,
      fencingToken: result?.fencingToken ?? this.currentFencingToken,
    };
  }

  private async releaseLeadershipCompat(): Promise<boolean> {
    const release = (this.coordinator as any).releaseLeadership;
    if (typeof release !== "function") {
      return false;
    }
    const result = release.length >= 1
      ? release.call(this.coordinator, this.effectiveNodeId, this.currentLease?.leaseId)
      : release.call(this.coordinator, this.effectiveNodeId);
    const resolved = await Promise.resolve(result);
    return resolved === undefined ? true : Boolean(resolved);
  }
}

// ── Factory ─────────────────────────────────────────────────────────

export interface HaLevelConfigurable {
  haLevel: HaLevel;
  customConfig?: Partial<HaLevelConfig>;
}

/**
 * Creates a LeaderElectionService with HA-level-appropriate defaults.
 */
export function createLeaderElectionService(
  coordinator: HaCoordinatorService,
  nodeId: string,
  region: string,
  config?: HaLevelConfigurable & { nodeMetadata?: Record<string, unknown> },
): LeaderElectionService {
  const options: LeaderElectionServiceOptions = {
    nodeId,
    region,
    haLevel: config?.haLevel ?? "HA_2",
  };
  if (config?.customConfig) {
    options.haConfig = config.customConfig;
  }
  if (config?.nodeMetadata) {
    options.nodeMetadata = config.nodeMetadata;
  }
  return new LeaderElectionService(coordinator, options);
}
