/**
 * Async Execution Worker Writeback Service
 *
 * Async version of ExecutionWorkerWritebackService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionWorkerWritebackService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionWorkerWritebackService for the sync implementation
 */

import { SyncBackedAsyncService } from "../../shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import type { WorkerWritebackInput, WorkerWritebackDecision } from "./execution-worker-writeback-service.js";
import { ExecutionWorkerWritebackService } from "./execution-worker-writeback-service.js";

/**
 * Async Execution Worker Writeback Service
 *
 * Handles result reporting from workers - when a worker completes or fails
 * an execution, it reports back through this writeback service.
 *
 * This async version provides the same functionality as ExecutionWorkerWritebackService
 * but with async/await interface for modern async contexts.
 */
type ExecutionWorkerWritebackServiceSync = import("./execution-worker-writeback-service.js").ExecutionWorkerWritebackService;

export class ExecutionWorkerWritebackServiceAsync extends SyncBackedAsyncService<ExecutionWorkerWritebackServiceSync> {

  /**
   * Creates a new ExecutionWorkerWritebackServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => new ExecutionWorkerWritebackService(db, store));
  }

  /**
   * Records a writeback from a worker reporting execution completion or failure.
   */
  public async recordWriteback(input: WorkerWritebackInput): Promise<WorkerWritebackDecision> {
    return this.asPromise((sync) => sync.recordWriteback(input));
  }
}

// Re-export types
export type { WorkerWritebackInput, WorkerWritebackDecision } from "./execution-worker-writeback-service.js";
