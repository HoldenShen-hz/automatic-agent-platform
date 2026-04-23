/**
 * @fileoverview Coordinator Load Balancing Service - Scheduler coordinator selection.
 *
 * Manages coordinator instance registration, heartbeat tracking, and selection
 * for the HA-coordinated task scheduling system. Multiple coordinators can run
 * in different regions for high availability and geographic distribution.
 *
 * Key concepts:
 * - Coordinator: A scheduler instance that assigns tasks to workers
 * - Heartbeat: Periodic health/report from coordinators
 * - Selection: Choosing the best coordinator based on load, region, and affinity
 *
 * @see HA Coordinator Service: ha-coordinator-service.ts
 */
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { CoordinatorInstanceRecord, CoordinatorInstanceStatus } from "../../contracts/types/domain.js";
export interface RegisterCoordinatorHeartbeatInput {
    coordinatorId?: string;
    region: string;
    role?: string;
    queueAffinity?: string | null;
    status?: CoordinatorInstanceStatus;
    maxConcurrentDispatches?: number;
    activeDispatchCount?: number;
    backlogCount?: number;
    cpuPct?: number | null;
    shards?: string[];
    metadata?: Record<string, unknown> | null;
    heartbeatAt?: string;
}
export interface CoordinatorSelectionInput {
    queueName?: string | null;
    preferredRegion?: string | null;
    tenantId?: string | null;
    requestKey?: string | null;
}
export interface CoordinatorSelectionEvaluation {
    coordinatorId: string;
    eligible: boolean;
    score: number | null;
    reasonCode: string | null;
}
export interface CoordinatorSelectionDecision {
    outcome: "selected" | "no_candidate";
    selectedCoordinatorId: string | null;
    reasonCode: string | null;
    evaluations: CoordinatorSelectionEvaluation[];
}
export interface CoordinatorLoadBalancingSummary {
    generatedAt: string;
    coordinatorCount: number;
    activeCount: number;
    drainingCount: number;
    offlineCount: number;
    totalCapacity: number;
    totalActiveDispatchCount: number;
    totalBacklogCount: number;
    regions: string[];
    hotCoordinatorIds: string[];
}
export declare class CoordinatorLoadBalancingService {
    private readonly db;
    private readonly store;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore);
    /**
     * Registers or updates a coordinator's heartbeat.
     *
     * Creates a new coordinator record if this is the first heartbeat,
     * or updates the existing record with new load metrics. The
     * coordinator ID is generated if not provided.
     */
    registerHeartbeat(input: RegisterCoordinatorHeartbeatInput): CoordinatorInstanceRecord;
    /**
     * Lists all coordinator snapshots.
     */
    listSnapshots(limit?: number): CoordinatorInstanceRecord[];
    /**
     * Builds an aggregate summary of coordinator load across the fleet.
     *
     * Includes counts by status, total capacity, and identification of
     * "hot" coordinators (load score >= 1.0) that may need attention.
     */
    buildSummary(generatedAt?: string): CoordinatorLoadBalancingSummary;
    /**
     * Selects the best coordinator for a dispatch request.
     *
     * Evaluates all active coordinators against the request requirements:
     * - Filters out inactive coordinators
     * - Checks queue affinity match
     * - Validates tenant shard coverage
     * - Scores eligible coordinators by load
     * - Uses stable hash for request-level load distribution
     */
    selectCoordinator(input?: CoordinatorSelectionInput): CoordinatorSelectionDecision;
}
