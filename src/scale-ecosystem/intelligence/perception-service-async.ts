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

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
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
type PerceptionServiceSync = import("./perception-service.js").PerceptionService;

export class PerceptionServiceAsync extends SyncBackedAsyncService<PerceptionServiceSync> {

  /**
   * Creates a new PerceptionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => {
      const { PerceptionService } = require("./perception-service.js");
      return new PerceptionService(db, store);
    });
  }

  public async registerSourceAsync(
    input: Parameters<import("./perception-service.js").PerceptionService["registerSource"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["registerSource"]>> {
    return this.asPromise((sync) => sync.registerSource(input));
  }

  public async registerSource(
    input: Parameters<import("./perception-service.js").PerceptionService["registerSource"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["registerSource"]>> {
    return this.registerSourceAsync(input);
  }

  public async ingestIntel(
    input: Parameters<import("./perception-service.js").PerceptionService["ingestIntel"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["ingestIntel"]>> {
    return this.asPromise((sync) => sync.ingestIntel(input));
  }

  /**
   * Ingests intel candidates into the system (async).
   */
  public async ingestIntelAsync(
    input: Parameters<import("./perception-service.js").PerceptionService["ingestIntel"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["ingestIntel"]>> {
    return this.ingestIntel(input);
  }

  public async proposeActionsAsync(
    input: Parameters<import("./perception-service.js").PerceptionService["proposeActions"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["proposeActions"]>> {
    return this.asPromise((sync) => sync.proposeActions(input));
  }

  public async buildBrief(
    input: Parameters<import("./perception-service.js").PerceptionService["buildBrief"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["buildBrief"]>> {
    return this.asPromise((sync) => sync.buildBrief(input));
  }

  public async proposeActions(
    input: Parameters<import("./perception-service.js").PerceptionService["proposeActions"]>[0],
  ): Promise<ReturnType<import("./perception-service.js").PerceptionService["proposeActions"]>> {
    return this.proposeActionsAsync(input);
  }
}
