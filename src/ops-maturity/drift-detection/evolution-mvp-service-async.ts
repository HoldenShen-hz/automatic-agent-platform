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

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import type { ApprovalService } from "../../platform/five-plane-control-plane/approval-center/approval-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { MemoryService } from "../../platform/five-plane-state-evidence/memory-gateway/index.js";
import { EvolutionMvpService } from "./evolution-mvp-service.js";

/**
 * Async Evolution MVP Service
 *
 * Evolution service for managing evolution proposals and migrations.
 *
 * This async version provides the same functionality as EvolutionMvpService
 * but with async/await interface for modern async contexts.
 */
type EvolutionMvpServiceSync = import("./evolution-mvp-service.js").EvolutionMvpService;

export class EvolutionServiceAsync extends SyncBackedAsyncService<EvolutionMvpServiceSync> {

  /**
   * Creates a new EvolutionServiceAsync instance.
   *
   * @param db - SQLite database instance (sync mode)
   * @param store - AuthoritativeTaskStore for data access
   */
  public constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore) {
    super(() => new EvolutionMvpService(
      db,
      store,
      undefined as unknown as ApprovalService,
      undefined as unknown as MemoryService,
    ));
  }
}
