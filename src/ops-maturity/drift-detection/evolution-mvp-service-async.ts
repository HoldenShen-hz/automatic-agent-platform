/**
 * Async Evolution MVP Service
 *
 * Async version of EvolutionMvpService that provides async/await interface.
 * This is a thin async wrapper around the sync EvolutionMvpService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see EvolutionMvpService for the sync implementation
 */

import { createRequire } from "node:module";

import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";

const require = createRequire(import.meta.url);

/**
 * Async Evolution MVP Service
 *
 * Evolution service for managing evolution proposals and migrations.
 *
 * This async version provides the same functionality as EvolutionMvpService
 * but with async/await interface for modern async contexts.
 */
export class EvolutionServiceAsync {
  private readonly sync: import("./evolution-mvp-service.js").EvolutionMvpService;

  /**
   * Creates a new EvolutionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    const { EvolutionMvpService } = require("./evolution-mvp-service.js");
    this.sync = new EvolutionMvpService(db, store);
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): import("./evolution-mvp-service.js").EvolutionMvpService {
    return this.sync;
  }
}
