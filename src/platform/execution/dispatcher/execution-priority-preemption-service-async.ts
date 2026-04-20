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

import { createRequire } from "node:module";

import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type {
  PriorityPreemptionDecision,
  PriorityPreemptionRequest,
} from "./execution-priority-preemption-service.js";

const require = createRequire(import.meta.url);

/**
 * Async Execution Priority Preemption Service
 *
 * Preempts lower-priority executions to make room for urgent work.
 *
 * This async version provides the same functionality as ExecutionPriorityPreemptionService
 * but with async/await interface for modern async contexts.
 */
export class ExecutionPriorityPreemptionServiceAsync {
  private readonly sync: import("./execution-priority-preemption-service.js").ExecutionPriorityPreemptionService;

  /**
   * Creates a new ExecutionPriorityPreemptionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    const { ExecutionPriorityPreemptionService } = require("./execution-priority-preemption-service.js");
    this.sync = new ExecutionPriorityPreemptionService(db, store);
  }

  /**
   * Attempts to preempt a lower-priority execution to make room for an urgent ticket.
   */
  public preemptForUrgentTicket(input: PriorityPreemptionRequest): Promise<PriorityPreemptionDecision> {
    return Promise.resolve(this.sync.preemptForUrgentTicket(input));
  }
}

// Re-export types
export type { PriorityPreemptionDecision, PriorityPreemptionRequest } from "./execution-priority-preemption-service.js";
