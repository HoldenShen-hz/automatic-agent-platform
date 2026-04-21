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
import { type ConfigDiffEntry } from "./config-governance-support.js";
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
 */
export declare class ConfigAuditService {
    private readonly eventBus;
    private readonly maxEntriesPerPath;
    private readonly maxEntryAgeMs;
    /** In-memory storage for audit entries */
    private readonly entries;
    constructor(options?: ConfigAuditServiceOptions);
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
    recordCreate(configPath: string, layer: string, sourceId: string | null, content: Record<string, unknown>, actor: string | null, reason?: string | null, options?: {
        approvalRequired?: boolean;
        versionId?: string;
        metadata?: Record<string, unknown>;
    }): ConfigAuditEntry;
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
    recordUpdate(configPath: string, layer: string, sourceId: string | null, beforeContent: Record<string, unknown>, afterContent: Record<string, unknown>, actor: string | null, reason?: string | null, options?: {
        approvalRequired?: boolean;
        versionId?: string;
        previousVersionId?: string;
        metadata?: Record<string, unknown>;
    }): ConfigAuditEntry;
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
    recordDelete(configPath: string, layer: string, sourceId: string | null, beforeContent: Record<string, unknown>, actor: string | null, reason?: string | null, options?: {
        approvalRequired?: boolean;
        previousVersionId?: string;
        metadata?: Record<string, unknown>;
    }): ConfigAuditEntry;
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
    recordRollback(configPath: string, layer: string, sourceId: string | null, beforeContent: Record<string, unknown>, afterContent: Record<string, unknown>, targetVersionId: string, actor: string | null, reason?: string | null, options?: {
        approvalRequired?: boolean;
        versionId?: string;
        previousVersionId?: string;
        metadata?: Record<string, unknown>;
    }): ConfigAuditEntry;
    /**
     * Records an approval for a pending configuration change.
     *
     * @param auditId - Audit ID of the entry being approved
     * @param approvedBy - Who approved the change
     * @param reason - Approval reason (optional)
     * @returns Updated audit entry or null if not found
     */
    recordApproval(auditId: string, approvedBy: string, reason?: string | null): ConfigAuditEntry | null;
    /**
     * Records a rejection of a pending configuration change.
     *
     * @param auditId - Audit ID of the entry being rejected
     * @param rejectedBy - Who rejected the change
     * @param reason - Rejection reason
     * @returns Updated audit entry or null if not found
     */
    recordRejection(auditId: string, rejectedBy: string, reason?: string | null): ConfigAuditEntry | null;
    /**
     * Queries audit entries with filtering and pagination.
     *
     * @param query - Query options
     * @returns Matching audit entries with pagination info
     */
    query(query?: ConfigAuditQuery): ConfigAuditResult;
    /**
     * Gets all audit entries for a specific config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns All matching audit entries (newest first)
     */
    getEntriesForConfig(configPath: string, layer: string, sourceId: string | null): ConfigAuditEntry[];
    /**
     * Gets pending approval entries.
     *
     * @param layer - Optional filter by layer
     * @param limit - Maximum entries to return
     * @returns Pending approval entries
     */
    getPendingApprovals(layer?: string | null, limit?: number): ConfigAuditEntry[];
    /**
     * Gets a specific audit entry by ID.
     *
     * @param auditId - Audit entry ID
     * @returns The audit entry or null if not found
     */
    getEntry(auditId: string): ConfigAuditEntry | null;
    /**
     * Gets audit statistics for a config path.
     *
     * @param configPath - Dot-notation config path
     * @param layer - Hierarchy layer
     * @param sourceId - Source ID if applicable
     * @returns Statistics about the audit trail
     */
    getStats(configPath: string, layer: string, sourceId: string | null): {
        totalEntries: number;
        createCount: number;
        updateCount: number;
        deleteCount: number;
        rollbackCount: number;
        pendingApprovalCount: number;
        firstEntryAt: string | null;
        lastEntryAt: string | null;
    };
    /**
     * Cleans up old audit entries beyond maxEntriesPerPath and maxEntryAgeMs.
     *
     * @returns Number of entries cleaned up
     */
    pruneOldEntries(): number;
    /**
     * Creates a new audit entry with common fields.
     */
    private createEntry;
    /**
     * Adds an entry and emits events.
     */
    private addEntry;
    /**
     * Finds an entry by ID.
     */
    private findEntry;
    /**
     * Checks if an entry matches query filters.
     */
    private matchesQuery;
    /**
     * Builds a unique key for a config path.
     */
    private buildPathKey;
    /**
     * Emits an audit event to the event bus.
     */
    private emitAuditEvent;
}
