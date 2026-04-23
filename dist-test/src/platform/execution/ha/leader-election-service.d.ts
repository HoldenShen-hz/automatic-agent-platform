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
import type { HaLevel, HaLevelConfig, LeadershipQueryResult } from "./types.js";
import { type LeaderLease } from "./types.js";
import type { HaCoordinatorService } from "./ha-coordinator-service-inner.js";
/**
 * Leader election state machine states.
 */
export type LeaderElectionState = "stopped" | "starting" | "candidate" | "follower" | "leader" | "shutdown";
/**
 * Leader election event types for observability.
 */
export type LeaderElectionEvent = "election_start" | "leadership_acquired" | "leadership_lost" | "leadership_renewed" | "leadership_expired" | "failover_triggered" | "abdication" | "follower_elected";
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
export declare class LeaderElectionService {
    private state;
    private currentLease;
    private currentEpoch;
    private currentFencingToken;
    private electionAttempts;
    private renewalIntervalHandle;
    private heartbeatIntervalHandle;
    private disposed;
    private readonly config;
    private readonly effectiveNodeId;
    private readonly effectiveRegion;
    private readonly maxElectionAttempts;
    private readonly nodeMetadata;
    private readonly coordinator;
    private readonly electionId;
    constructor(coordinator: HaCoordinatorService, options: LeaderElectionServiceOptions);
    /**
     * Starts the leader election process.
     * Registers the node and begins attempting to acquire leadership.
     */
    start(): Promise<void>;
    /**
     * Stops the leader election service gracefully.
     * Releases leadership if held and stops all background tasks.
     */
    stop(): Promise<void>;
    /**
     * Disposes of the service and releases all resources.
     */
    dispose(): void;
    /**
     * Returns the current leader election state.
     */
    getState(): LeaderElectionState;
    /**
     * Returns the current leadership status.
     */
    isLeader(): boolean;
    /**
     * Returns the current leader node ID, or null if no leader.
     */
    getLeaderNodeId(): string | null;
    /**
     * Returns whether this node is the current leader.
     */
    isCurrentLeader(): boolean;
    /**
     * Returns the current lease information if this node is leader.
     */
    getCurrentLease(): LeaderLease | null;
    /**
     * Returns the current leadership query result.
     */
    queryLeadership(): LeadershipQueryResult;
    /**
     * Returns the HA level configuration in use.
     */
    getHaConfig(): HaLevelConfig;
    /**
     * Manually triggers a leadership transfer to another node.
     * Only works if this node is currently leader.
     */
    transferLeadership(targetNodeId: string): Promise<boolean>;
    /**
     * Forces this node to attempt to become leader, preempting any existing leader.
     */
    forceAcquireLeadership(): Promise<boolean>;
    /**
     * Attempts to acquire leadership.
     * Implements leader stickiness to reduce unnecessary failovers.
     */
    private attemptElection;
    /**
     * Releases leadership gracefully.
     */
    private releaseLeadership;
    /**
     * Starts the lease renewal loop.
     */
    private startRenewalLoop;
    /**
     * Stops the lease renewal loop.
     */
    private stopRenewalLoop;
    /**
     * Starts the node heartbeat.
     */
    private startHeartbeat;
    /**
     * Stops the node heartbeat.
     */
    private stopHeartbeat;
    /**
     * Renews the leadership lease.
     */
    private renewLeadership;
    /**
     * Emits an election event for observability.
     */
    private emitEvent;
}
export interface HaLevelConfigurable {
    haLevel: HaLevel;
    customConfig?: Partial<HaLevelConfig>;
}
/**
 * Creates a LeaderElectionService with HA-level-appropriate defaults.
 */
export declare function createLeaderElectionService(coordinator: HaCoordinatorService, nodeId: string, region: string, config?: HaLevelConfigurable & {
    nodeMetadata?: Record<string, unknown>;
}): LeaderElectionService;
