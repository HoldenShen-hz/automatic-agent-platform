/**
 * Async Data Plane Flow Service
 *
 * Async version of DataPlaneFlowService that provides async/await interface.
 * This is a thin async wrapper around the sync DataPlaneFlowService,
 * intended to provide the async interface while the underlying store
 * operations remain sync (for SQLite compatibility).
 *
 * @see DataPlaneFlowService for the sync implementation
 */

import { createRequire } from "node:module";

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";

const require = createRequire(import.meta.url);

/**
 * Async Data Plane Flow Service
 *
 * Data plane flow service for managing data flows and connections.
 *
 * This async version provides the same functionality as DataPlaneFlowService
 * but with async/await interface for modern async contexts.
 */
type DataPlaneFlowServiceSync = import("./data-plane-flow-service.js").DataPlaneFlowService;

export class DataPlaneFlowServiceAsync extends SyncBackedAsyncService<DataPlaneFlowServiceSync> {

  /**
   * Creates a new DataPlaneFlowServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DataPlaneFlowService } = require("./data-plane-flow-service.js");
      return new DataPlaneFlowService(db, store);
    });
  }

  public async createAnalyticsFactAsync(
    input: Parameters<import("./data-plane-flow-service.js").DataPlaneFlowService["createAnalyticsFact"]>[0],
  ): Promise<ReturnType<import("./data-plane-flow-service.js").DataPlaneFlowService["createAnalyticsFact"]>> {
    return this.asPromise((sync) => sync.createAnalyticsFact(input));
  }

  public async createArchiveBundleAsync(
    input: Parameters<import("./data-plane-flow-service.js").DataPlaneFlowService["createArchiveBundle"]>[0],
  ): Promise<ReturnType<import("./data-plane-flow-service.js").DataPlaneFlowService["createArchiveBundle"]>> {
    return this.asPromise((sync) => sync.createArchiveBundle(input));
  }

  public async createReplayDatasetAsync(
    input: Parameters<import("./data-plane-flow-service.js").DataPlaneFlowService["createReplayDataset"]>[0],
  ): Promise<ReturnType<import("./data-plane-flow-service.js").DataPlaneFlowService["createReplayDataset"]>> {
    return this.asPromise((sync) => sync.createReplayDataset(input));
  }

  public async buildSummaryAsync(
    input?: Parameters<import("./data-plane-flow-service.js").DataPlaneFlowService["buildSummary"]>[0],
  ): Promise<ReturnType<import("./data-plane-flow-service.js").DataPlaneFlowService["buildSummary"]>> {
    return this.asPromise((sync) => sync.buildSummary(input));
  }
}
