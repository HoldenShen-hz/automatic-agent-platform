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
import type { HaLevel, LeaseReclaimResult, LeaseReclaimerConfig, LeaderLease } from "./types.js";
import { type CoordinatorNode, type FailoverDecision } from "./types.js";
import type { HaCoordinatorService } from "./ha-coordinator-service-inner.js";
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
export declare class LeaseReclaimerService {
    private intervalHandle;
    private disposed;
    private running;
    private readonly config;
    private readonly coordinator;
    private readonly onFailover;
    private readonly onLeaseReclaimed;
    private readonly nodeId;
    constructor(options: LeaseReclaimerServiceOptions);
    /**
     * Starts the lease reclaimer background process.
     */
    start(): void;
    /**
     * Stops the lease reclaimer background process.
     */
    stop(): void;
    /**
     * Disposes of the service.
     */
    dispose(): void;
    /**
     * Triggers an immediate reclaim cycle.
     * Returns the result of the reclamation.
     */
    reclaimOnce(): Promise<LeaseReclaimResult>;
    /**
     * Returns the current configuration.
     */
    getConfig(): Readonly<LeaseReclaimerConfig>;
    /**
     * Returns whether the service is currently running.
     */
    isRunning(): boolean;
    /**
     * Schedules the next reclaim cycle.
     */
    private scheduleNextReclaim;
    /**
     * Performs a single reclaim cycle.
     */
    private doReclaimCycle;
    /**
     * Gets expired leases from the coordinator.
     */
    private getExpiredLeases;
    /**
     * Gets nodes that have missed heartbeats.
     */
    private getStaleNodes;
    /**
     * Expires a specific lease.
     */
    private expireLease;
    /**
     * Expires the lease for a specific node.
     */
    private expireLeaseForNode;
    /**
     * Triggers a failover for the given node.
     */
    private triggerFailover;
}
/**
 * Creates a LeaseReclaimerService with HA-level-appropriate defaults.
 */
export declare function createLeaseReclaimerService(options: LeaseReclaimerServiceOptions): LeaseReclaimerService;
