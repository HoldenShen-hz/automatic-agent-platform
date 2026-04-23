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
import { newId, nowIso } from "../../contracts/types/ids.js";
import { diffObjects, sha256, stableStringify, } from "./config-governance-support.js";
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
export class ConfigAuditService {
    eventBus;
    maxEntriesPerPath;
    maxEntryAgeMs;
    /** In-memory storage for audit entries */
    entries = [];
    constructor(options = {}) {
        this.eventBus = options.eventBus ?? null;
        this.maxEntriesPerPath = options.maxEntriesPerPath ?? 1000;
        this.maxEntryAgeMs = options.maxEntryAgeMs ?? 90 * 24 * 60 * 60 * 1000;
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
    recordCreate(configPath, layer, sourceId, content, actor, reason = null, options = {}) {
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
    recordUpdate(configPath, layer, sourceId, beforeContent, afterContent, actor, reason = null, options = {}) {
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
    recordDelete(configPath, layer, sourceId, beforeContent, actor, reason = null, options = {}) {
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
    recordRollback(configPath, layer, sourceId, beforeContent, afterContent, targetVersionId, actor, reason = null, options = {}) {
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
    recordApproval(auditId, approvedBy, reason = null) {
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
    recordRejection(auditId, rejectedBy, reason = null) {
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
    query(query = {}) {
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
    getEntriesForConfig(configPath, layer, sourceId) {
        return this.entries
            .filter((entry) => entry.configPath === configPath &&
            entry.layer === layer &&
            entry.sourceId === sourceId)
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    }
    /**
     * Gets pending approval entries.
     *
     * @param layer - Optional filter by layer
     * @param limit - Maximum entries to return
     * @returns Pending approval entries
     */
    getPendingApprovals(layer, limit = 50) {
        return this.entries
            .filter((entry) => entry.approvalRequired &&
            entry.approvalStatus === "pending" &&
            (layer === undefined || layer === null || entry.layer === layer))
            .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
            .slice(0, limit);
    }
    /**
     * Gets a specific audit entry by ID.
     *
     * @param auditId - Audit entry ID
     * @returns The audit entry or null if not found
     */
    getEntry(auditId) {
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
    getStats(configPath, layer, sourceId) {
        const entries = this.getEntriesForConfig(configPath, layer, sourceId);
        return {
            totalEntries: entries.length,
            createCount: entries.filter((e) => e.action === "create").length,
            updateCount: entries.filter((e) => e.action === "update").length,
            deleteCount: entries.filter((e) => e.action === "delete").length,
            rollbackCount: entries.filter((e) => e.action === "rollback").length,
            pendingApprovalCount: entries.filter((e) => e.approvalRequired && e.approvalStatus === "pending").length,
            firstEntryAt: entries.length > 0 ? entries[entries.length - 1].timestamp : null,
            lastEntryAt: entries.length > 0 ? entries[0].timestamp : null,
        };
    }
    /**
     * Cleans up old audit entries beyond maxEntriesPerPath and maxEntryAgeMs.
     *
     * @returns Number of entries cleaned up
     */
    pruneOldEntries() {
        const cutoffTime = Date.now() - this.maxEntryAgeMs;
        const toRemove = [];
        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];
            const entryTime = new Date(entry.timestamp).getTime();
            // Count entries for this config path
            const pathKey = this.buildPathKey(entry.configPath, entry.layer, entry.sourceId);
            const countForPath = this.entries.filter((e) => this.buildPathKey(e.configPath, e.layer, e.sourceId) === pathKey).length;
            if (entryTime < cutoffTime || countForPath > this.maxEntriesPerPath) {
                toRemove.push(i);
            }
        }
        // Remove in reverse order to maintain indices
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.entries.splice(toRemove[i], 1);
        }
        return toRemove.length;
    }
    /**
     * Creates a new audit entry with common fields.
     */
    createEntry(params) {
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
    addEntry(entry) {
        this.entries.push(entry);
        this.emitAuditEvent("config.audit.recorded", entry);
    }
    /**
     * Finds an entry by ID.
     */
    findEntry(auditId) {
        return this.entries.find((e) => e.auditId === auditId) ?? null;
    }
    /**
     * Checks if an entry matches query filters.
     */
    matchesQuery(entry, query) {
        if (query.configPath !== undefined && query.configPath !== null) {
            if (query.configPath.includes("*")) {
                // Prefix match
                const prefix = query.configPath.replace(/\*$/, "");
                if (!entry.configPath.startsWith(prefix)) {
                    return false;
                }
            }
            else if (entry.configPath !== query.configPath) {
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
    buildPathKey(configPath, layer, sourceId) {
        return `${layer}:${sourceId ?? "null"}:${configPath}`;
    }
    /**
     * Emits an audit event to the event bus.
     */
    emitAuditEvent(eventType, entry) {
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
//# sourceMappingURL=config-audit-service.js.map