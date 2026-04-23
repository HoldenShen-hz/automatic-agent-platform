/**
 * @fileoverview Execution Worker Writeback Service - Handles result reporting from workers.
 *
 * When a worker completes or fails an execution, it reports back to the system through
 * this writeback service. The service validates the writeback request (ensuring the worker
 * still holds a valid lease), updates all affected records, and manages the lease lifecycle.
 *
 * Key responsibilities:
 * - Validate writeback requests against current execution/lease state
 * - Check for resource ceiling violations before accepting writebacks
 * - Verify remote session authority for remote workers
 * - Apply terminal state transitions to task, workflow, session, and execution
 * - Release execution leases and update worker snapshots
 * - Record heartbeat snapshots and remote logs
 *
 * The writeback flow is critical for maintaining consistency between workers and the
 * authoritative database, especially in distributed/multi-region deployments.
 *
 * @see Execution Lease Service: execution-lease-service.ts
 * @see Transition Service: transition-service.ts
 */
import type { WorkerSnapshotRecord } from "../../contracts/types/domain.js";
import type { TaskTerminalStatus } from "../../contracts/types/status.js";
import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import { ExecutionResourceCeilingGuard } from "../dispatcher/execution-resource-ceiling-guard.js";
/**
 * Input data from a worker reporting execution completion or failure.
 *
 * Contains all information the worker gathered during execution:
 * execution results, resource usage, telemetry, and status.
 */
export interface WorkerWritebackInput {
    executionId: string;
    workerId: string;
    leaseId: string;
    fencingToken: number;
    runtimeInstanceId?: string | null;
    restartedFromRuntimeInstanceId?: string | null;
    terminalStatus: TaskTerminalStatus;
    lastToolName?: string | null;
    toolCallCount?: number;
    taskOutputJson?: string | null;
    outputsJson?: string | null;
    reasonCode?: string | null;
    progressMessage?: string | null;
    cpuPct?: number | null;
    memoryMb?: number | null;
    toolBacklogCount?: number;
    currentStepId?: string | null;
    lastProgressAt?: string | null;
    workspaceSyncStatus?: WorkerSnapshotRecord["workspaceSyncStatus"];
    workspaceSyncCheckedAt?: string | null;
    remoteLogs?: WorkerRemoteLogInput[];
    occurredAt?: string;
}
/**
 * Remote log entry from a worker for observability.
 *
 * Workers can emit structured log messages during execution that are
 * captured and persisted for debugging and audit purposes.
 */
export interface WorkerRemoteLogInput {
    level: "debug" | "info" | "warn" | "error";
    message: string;
    context?: Record<string, unknown> | null;
    occurredAt?: string;
}
/**
 * Decision result from processing a worker writeback request.
 *
 * Indicates whether the writeback was accepted and applied, or rejected
 * with a reason code explaining why. Many rejection reasons indicate
 * consistency problems that may require manual intervention.
 */
export interface WorkerWritebackDecision {
    accepted: boolean;
    reasonCode: "execution_not_found" | "task_not_found" | "workflow_not_found" | "session_not_found" | "execution_not_executing" | "lease_not_found" | "no_active_lease" | "stale_fencing_token" | "worker_mismatch" | "lease_mismatch" | "lease_expired" | "worker_not_trusted" | "remote_session_viewer_only" | "remote_session_consistency_mismatch" | "remote_workspace_sync_conflict" | "remote_session_resume_offset_missing" | "invalid_terminal_transition" | "authoritative_store_unavailable" | "resource_limit_exceeded" | null;
    executionId: string | null;
    leaseId: string | null;
    taskId: string | null;
    terminalStatus: TaskTerminalStatus | null;
}
/** Options for configuring the writeback service. */
export interface ExecutionWorkerWritebackServiceOptions {
    resourceCeilingGuard?: ExecutionResourceCeilingGuard;
}
/**
 * Service for handling execution result writebacks from workers.
 *
 * Accepts writeback requests that report execution completion (done, failed, cancelled),
 * validates them thoroughly, and applies the resulting state changes to the authoritative
 * database. Rejections are issued with detailed reason codes for debugging.
 */
export declare class ExecutionWorkerWritebackService {
    private readonly db;
    private readonly store;
    private readonly leases;
    private readonly transitions;
    private readonly workers;
    private readonly resourceCeilingGuard;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: ExecutionWorkerWritebackServiceOptions);
    /**
     * Processes a worker writeback request.
     *
     * This is the main entry point for worker result reporting. The method:
     * 1. Validates the execution, task, workflow, session exist
     * 2. Validates the execution is in "executing" status
     * 3. Validates the lease is still valid and owned by this worker
     * 4. Checks for resource ceiling violations
     * 5. For remote workers, validates session authority
     * 6. If all checks pass, applies terminal state transitions and releases lease
     * 7. If any check fails, rejects with a detailed reason code
     */
    recordWriteback(input: WorkerWritebackInput): WorkerWritebackDecision;
    /**
     * Refreshes a worker snapshot after an execution completes.
     *
     * Removes the completed execution from the worker's running list,
     * updates telemetry (CPU, memory, etc.), and recalculates status
     * based on remaining running executions.
     */
    private refreshWorkerSnapshot;
    /**
     * Records an event when a writeback is rejected.
     *
     * Emits a tier-2 event with details about the rejection for
     * observability and debugging.
     */
    private recordRejectedEvent;
    /**
     * Updates or inserts an agent execution record.
     *
     * Preserves existing fields from any prior record (like planJson and
     * lastDecisionJson) while updating the current execution state,
     * progress, and telemetry.
     */
    private upsertAgentExecutionRecord;
    /**
     * Persists remote log entries from the worker.
     *
     * Writes each log entry to the store with correlation context
     * for traceability across task, execution, worker, and trace.
     */
    private persistRemoteLogs;
}
