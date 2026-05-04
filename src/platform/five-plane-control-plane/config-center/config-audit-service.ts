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

import { DurableEventBus } from "../../state-evidence/events/durable-event-bus.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import {
  diffObjects,
  sha256,
  stableStringify,
  type ConfigDiffEntry,
} from "./config-governance-support.js";

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
  /** Hierarchy layer (platform, environment, tenant, pack, runtime) per §24.1 */
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
  /** Event bus for emitting and subscribing to audit events */
  eventBus?: DurableEventBus | null;
  /** Maximum number of audit entries to retain per config path (default: 1000) */
  maxEntriesPerPath?: number;
  /** Maximum age of audit entries in milliseconds (default: 90 days) */
  maxEntryAgeMs?: number;
  /** Whether to persist events for replay on startup (default: true) */
  persistEvents?: boolean;
}

/**
 * Event payload for audit entry creation (for event sourcing).
 */
interface ConfigAuditEntryPayload {
  auditId: string;
  configPath: string;
  layer: string;
  sourceId: string | null;
  action: ConfigAuditAction;
  actor: string | null;
  timestamp: string;
  beforeHash: string | null;
  afterHash: string | null;
  changes: ConfigDiffEntry[];
  reason: string | null;
  approvalRequired: boolean;
  approvalStatus: ConfigApprovalStatus | null;
  approvedBy: string | null;
  approvedAt: string | null;
  versionId: string | null;
  previousVersionId: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Service for auditing configuration changes.
 * Per §24.4: Implements event sourcing for who/when/what/why compliance persistence.
 *
 * Maintains a complete audit trail recording:
 * - Who made each change
 * - When the change occurred
 * - What specifically changed (detailed diff)
 * - Why the change was made (reason)
 * - Approval status for protected configurations
 *
 * Supports querying audit history for compliance and investigation.
 */
export class ConfigAuditService {
  private readonly eventBus: DurableEventBus | null;
  private readonly maxEntriesPerPath: number;
  private readonly maxEntryAgeMs: number;
  private readonly persistEvents: boolean;
  private _initialized = false;

  /** In-memory storage for audit entries (rebuilt from events on init) */
  private readonly entries: ConfigAuditEntry[] = [];

  public constructor(options: ConfigAuditServiceOptions = {}) {
    this.eventBus = options.eventBus ?? null;
    this.maxEntriesPerPath = options.maxEntriesPerPath ?? 1000;
    this.maxEntryAgeMs = options.maxEntryAgeMs ?? 90 * 24 * 60 * 60 * 1000;
    this.persistEvents = options.persistEvents ?? true;
  }

  /**
   * Initializes the service by subscribing to events and rebuilding state.
   * Must be called before using the service if persistEvents is enabled.
   */
  public async initialize(): Promise<void> {
    if (this._initialized || !this.eventBus) {
      this._initialized = true;
      return;
    }

    // Subscribe to audit events for replay
    await this.eventBus.subscribe(
      "config.audit.recorded",
      async (event) => {
        const payload = JSON.parse(event.payloadJson) as ConfigAuditEntryPayload;
        this.handleAuditRecordedEvent(payload);
      },
    );

    this._initialized = true;
  }

  /**
   * Ensures the service is initialized before operations.
   * Calls initialize() if not already initialized.
   * §24.4: Ensures audit entries are rebuilt from persisted events on startup.
   */
  private async ensureInitialized(): Promise<void> {
    if (!this._initialized) {
      await this.initialize();
    }
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
  public async query(query: ConfigAuditQuery = {}): Promise<ConfigAuditResult> {
    await this.ensureInitialized();
    let filtered = this.entries.filter((entry) => this.matchesQuery(entry, query));

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
  public async getEntriesForConfig(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<ConfigAuditEntry[]> {
    await this.ensureInitialized();
    return this.entries
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
  public async getPendingApprovals(
    layer?: string | null,
    limit: number = 50,
  ): Promise<ConfigAuditEntry[]> {
    await this.ensureInitialized();
    return this.entries
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
  public async getEntry(auditId: string): Promise<ConfigAuditEntry | null> {
    await this.ensureInitialized();
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
  public async getStats(
    configPath: string,
    layer: string,
    sourceId: string | null,
  ): Promise<{
    totalEntries: number;
    createCount: number;
    updateCount: number;
    deleteCount: number;
    rollbackCount: number;
    pendingApprovalCount: number;
    firstEntryAt: string | null;
    lastEntryAt: string | null;
  }> {
    const entries = await this.getEntriesForConfig(configPath, layer, sourceId);

    return {
      totalEntries: entries.length,
      createCount: entries.filter((e) => e.action === "create").length,
      updateCount: entries.filter((e) => e.action === "update").length,
      deleteCount: entries.filter((e) => e.action === "delete").length,
      rollbackCount: entries.filter((e) => e.action === "rollback").length,
      pendingApprovalCount: entries.filter(
        (e) => e.approvalRequired && e.approvalStatus === "pending",
      ).length,
      firstEntryAt: entries.length > 0 ? entries[entries.length - 1]!.timestamp : null,
      lastEntryAt: entries.length > 0 ? entries[0]!.timestamp : null,
    };
  }

  /**
   * Cleans up old audit entries beyond maxEntriesPerPath and maxEntryAgeMs.
   *
   * @returns Number of entries cleaned up
   */
  public pruneOldEntries(): number {
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
    this.entries.push(entry);
    this.emitAuditEvent("config.audit.recorded", entry);
  }

  /**
   * Finds an entry by ID.
   */
  private findEntry(auditId: string): ConfigAuditEntry | null {
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
        metadata: entry.metadata,
      },
    });
  }

  /**
   * Handles audit recorded event for event sourcing replay.
   */
  private handleAuditRecordedEvent(payload: ConfigAuditEntryPayload): void {
    // Only add if not already present (idempotent replay)
    const existing = this.entries.find((e) => e.auditId === payload.auditId);
    if (existing) {
      return;
    }

    const entry: ConfigAuditEntry = {
      auditId: payload.auditId,
      configPath: payload.configPath,
      layer: payload.layer,
      sourceId: payload.sourceId,
      action: payload.action,
      actor: payload.actor,
      timestamp: payload.timestamp,
      beforeHash: payload.beforeHash,
      afterHash: payload.afterHash,
      changes: payload.changes,
      reason: payload.reason,
      approvalRequired: payload.approvalRequired,
      approvalStatus: payload.approvalStatus,
      approvedBy: payload.approvedBy,
      approvedAt: payload.approvedAt,
      versionId: payload.versionId,
      previousVersionId: payload.previousVersionId,
      metadata: payload.metadata,
    };

    this.entries.push(entry);
  }
}
