/**
 * @fileoverview Lease Reclaimer Service
 *
 * Background worker that:
 * - Scans for expired leadership leases
 * - Marks expired leases as "expired" status
 * - Triggers failover when leader's lease expires
 * - Integrates with HA level configurations
 *
 * @see docs_zh/contracts/ha_coordinator_and_leader_election_contract.md
 */

import { nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type {
  HaLevel,
  HaLevelConfig,
  LeaseReclaimResult,
  LeaseReclaimerConfig,
  LeaderLease,
} from "./types.js";
import { HA_LEVEL_CONFIGS, type CoordinatorNode, type FailoverDecision } from "./types.js";
import type { HaCoordinatorService } from "./ha-coordinator-service-inner.js";

// ── Logger ─────────────────────────────────────────────────────────

const logger = new StructuredLogger({ retentionLimit: 200 });

// ── Default Configuration ─────────────────────────────────────────

const DEFAULT_GRACE_PERIOD_MS = 2_000;
const DEFAULT_RECLAIM_INTERVAL_MS = 10_000;

/**
 * Options for creating a LeaseReclaimerService.
 */
export interface LeaseReclaimerServiceOptions {
  /** Coordinator service for lease management */
  coordinator: HaCoordinatorService;
  /** HA level (determines default intervals) */
  haLevel?: HaLevel;
  /** Override configuration */
  config?: Partial<LeaseReclaimerConfig>;
  /** Callback when failover is triggered */
  onFailover?: (decision: FailoverDecision) => void;
  /** Callback when lease is reclaimed */
  onLeaseReclaimed?: (lease: LeaderLease, node: CoordinatorNode | null) => void;
}

/**
 * Lease Reclaimer Service
 *
 * Periodically scans for expired leases and triggers appropriate recovery actions.
 * Works in conjunction with the LeaderElectionService to ensure proper failover
 * when leadership is lost.
 */
export class LeaseReclaimerService {
  private intervalHandle: ReturnType<typeof setTimeout> | null = null;
  private disposed: boolean = false;
  private running: boolean = false;

  private readonly config: Required<LeaseReclaimerConfig>;
  private readonly coordinator: HaCoordinatorService;
  private readonly onFailover: ((decision: FailoverDecision) => void) | undefined;
  private readonly onLeaseReclaimed: ((lease: LeaderLease, node: CoordinatorNode | null) => void) | undefined;
  private readonly nodeId: string;

  constructor(options: LeaseReclaimerServiceOptions) {
    this.coordinator = options.coordinator;
    this.onFailover = options.onFailover ?? undefined;
    this.onLeaseReclaimed = options.onLeaseReclaimed ?? undefined;

    // Determine node ID from coordinator (we need a node ID for the reclaimer itself)
    // The reclaimer operates at the coordinator level, not as a node
    this.nodeId = `lease-reclaimer-${nowIso()}`;

    // Build config with defaults
    const haLevel = options.haLevel ?? "HA_2";
    const haDefaults = HA_LEVEL_CONFIGS[haLevel];

    this.config = {
      reclaimIntervalMs: options.config?.reclaimIntervalMs ?? haDefaults.leaseReclaimerIntervalMs,
      gracePeriodMs: options.config?.gracePeriodMs ?? DEFAULT_GRACE_PERIOD_MS,
      autoFailover: options.config?.autoFailover ?? true,
    };

    // Validate
    if (this.config.reclaimIntervalMs <= 0) {
      logger.log({
        level: "warn",
        message: "lease_reclaimer.disabled",
        data: { reason: "reclaimIntervalMs is 0", haLevel },
      });
    }

    logger.log({
      level: "info",
      message: "lease_reclaimer.service_created",
      data: {
        haLevel,
        config: this.config,
      },
    });
  }

  // ── Public API ────────────────────────────────────────────────────

  /**
   * Starts the lease reclaimer background process.
   */
  public start(): void {
    if (this.disposed) {
      throw new Error("Cannot start disposed LeaseReclaimerService");
    }

    if (this.running) {
      return;
    }

    if (this.config.reclaimIntervalMs <= 0) {
      logger.log({
        level: "info",
        message: "lease_reclaimer.not_started",
        data: { reason: "disabled by config" },
      });
      return;
    }

    this.running = true;
    this.scheduleNextReclaim();

    logger.log({
      level: "info",
      message: "lease_reclaimer.started",
      data: { intervalMs: this.config.reclaimIntervalMs },
    });
  }

  /**
   * Stops the lease reclaimer background process.
   */
  public stop(): void {
    this.running = false;
    if (this.intervalHandle !== null) {
      clearTimeout(this.intervalHandle);
      this.intervalHandle = null;
    }

    logger.log({
      level: "info",
      message: "lease_reclaimer.stopped",
    });
  }

  /**
   * Disposes of the service.
   */
  public dispose(): void {
    this.stop();
    this.disposed = true;
  }

  /**
   * Triggers an immediate reclaim cycle.
   * Returns the result of the reclamation.
   */
  public async reclaimOnce(): Promise<LeaseReclaimResult> {
    return this.doReclaimCycle();
  }

  /**
   * Returns the current configuration.
   */
  public getConfig(): Readonly<LeaseReclaimerConfig> {
    return { ...this.config };
  }

  /**
   * Returns whether the service is currently running.
   */
  public isRunning(): boolean {
    return this.running && !this.disposed;
  }

  // ── Private Methods ───────────────────────────────────────────────

  /**
   * Schedules the next reclaim cycle.
   */
  private scheduleNextReclaim(): void {
    if (!this.running || this.disposed) {
      return;
    }

    this.intervalHandle = setTimeout(async () => {
      await this.doReclaimCycle();
      this.scheduleNextReclaim();
    }, this.config.reclaimIntervalMs);
  }

  /**
   * Performs a single reclaim cycle.
   */
  private async doReclaimCycle(): Promise<LeaseReclaimResult> {
    const startTime = Date.now();
    const result: LeaseReclaimResult = {
      reclaimedCount: 0,
      failoverTriggered: false,
      failedNodeIds: [],
    };

    if (!this.running || this.disposed) {
      return result;
    }

    try {
      // Get all expired leases
      const expiredLeases = this.getExpiredLeases();

      for (const lease of expiredLeases) {
        try {
          // Check if past grace period
          const expiredAt = new Date(lease.expiresAt).getTime();
          const now = Date.now();
          const graceExpired = now >= expiredAt + this.config.gracePeriodMs;

          if (!graceExpired) {
            // Still within grace period, skip
            continue;
          }

          // Mark lease as expired
          await this.expireLease(lease);

          // Get the node for logging
          const node = this.coordinator.getNode(lease.nodeId);

          // Notify callback
          this.onLeaseReclaimed?.(lease, node);

          result.reclaimedCount++;

          // Check if this was the leader's lease
          if (node?.isLeader) {
            logger.log({
              level: "warn",
              message: "lease_reclaimer.leader_lease_expired",
              data: {
                leaseId: lease.leaseId,
                nodeId: lease.nodeId,
                epoch: lease.epoch,
              },
            });

            // Trigger failover if auto-failover is enabled
            if (this.config.autoFailover) {
              const decision = await this.triggerFailover(lease.nodeId);
              if (decision.outcome === "leader_changed") {
                result.failoverTriggered = true;
              }
            }
          }
        } catch (error) {
          result.failedNodeIds.push(lease.nodeId);
          logger.log({
            level: "error",
            message: "lease_reclaimer.reclaim_failed",
            data: {
              leaseId: lease.leaseId,
              nodeId: lease.nodeId,
              error: error instanceof Error ? error.message : String(error),
            },
          });
        }
      }

      // Also check for stale nodes and mark their leases as expired
      const staleNodes = await this.getStaleNodes();
      for (const node of staleNodes) {
        // Check if this stale node was the leader using queryLeadership
        const leadership = this.coordinator.queryLeadership();
        if (node.isLeader && leadership.isExpired && leadership.leaderNodeId === node.nodeId) {
          // This node was the leader and its lease has expired
          try {
            await this.expireLeaseForNode(node.nodeId);
            result.reclaimedCount++;

            if (node.isLeader) {
              if (this.config.autoFailover) {
                const decision = await this.triggerFailover(node.nodeId);
                if (decision.outcome === "leader_changed") {
                  result.failoverTriggered = true;
                }
              }
            }
          } catch (error) {
            result.failedNodeIds.push(node.nodeId);
          }
        }
      }

    } catch (error) {
      logger.log({
        level: "error",
        message: "lease_reclaimer.cycle_failed",
        data: { error: error instanceof Error ? error.message : String(error) },
      });
    }

    const durationMs = Date.now() - startTime;
    if (result.reclaimedCount > 0 || result.failoverTriggered) {
      logger.log({
        level: "info",
        message: "lease_reclaimer.cycle_complete",
        data: {
          reclaimedCount: result.reclaimedCount,
          failoverTriggered: result.failoverTriggered,
          durationMs,
        },
      });
    }

    return result;
  }

  /**
   * Gets expired leases from the coordinator.
   */
  private getExpiredLeases(): LeaderLease[] {
    // Use the coordinator's method to detect expired leadership
    const leadership = this.coordinator.queryLeadership();
    if (leadership.isExpired && leadership.leaderNodeId) {
      // The current lease is expired - get the active lease which should be null
      const activeLease = this.coordinator.getActiveLease();
      if (!activeLease) {
        // No active lease means the leader's lease is expired
        // Return empty - actual implementation would query DB for expired leases
        return [];
      }
      return [activeLease];
    }
    return [];
  }

  /**
   * Gets nodes that have missed heartbeats.
   */
  private async getStaleNodes(): Promise<CoordinatorNode[]> {
    // For stale detection, we'd query nodes with lastHeartbeatAt older than threshold
    // This would be implemented via the repository
    return [];
  }

  /**
   * Expires a specific lease.
   */
  private async expireLease(lease: LeaderLease): Promise<void> {
    // Update lease status to expired
    // This would call the repository directly in a full implementation
    logger.log({
      level: "debug",
      message: "lease_reclaimer.expiring_lease",
      data: {
        leaseId: lease.leaseId,
        nodeId: lease.nodeId,
        epoch: lease.epoch,
      },
    });
  }

  /**
   * Expires the lease for a specific node.
   */
  private async expireLeaseForNode(nodeId: string): Promise<void> {
    logger.log({
      level: "debug",
      message: "lease_reclaimer.expiring_lease_for_node",
      data: { nodeId },
    });
  }

  /**
   * Triggers a failover for the given node.
   */
  private async triggerFailover(lostLeaderNodeId: string): Promise<FailoverDecision> {
    const decision = this.coordinator.triggerFailover(
      "heartbeat_missing",
      undefined, // Let coordinator pick new leader
    );

    this.onFailover?.(decision);

    logger.log({
      level: "info",
      message: "lease_reclaimer.failover_triggered",
      data: {
        oldLeaderNodeId: lostLeaderNodeId,
        newLeaderNodeId: decision.newLeaderNodeId,
        outcome: decision.outcome,
      },
    });

    return decision;
  }
}

// ── Factory ─────────────────────────────────────────────────────────

/**
 * Creates a LeaseReclaimerService with HA-level-appropriate defaults.
 */
export function createLeaseReclaimerService(
  options: LeaseReclaimerServiceOptions,
): LeaseReclaimerService {
  return new LeaseReclaimerService(options);
}
