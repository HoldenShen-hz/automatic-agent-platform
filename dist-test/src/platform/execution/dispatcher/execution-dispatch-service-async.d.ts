/**
 * Async Execution Dispatch Service
 *
 * Async version of ExecutionDispatchService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionDispatchService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionDispatchService for the sync implementation
 */
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { AdmissionBackpressureSnapshot } from "./admission-controller.js";
import type { CreateExecutionTicketInput, DispatchExecutionDecision, DispatchExecutionOptions, DispatchQueueAvailabilitySnapshot, ExecutionTicketDecision } from "./execution-dispatch-support.js";
import { ExecutionDispatchService } from "./execution-dispatch-service.js";
export type { CreateExecutionTicketInput, DispatchExecutionDecision, DispatchExecutionOptions, DispatchQueueAvailabilitySnapshot, ExecutionTicketDecision, } from "./execution-dispatch-support.js";
/**
 * Options for creating an async ExecutionDispatchService
 */
export interface ExecutionDispatchServiceAsyncOptions {
    /** Use synchronous transactions (SQLite) instead of async transactions */
    useSyncTransactions?: boolean;
}
/**
 * Async Execution Dispatch Service
 *
 * Manages execution dispatch - the process of selecting and assigning
 * work to available workers.
 *
 * This async version provides the same functionality as ExecutionDispatchService
 * but with async/await interface for modern async contexts.
 */
export declare class ExecutionDispatchServiceAsync {
    private readonly sync;
    /**
     * Creates a new ExecutionDispatchServiceAsync instance.
     *
     * @param db - SQLite database instance (sync mode)
     * @param store - AuthoritativeTaskStore for data access
     * @param backpressureSnapshot - Optional backpressure snapshot function
     * @param queueAvailabilitySnapshot - Optional queue availability snapshot function
     */
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, backpressureSnapshot?: (() => AdmissionBackpressureSnapshot | null) | null, queueAvailabilitySnapshot?: (() => DispatchQueueAvailabilitySnapshot | null) | null);
    /**
     * Creates a new execution ticket for an execution.
     */
    createTicket(input: CreateExecutionTicketInput): Promise<ExecutionTicketDecision>;
    /**
     * Dispatches the next available ticket to an available worker.
     */
    dispatchNext(options: DispatchExecutionOptions): Promise<DispatchExecutionDecision>;
    /**
     * Gets the synchronous service instance for internal use.
     * @internal
     */
    getSyncService(): ExecutionDispatchService;
}
