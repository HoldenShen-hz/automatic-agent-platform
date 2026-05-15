/**
 * Async Execution Worker Handshake Service
 *
 * Async version of ExecutionWorkerHandshakeService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionWorkerHandshakeService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionWorkerHandshakeService for the sync implementation
 */

import { SyncBackedAsyncService } from "../../shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type {
  ExecutionWorkerHandshakeServiceOptions,
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerHandshakeDecision,
  WorkerRemoteLogInput,
} from "./execution-worker-handshake-types.js";
import { ExecutionWorkerHandshakeService } from "./execution-worker-handshake-service.js";

export type {
  ExecutionWorkerHandshakeServiceOptions,
  WorkerClaimExecutionInput,
  WorkerExecutionHeartbeatInput,
  WorkerHandshakeDecision,
  WorkerRemoteLogInput,
} from "./execution-worker-handshake-types.js";

/**
 * Async Execution Worker Handshake Service
 *
 * Handles the handshake between the authoritative system and workers -
 * including lease acquisition, heartbeat, and execution claim.
 *
 * This async version provides the same functionality as ExecutionWorkerHandshakeService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionWorkerHandshakeServiceAsync extends SyncBackedAsyncService<ExecutionWorkerHandshakeService> {

  /**
   * Creates a new ExecutionWorkerHandshakeServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   * @param options - Optional service configuration
   */
  public constructor(
    db: AuthoritativeSqlDatabase,
    store: AuthoritativeTaskStore,
    options: ExecutionWorkerHandshakeServiceOptions = {},
  ) {
    super(() => new ExecutionWorkerHandshakeService(db, store, options));
  }

  /**
   * Handles a worker's request to claim an execution ticket.
   */
  public claimExecution(input: WorkerClaimExecutionInput): Promise<WorkerHandshakeDecision> {
    return this.asPromise((sync) => sync.claimExecution(input));
  }

  /**
   * Records a heartbeat from a worker.
   */
  public recordHeartbeat(input: WorkerExecutionHeartbeatInput): Promise<WorkerHandshakeDecision> {
    return this.asPromise((sync) => sync.recordHeartbeat(input));
  }
}
