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

import { SyncBackedAsyncService } from "../../platform/shared/async/sync-backed-async-service.js";
import type { AuthoritativeSqlDatabase } from "../../platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  PerceptionService,
  type BuildIntelBriefInput,
  type BuildIntelBriefResult,
  type IngestIntelInput,
  type IngestIntelResult,
  type ProposePerceptionActionsInput,
  type RegisterPerceptionSourceInput,
} from "./perception-service.js";
import type { ActionProposalRecord, PerceptionSourceRecord } from "../../platform/contracts/types/domain.js";

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
    super(() => new PerceptionService(db, store));
  }

  public async registerSourceAsync(
    input: RegisterPerceptionSourceInput,
  ): Promise<PerceptionSourceRecord> {
    return this.asPromise((sync) => sync.registerSource(input));
  }

  public async registerSource(
    input: RegisterPerceptionSourceInput,
  ): Promise<PerceptionSourceRecord> {
    return this.registerSourceAsync(input);
  }

  public async ingestIntel(
    input: IngestIntelInput,
  ): Promise<IngestIntelResult> {
    return this.asPromise((sync) => sync.ingestIntel(input));
  }

  /**
   * Ingests intel candidates into the system (async).
   */
  public async ingestIntelAsync(
    input: IngestIntelInput,
  ): Promise<IngestIntelResult> {
    return this.ingestIntel(input);
  }

  public async proposeActionsAsync(
    input: ProposePerceptionActionsInput,
  ): Promise<ActionProposalRecord[]> {
    return this.asPromise((sync) => sync.proposeActions(input));
  }

  public async buildBrief(
    input: BuildIntelBriefInput,
  ): Promise<BuildIntelBriefResult> {
    return this.asPromise((sync) => sync.buildBrief(input));
  }

  public async proposeActions(
    input: ProposePerceptionActionsInput,
  ): Promise<ActionProposalRecord[]> {
    return this.proposeActionsAsync(input);
  }
}
