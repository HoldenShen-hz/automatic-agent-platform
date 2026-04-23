import { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { ExecutionWorkerHandshakeServiceOptions, WorkerClaimExecutionInput, WorkerExecutionHeartbeatInput, WorkerHandshakeDecision } from "./execution-worker-handshake-types.js";
export type { ExecutionWorkerHandshakeServiceOptions, WorkerClaimExecutionInput, WorkerExecutionHeartbeatInput, WorkerHandshakeDecision, WorkerRemoteLogInput, } from "./execution-worker-handshake-types.js";
export declare class ExecutionWorkerHandshakeService {
    private readonly db;
    private readonly store;
    private readonly leases;
    private readonly workers;
    private readonly resourceCeilingGuard;
    /**
     * Creates a new ExecutionWorkerHandshakeService instance.
     * @param db - SQLite database instance for transactional operations
     * @param store - AuthoritativeTaskStore for data access operations
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, options?: ExecutionWorkerHandshakeServiceOptions);
    /**
     * Handles a worker's request to claim an execution ticket.
     *
     * Validates in order:
     * 1. Ticket exists
     * 2. Worker is registered in the system
     * 3. Ticket status is "claimed" (dispatch completed)
     * 4. Ticket is assigned to this worker
     * 5. Lease ID matches
     * 6. Write access is allowed (fencing token valid, lease active)
     * 7. Execution record exists
     *
     * On success: consumes the ticket, updates execution status to "executing",
     * records initial telemetry, and updates worker snapshot.
     *
     * @param input - Claim parameters including ticket ID, worker ID, lease, and fencing token
     * @returns Decision indicating acceptance or rejection with reason code
     */
    claimExecution(input: WorkerClaimExecutionInput): WorkerHandshakeDecision;
    /**
     * Records a heartbeat from a worker during execution.
     *
     * Validates:
     * 1. Execution exists
     * 2. Worker is registered
     * 3. Write access is allowed (fencing token and lease valid)
     * 4. Lease can be renewed
     *
     * On success: extends the lease TTL, records telemetry, and updates worker snapshot.
     *
     * @param input - Heartbeat parameters including execution ID, worker, lease, and telemetry
     * @returns Decision indicating acceptance or rejection with reason code
     */
    recordHeartbeat(input: WorkerExecutionHeartbeatInput): WorkerHandshakeDecision;
    /**
     * Updates a worker's snapshot with new telemetry and running execution information.
     *
     * Adds the execution to the worker's running executions list and recalculates
     * the worker's effective status based on its base status and workload.
     *
     * @param snapshot - Current worker snapshot to update
     * @param executionId - ID of the execution being started/run
     * @param occurredAt - Timestamp of this refresh
     * @param telemetry - Updated telemetry values (optional, merges with existing)
     */
    private refreshWorkerSnapshot;
    /**
     * Records a claim rejection event for audit purposes.
     * Used to track why a worker's claim attempt was denied.
     *
     * @param taskId - The task ID for the event
     * @param executionId - The execution ID for the event
     * @param occurredAt - Timestamp of the rejection
     * @param payload - Details about the rejection including worker, ticket, and reason
     */
    private upsertAgentExecutionRecord;
}
