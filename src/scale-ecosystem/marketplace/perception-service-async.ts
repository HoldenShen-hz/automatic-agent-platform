/**
 * Async Perception Service
 *
 * Async version of PerceptionService that provides async/await interface.
 * This is a thin async wrapper around the sync PerceptionService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see PerceptionService for the sync implementation
 */

import { createRequire } from "node:module";

import type { AuthoritativeSqlDatabase } from "../../platform/state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/state-evidence/truth/authoritative-task-store.js";
import type { IntelItemRecord } from "../../platform/contracts/types/domain.js";

const require = createRequire(import.meta.url);

/**
 * Async Perception Service
 *
 * Perception and intelligence service for gathering, processing, and acting on intel.
 *
 * This async version provides the same functionality as PerceptionService
 * but with async/await interface for modern async contexts.
 */
export class PerceptionServiceAsync {
  private readonly sync: import("./perception-service.js").PerceptionService;

  /**
   * Creates a new PerceptionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    const { PerceptionService } = require("./perception-service.js");
    this.sync = new PerceptionService(db, store);
  }

  /**
   * Ingests intel candidates into the system (async).
   */
  public async ingestIntelAsync(
    input: Parameters<import("./perception-service.js").PerceptionService["ingestIntel"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["ingestIntel"]>> {
    return Promise.resolve(this.sync.ingestIntel(input));
  }

  /**
   * Gets the synchronous service instance for internal use.
   * @internal
   */
  public getSyncService(): import("./perception-service.js").PerceptionService {
    return this.sync;
  }
}
