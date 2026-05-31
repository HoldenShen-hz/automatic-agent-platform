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
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
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
type EvolutionApprovalService = ConstructorParameters<typeof EvolutionMvpService>[2];
type EvolutionMemoryService = ConstructorParameters<typeof EvolutionMvpService>[3];

export class EvolutionServiceAsync extends SyncBackedAsyncService<EvolutionMvpServiceSync> {
  private static readonly NOOP_APPROVAL_SERVICE: EvolutionApprovalService = {
    createRequest(): never {
      throw new Error("evolution.async.approval_service_required");
    },
  };

  private static readonly NOOP_MEMORY_SERVICE: EvolutionMemoryService = {
    remember(): never {
      throw new Error("evolution.async.memory_service_required");
    },
    revoke(): never {
      throw new Error("evolution.async.memory_service_required");
    },
  };

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
      EvolutionServiceAsync.NOOP_APPROVAL_SERVICE,
      EvolutionServiceAsync.NOOP_MEMORY_SERVICE,
    ));
  }
}
