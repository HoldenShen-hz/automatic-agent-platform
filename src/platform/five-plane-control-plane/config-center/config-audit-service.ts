/**
 * Config Audit Service
 *
 * Provides configuration change audit capabilities:
 * - Records who made changes, when, what changed, and why
 * - Tracks approval status for protected configs
 * - Queries audit history by config path, time range, actor
 *
 * This service maintains a complete audit trail for configuration changes,
 * supporting compliance requirements and incident investigation.
 */

import { DurableEventBus } from "../../five-plane-state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  diffObjects,
  sha256,
  stableStringify,
  type ConfigDiffEntry,
} from "./config-governance-support.js";
import type { SqliteConnection } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";
import { queryAllOrEmpty, queryOne, execute } from "../../five-plane-state-evidence/truth/sqlite/query-helper.js";

const DEFAULT_AUDIT_ENTRY_LIMIT = 1000;

/**
 * Audit action types for configuration changes.
 */
export type ConfigAuditAction = "create" | "update" | "delete" | "rollback" | "approve" | "reject";

/**
 * Approval status for protected configurations.
 */
export type ConfigApprovalStatus = "pending" | "approved" | "rejected";

/**
 * Represents a single audit entry for a configuration change.
 */
export interface ConfigAuditEntry {
  /** Unique audit entry identifier */
  auditId: string;
  /** Dot-notation config path */
  configPath: string;
  /** Hierarchy layer (platform, tenant, pack, task_type) */
  layer: string;
  /** Source ID (e.g., tenantId) if applicable */
  sourceId: string | null;
  /** Action performed */
  action: ConfigAuditAction;
  /** Actor who performed the action (user ID or system) */
  actor: string | null;
  /** ISO timestamp when action occurred */
  timestamp: string;
  /** Hash of configuration before the change */
  beforeHash: string | null;
  /** Hash of configuration after the change */
  afterHash: string | null;
  /** Detailed changes between before and after states */
  changes: ConfigDiffEntry[];
  /** Reason provided for the change */
  reason: string | null;
  /** Whether P2 approval was required */
  approvalRequired: boolean;
  /** Current approval status (null if not applicable) */
  approvalStatus: ConfigApprovalStatus | null;
  /** Who approved/rejected the change */
  approvedBy: string | null;
  /** When the change was approved/rejected */
  approvedAt: string | null;
  /** Version ID if this change created a new version */
  versionId: string | null;
  /** Previous version ID if this was an update or rollback */
  previousVersionId: string | null;
  /** Additional metadata */
  metadata: Record<string, unknown> | null;
}

/**
 * Query options for filtering audit entries.
 */
export interface ConfigAuditQuery {
  /** Filter by config path (exact match or prefix with *) */
  configPath?: string | null;
  /** Filter by hierarchy layer */
  layer?: string | null;
  /** Filter by source ID */
  sourceId?: string | null;
  /** Filter by actor */
  actor?: string | null;
  /** Filter by action type */
  action?: ConfigAuditAction | null;
  /** Filter by approval status */
  approvalStatus?: ConfigApprovalStatus | null;
  /** Start of time range (inclusive) */
  startTime?: string | null;
  /** End of time range (inclusive) */
  endTime?: string | null;
  /** Maximum number of entries to return */
  limit?: number;
  /** Offset for pagination */
  offset?: number;
}

/**
 * Result of an audit query.
 */
export interface ConfigAuditResult {
  /** Matching audit entries */
  entries: ConfigAuditEntry[];
  /** Total count matching the query (before pagination) */
  totalCount: number;
  /** Whether there are more entries */
  hasMore: boolean;
}

/**
 * Options for ConfigAuditService.
 */
export interface ConfigAuditServiceOptions {
  /** Optional event bus for emitting audit events */
  eventBus?: DurableEventBus | null;
  /** Maximum number of audit entries to retain per config path (default: 1000) */
  maxEntriesPerPath?: number;
  /** Maximum age of audit entries in milliseconds (default: 90 days) */
  maxEntryAgeMs?: number;
  /** SQLite connection for durable storage (R10-09) */
  sqliteDb?: SqliteConnection | null;
}

/**
 * Service for auditing configuration changes.
 *
 * Maintains a complete audit trail recording:
 * - Who made each change
 * - When the change occurred
 * - What specifically changed (detailed diff)
 * - Why the change was made (reason)
 * - Approval status for protected configurations
 *
 * Supports querying audit history for compliance and investigation.
 *
 * R10-09: Supports durable SQLite storage for audit entries.
 */
export class ConfigAuditService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxEntriesPerPath: number;
  private readonly maxEntryAgeMs: number;
  private readonly sqliteDb: SqliteConnection | null;
  private readonly useDurableStorage: boolean;

  /** In-memory storage for audit entries (fallback when no SQLite) */
  private readonly entries: ConfigAuditEntry[] = [];

  public constructor(options: ConfigAuditServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxEntriesPerPath = options.maxEntriesPerPath ?? 1000;
    this.maxEntryAgeMs = options.maxEntryAgeMs ?? 90 * 24 * 60 * 60 * 1000;
    this.sqliteDb = options.sqliteDb ?? null;
    this.useDurableStorage = this.sqliteDb != null;

    if (this.useDurableStorage) {
      this.initializeDurableStorage();
    }
  }

  /**
   * R10-09: Initialize SQLite tables for durable storage.
   */
  private initializeDurableStorage(): void {
    if (!this.sqliteDb) return;

    this.sqliteDb.exec(`
      CREATE TABLE IF NOT EXISTS config_audit_entries (
        audit_id TEXT PRIMARY KEY,
        config_path TEXT NOT NULL,
        layer TEXT NOT NULL,
        source_id TEXT,
        action TEXT NOT NULL,
        actor TEXT,
        timestamp TEXT NOT NULL,
        before_hash TEXT,
        after_hash TEXT,
        changes TEXT NOT NULL,
        reason TEXT,
        approval_required INTEGER NOT NULL,
        approval_status TEXT,
        approved_by TEXT,
        approved_at TEXT,
        version_id TEXT,
        previous_version_id TEXT,
        metadata TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_audit_config_path ON config_audit_entries(config_path);
      CREATE INDEX IF NOT EXISTS idx_audit_layer ON config_audit_entries(layer);
      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON config_audit_entries(timestamp);
      CREATE INDEX IF NOT EXISTS idx_audit_actor ON config_audit_entries(actor);
    `);
  }

  /**
   * R10-09: Load all audit entries from SQLite.
   */
  private loadEntriesFromDb(): ConfigAuditEntry[] {
    if (!this.sqliteDb) return [];

    interface AuditRow {
      audit_id: string;
      config_path: string;
      layer: string;
      source_id: string | null;
      action: string;
      actor: string | null;
      timestamp: string;
      before_hash: string | null;
      after_hash: string | null;
      changes: string;
      reason: string | null;
      approval_required: number;
      approval_status: string | null;
      approved_by: string | null;
      approved_at: string | null;
      version_id: string | null;
      previous_version_id: string | null;
      metadata: string | null;
    }

    const rows = queryAllOrEmpty<AuditRow>(
      this.sqliteDb,
      `SELECT * FROM config_audit_entries ORDER BY timestamp DESC LIMIT ?`,
      DEFAULT_AUDIT_ENTRY_LIMIT,
    );

    return rows.map((row) => ({
      auditId: row.audit_id,
      configPath: row.config_path,
      layer: row.layer,
      sourceId: row.source_id,
      action: row.action as ConfigAuditAction,
      actor: row.actor,
      timestamp: row.timestamp,
      beforeHash: row.before_hash,
      afterHash: row.after_hash,
      changes: JSON.parse(row.changes),
      reason: row.reason,
      approvalRequired: row.approval_required === 1,
      approvalStatus: row.approval_status as ConfigApprovalStatus | null,
      approvedBy: row.approved_by,
      approvedAt: row.approved_at,
      versionId: row.version_id,
      previousVersionId: row.previous_version_id,
      metadata: row.metadata ? JSON.parse(row.metadata) : null,
    }));
  }

  /**
   * R10-09: Save an audit entry to SQLite.
   */
  private saveEntryToDb(entry: ConfigAuditEntry): void {
    if (!this.sqliteDb) return;

    execute(
      this.sqliteDb,
      `INSERT OR REPLACE INTO config_audit_entries
       (audit_id, config_path, layer, source_id, action, actor, timestamp,
        before_hash, after_hash, changes, reason, approval_required, approval_status,
        approved_by, approved_at, version_id, previous_version_id, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      entry.auditId,
      entry.configPath,
      entry.layer,
      entry.sourceId,
      entry.action,
      entry.actor,
      entry.timestamp,
      entry.beforeHash,
      entry.afterHash,
      JSON.stringify(entry.changes),
      entry.reason,
      entry.approvalRequired ? 1 : 0,
      entry.approvalStatus,
      entry.approvedBy,
      entry.approvedAt,
      entry.versionId,
      entry.previousVersionId,
      entry.metadata ? JSON.stringify(entry.metadata) : null,
    );
  }

  /**
   * R10-09: Delete an audit entry from SQLite.
   */
  private deleteEntryFromDb(auditId: string): void {
    if (!this.sqliteDb) return;

    execute(
      this.sqliteDb,
      `DELETE FROM config_audit_entries WHERE audit_id = ?`,
      auditId,
    );
  }

  /**
   * R10-09: Get all entries, loading from DB if using durable storage.
   */
  private getAllEntries(): ConfigAuditEntry[] {
    if (this.useDurableStorage) {
      return this.loadEntriesFromDb();
    }
    return this.entries;
  }

  /**
   * R10-09: Set entries in memory (used for fallback when not using durable storage).
   */
  private setEntries(entries: ConfigAuditEntry[]): void {
    // Only used for in-memory fallback
    this.entries.length = 0;
    this.entries.push(...entries);
  }

  /**
   * Records a configuration creation event.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param content - Configuration content
   * @param actor - Who created the config
   * @param reason - Reason for creation
   * @param options - Additional options
   * @returns The created audit entry
   */
  public recordCreate(
    configPath: string,
    layer: string,
    sourceId: string | null,
    content: Record<string, unknown>,
    actor: string | null,
    reason: string | null = null,
    options: {
      approvalRequired?: boolean;
      versionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): ConfigAuditEntry {
    const entry = this.createEntry({
      configPath,
      layer,
      sourceId,
      action: "create",
      actor,
      beforeHash: null,
      afterHash: sha256(stableStringify(content)),
      changes: [],
      reason,
      approvalRequired: options.approvalRequired ?? false,
      versionId: options.versionId ?? null,
      previousVersionId: null,
      metadata: options.metadata ?? null,
    });

    this.addEntry(entry);
    return entry;
  }

  /**
   * Records a configuration update event.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param beforeContent - Configuration before the change
   * @param afterContent - Configuration after the change
   * @param actor - Who made the change
   * @param reason - Reason for the change
   * @param options - Additional options
   * @returns The created audit entry
   */
  public recordUpdate(
    configPath: string,
    layer: string,
    sourceId: string | null,
    beforeContent: Record<string, unknown>,
    afterContent: Record<string, unknown>,
    actor: string | null,
    reason: string | null = null,
    options: {
      approvalRequired?: boolean;
      versionId?: string;
      previousVersionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): ConfigAuditEntry {
    const changes = diffObjects(beforeContent, afterContent);

    const entry = this.createEntry({
      configPath,
      layer,
      sourceId,
      action: "update",
      actor,
      beforeHash: sha256(stableStringify(beforeContent)),
      afterHash: sha256(stableStringify(afterContent)),
      changes,
      reason,
      approvalRequired: options.approvalRequired ?? false,
      versionId: options.versionId ?? null,
      previousVersionId: options.previousVersionId ?? null,
      metadata: options.metadata ?? null,
    });

    this.addEntry(entry);
    return entry;
  }

  /**
   * Records a configuration deletion event.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param beforeContent - Configuration before deletion
   * @param actor - Who deleted the config
   * @param reason - Reason for deletion
   * @param options - Additional options
   * @returns The created audit entry
   */
  public recordDelete(
    configPath: string,
    layer: string,
    sourceId: string | null,
    beforeContent: Record<string, unknown>,
    actor: string | null,
    reason: string | null = null,
    options: {
      approvalRequired?: boolean;
      previousVersionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): ConfigAuditEntry {
    const entry = this.createEntry({
      configPath,
      layer,
      sourceId,
      action: "delete",
      actor,
      beforeHash: sha256(stableStringify(beforeContent)),
      afterHash: null,
      changes: [],
      reason,
      approvalRequired: options.approvalRequired ?? false,
      versionId: null,
      previousVersionId: options.previousVersionId ?? null,
      metadata: options.metadata ?? null,
    });

    this.addEntry(entry);
    return entry;
  }

  /**
   * Records a configuration rollback event.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @param beforeContent - Configuration before rollback
   * @param afterContent - Configuration after rollback
   * @param targetVersionId - Version ID that was rolled back to
   * @param actor - Who performed the rollback
   * @param reason - Reason for rollback
   * @param options - Additional options
   * @returns The created audit entry
   */
  public recordRollback(
    configPath: string,
    layer: string,
    sourceId: string | null,
    beforeContent: Record<string, unknown>,
    afterContent: Record<string, unknown>,
    targetVersionId: string,
    actor: string | null,
    reason: string | null = null,
    options: {
      approvalRequired?: boolean;
      versionId?: string;
      previousVersionId?: string;
      metadata?: Record<string, unknown>;
    } = {},
  ): ConfigAuditEntry {
    const changes = diffObjects(beforeContent, afterContent);

    const entry = this.createEntry({
      configPath,
      layer,
      sourceId,
      action: "rollback",
      actor,
      beforeHash: sha256(stableStringify(beforeContent)),
      afterHash: sha256(stableStringify(afterContent)),
      changes,
      reason: reason ?? `Rolled back to version ${targetVersionId}`,
      approvalRequired: options.approvalRequired ?? false,
      versionId: options.versionId ?? null,
      previousVersionId: options.previousVersionId ?? null,
      metadata: {
        ...(options.metadata ?? {}),
        targetVersionId,
      },
    });

    this.addEntry(entry);
    return entry;
  }

  /**
   * Records an approval for a pending configuration change.
   *
   * @param auditId - Audit ID of the entry being approved
   * @param approvedBy - Who approved the change
   * @param reason - Approval reason (optional)
   * @returns Updated audit entry or null if not found
   */
  public recordApproval(
    auditId: string,
    approvedBy: string,
    reason: string | null = null,
  ): ConfigAuditEntry | null {
    const entry = this.findEntry(auditId);
    if (!entry) {
      return null;
    }

    entry.approvalStatus = "approved";
    entry.approvedBy = approvedBy;
    entry.approvedAt = nowIso();

    this.emitAuditEvent("config.audit.approved", entry);

    return entry;
  }

  /**
   * Records a rejection of a pending configuration change.
   *
   * @param auditId - Audit ID of the entry being rejected
   * @param rejectedBy - Who rejected the change
   * @param reason - Rejection reason
   * @returns Updated audit entry or null if not found
   */
  public recordRejection(
    auditId: string,
    rejectedBy: string,
    reason: string | null = null,
  ): ConfigAuditEntry | null {
    const entry = this.findEntry(auditId);
    if (!entry) {
      return null;
    }

    entry.approvalStatus = "rejected";
    entry.approvedBy = rejectedBy;
    entry.approvedAt = nowIso();

    this.emitAuditEvent("config.audit.rejected", entry);

    return entry;
  }

  /**
   * Queries audit entries with filtering and pagination.
   *
   * @param query - Query options
   * @returns Matching audit entries with pagination info
   */
  public query(query: ConfigAuditQuery = {}): ConfigAuditResult {
    const allEntries = this.getAllEntries();
    let filtered = allEntries.filter((entry) => this.matchesQuery(entry, query));

    // Sort by timestamp descending (newest first)
    filtered.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    const totalCount = filtered.length;

    // Apply pagination
    const offset = query.offset ?? 0;
    const limit = query.limit ?? 50;
    const paginatedEntries = filtered.slice(offset, offset + limit);

    return {
      entries: paginatedEntries,
      totalCount,
      hasMore: offset + paginatedEntries.length < totalCount,
    };
  }

  /**
   * Gets all audit entries for a specific config path.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns All matching audit entries (newest first)
   */
  public getEntriesForConfig(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): ConfigAuditEntry[] {
    return this.getAllEntries()
      .filter(
        (entry) =>
          entry.configPath === configPath &&
          entry.layer === layer &&
          entry.sourceId === sourceId,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  /**
   * Gets pending approval entries.
   *
   * @param layer - Optional filter by layer
   * @param limit - Maximum entries to return
   * @returns Pending approval entries
   */
  public getPendingApprovals(
    layer?: string | null,
    limit: number = 50,
  ): ConfigAuditEntry[] {
    return this.getAllEntries()
      .filter(
        (entry) =>
          entry.approvalRequired &&
          entry.approvalStatus === "pending" &&
          (layer === undefined || layer === null || entry.layer === layer),
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, limit);
  }

  /**
   * Gets a specific audit entry by ID.
   *
   * @param auditId - Audit entry ID
   * @returns The audit entry or null if not found
   */
  public getEntry(auditId: string): ConfigAuditEntry | null {
    return this.findEntry(auditId);
  }

  /**
   * Gets audit statistics for a config path.
   *
   * @param configPath - Dot-notation config path
   * @param layer - Hierarchy layer
   * @param sourceId - Source ID if applicable
   * @returns Statistics about the audit trail
   */
  public getStats(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): {
    totalEntries: number;
    createCount: number;
    updateCount: number;
    deleteCount: number;
    rollbackCount: number;
    pendingApprovalCount: number;
    firstEntryAt: string | null;
    lastEntryAt: string | null;
  } {
    const entries = this.getEntriesForConfig(configPath, layer, sourceId);

    return {
      totalEntries: entries.length,
      createCount: entries.filter((e) => e.action === "create").length,
      updateCount: entries.filter((e) => e.action === "update").length,
      deleteCount: entries.filter((e) => e.action === "delete").length,
      rollbackCount: entries.filter((e) => e.action === "rollback").length,
      pendingApprovalCount: entries.filter(
        (e) => e.approvalRequired && e.approvalStatus === "pending",
      ).length,
      firstEntryAt: entries.at(-1)?.timestamp ?? null,
      lastEntryAt: entries[0]?.timestamp ?? null,
    };
  }

  /**
   * Cleans up old audit entries beyond maxEntriesPerPath and maxEntryAgeMs.
   *
   * @returns Number of entries cleaned up
   */
  public pruneOldEntries(): number {
    if (this.useDurableStorage && this.sqliteDb) {
      // For durable storage, use SQL-based pruning
      const cutoffTime = new Date(Date.now() - this.maxEntryAgeMs).toISOString();

      // Delete entries older than maxEntryAgeMs
      execute(
        this.sqliteDb,
        `DELETE FROM config_audit_entries WHERE timestamp < ?`,
        cutoffTime,
      );

      // For maxEntriesPerPath, we need to count per path and prune excess
      interface PathCount { path_key: string; cnt: number; }
      const pathCounts = queryAllOrEmpty<PathCount>(
        this.sqliteDb,
        `SELECT config_path || ':' || layer || ':' || COALESCE(source_id, 'null') as path_key, COUNT(*) as cnt
         FROM config_audit_entries
         GROUP BY config_path, layer, source_id
         HAVING cnt > ?`,
        this.maxEntriesPerPath,
      );

      let totalPruned = 0;
      for (const { path_key } of pathCounts) {
        // Parse path_key back to components
        const parts = path_key.split(':');
        const configPath = parts[0] ?? '';
        const layer = parts[1] ?? '';
        const sourceId = parts[2] === 'null' ? null : (parts[2] ?? null);

        // Get IDs to delete (keep most recent maxEntriesPerPath)
        interface AuditIdRow { audit_id: string; }
        const idsToDelete = queryAllOrEmpty<AuditIdRow>(
          this.sqliteDb,
          `SELECT audit_id FROM config_audit_entries
           WHERE config_path = ? AND layer = ? AND COALESCE(source_id, '') = COALESCE(?, '')
           ORDER BY timestamp DESC
           LIMIT -1 OFFSET ?`,
          configPath,
          layer,
          sourceId,
          this.maxEntriesPerPath,
        );

        for (const { audit_id } of idsToDelete) {
          this.deleteEntryFromDb(audit_id);
          totalPruned++;
        }
      }

      return totalPruned;
    }

    // In-memory fallback
    const cutoffTime = Date.now() - this.maxEntryAgeMs;
    const toRemove: number[] = [];

    for (let i = 0; i < this.entries.length; i++) {
      const entry = this.entries[i]!;
      const entryTime = new Date(entry.timestamp).getTime();

      // Count entries for this config path
      const pathKey = this.buildPathKey(entry.configPath, entry.layer, entry.sourceId);
      const countForPath = this.entries.filter(
        (e) => this.buildPathKey(e.configPath, e.layer, e.sourceId) === pathKey,
      ).length;

      if (entryTime < cutoffTime || countForPath > this.maxEntriesPerPath) {
        toRemove.push(i);
      }
    }

    // Remove in reverse order to maintain indices
    for (let i = toRemove.length - 1; i >= 0; i--) {
      this.entries.splice(toRemove[i]!, 1);
    }

    return toRemove.length;
  }

  /**
   * Creates a new audit entry with common fields.
   */
  private createEntry(params: {
    configPath: string;
    layer: string;
    sourceId: string | null;
    action: ConfigAuditAction;
    actor: string | null;
    beforeHash: string | null;
    afterHash: string | null;
    changes: ConfigDiffEntry[];
    reason: string | null;
    approvalRequired: boolean;
    versionId: string | null;
    previousVersionId: string | null;
    metadata: Record<string, unknown> | null;
  }): ConfigAuditEntry {
    return {
      auditId: newId("caud"),
      configPath: params.configPath,
      layer: params.layer,
      sourceId: params.sourceId,
      action: params.action,
      actor: params.actor,
      timestamp: nowIso(),
      beforeHash: params.beforeHash,
      afterHash: params.afterHash,
      changes: params.changes,
      reason: params.reason,
      approvalRequired: params.approvalRequired,
      approvalStatus: params.approvalRequired ? "pending" : null,
      approvedBy: null,
      approvedAt: null,
      versionId: params.versionId,
      previousVersionId: params.previousVersionId,
      metadata: params.metadata,
    };
  }

  /**
   * Adds an entry and emits events.
   */
  private addEntry(entry: ConfigAuditEntry): void {
    if (this.useDurableStorage) {
      this.saveEntryToDb(entry);
    }
    this.entries.push(entry);
    this.emitAuditEvent("config.audit.recorded", entry);
  }

  /**
   * Finds an entry by ID.
   */
  private findEntry(auditId: string): ConfigAuditEntry | null {
    if (this.useDurableStorage && this.sqliteDb) {
      interface AuditRow {
        audit_id: string;
        config_path: string;
        layer: string;
        source_id: string | null;
        action: string;
        actor: string | null;
        timestamp: string;
        before_hash: string | null;
        after_hash: string | null;
        changes: string;
        reason: string | null;
        approval_required: number;
        approval_status: string | null;
        approved_by: string | null;
        approved_at: string | null;
        version_id: string | null;
        previous_version_id: string | null;
        metadata: string | null;
      }
      const rows = queryAllOrEmpty<AuditRow>(
        this.sqliteDb,
        `SELECT * FROM config_audit_entries WHERE audit_id = ?`,
        auditId,
      );
      if (rows.length === 0) return null;
      const row = rows[0]!;
      return {
        auditId: row.audit_id,
        configPath: row.config_path,
        layer: row.layer,
        sourceId: row.source_id,
        action: row.action as ConfigAuditAction,
        actor: row.actor,
        timestamp: row.timestamp,
        beforeHash: row.before_hash,
        afterHash: row.after_hash,
        changes: JSON.parse(row.changes),
        reason: row.reason,
        approvalRequired: row.approval_required === 1,
        approvalStatus: row.approval_status as ConfigApprovalStatus | null,
        approvedBy: row.approved_by,
        approvedAt: row.approved_at,
        versionId: row.version_id,
        previousVersionId: row.previous_version_id,
        metadata: row.metadata ? JSON.parse(row.metadata) : null,
      };
    }
    return this.entries.find((e) => e.auditId === auditId) ?? null;
  }

  /**
   * Checks if an entry matches query filters.
   */
  private matchesQuery(entry: ConfigAuditEntry, query: ConfigAuditQuery): boolean {
    if (query.configPath !== undefined && query.configPath !== null) {
      if (query.configPath.includes("*")) {
        // Prefix match
        const prefix = query.configPath.replace(/\*$/, "");
        if (!entry.configPath.startsWith(prefix)) {
          return false;
        }
      } else if (entry.configPath !== query.configPath) {
        return false;
      }
    }

    if (query.layer !== undefined && query.layer !== null && entry.layer !== query.layer) {
      return false;
    }

    if (query.sourceId !== undefined && query.sourceId !== null && entry.sourceId !== query.sourceId) {
      return false;
    }

    if (query.actor !== undefined && query.actor !== null && entry.actor !== query.actor) {
      return false;
    }

    if (query.action !== undefined && query.action !== null && entry.action !== query.action) {
      return false;
    }

    if (query.approvalStatus !== undefined && query.approvalStatus !== null && entry.approvalStatus !== query.approvalStatus) {
      return false;
    }

    if (query.startTime !== undefined && query.startTime !== null) {
      if (entry.timestamp < query.startTime) {
        return false;
      }
    }

    if (query.endTime !== undefined && query.endTime !== null) {
      if (entry.timestamp > query.endTime) {
        return false;
      }
    }

    return true;
  }

  /**
   * Builds a unique key for a config path.
   */
  private buildPathKey(configPath: string, layer: string, sourceId: string | null): string {
    return `${layer}:${sourceId ?? "null"}:${configPath}`;
  }

  /**
   * Emits an audit event to the event bus.
   */
  private emitAuditEvent(eventType: string, entry: ConfigAuditEntry): void {
    if (!this.eventBus) {
      return;
    }

    this.eventBus.publish({
      eventType,
      payload: {
        auditId: entry.auditId,
        configPath: entry.configPath,
        layer: entry.layer,
        sourceId: entry.sourceId,
        action: entry.action,
        actor: entry.actor,
        timestamp: entry.timestamp,
        beforeHash: entry.beforeHash,
        afterHash: entry.afterHash,
        changes: entry.changes,
        reason: entry.reason,
        approvalRequired: entry.approvalRequired,
        approvalStatus: entry.approvalStatus,
        approvedBy: entry.approvedBy,
        approvedAt: entry.approvedAt,
        versionId: entry.versionId,
        previousVersionId: entry.previousVersionId,
      },
    });
  }
}
