/**
 * Async Execution Priority Preemption Service
 *
 * Async version of ExecutionPriorityPreemptionService that provides async/await interface.
 * This is a thin async wrapper around the sync ExecutionPriorityPreemptionService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * For true PostgreSQL async support, the underlying store operations
 * would need to use AsyncSqlDatabase.transaction() with async repository methods.
 *
 * @see ExecutionPriorityPreemptionService for the sync implementation
 */

import { SyncBackedAsyncService } from "../../shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  ExecutionPriorityPreemptionService,
  type PriorityPreemptionDecision,
  type PriorityPreemptionRequest,
} from "./execution-priority-preemption-service.js";

/**
 * Async Execution Priority Preemption Service
 *
 * Preempts lower-priority executions to make room for urgent work.
 *
 * This async version provides the same functionality as ExecutionPriorityPreemptionService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionPriorityPreemptionServiceAsync extends SyncBackedAsyncService<ExecutionPriorityPreemptionService> {

  /**
   * Creates a new ExecutionPriorityPreemptionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => new ExecutionPriorityPreemptionService(db, store));
  }

  /**
   * Attempts to preempt a lower-priority execution to make room for an urgent ticket.
   */
  public preemptForUrgentTicket(input: PriorityPreemptionRequest): Promise<PriorityPreemptionDecision> {
    return this.asPromise((sync) => sync.preemptForUrgentTicket(input));
  }
}
