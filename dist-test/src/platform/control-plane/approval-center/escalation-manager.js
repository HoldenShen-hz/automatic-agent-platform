/**
 * @fileoverview Escalation Manager
 *
 * Handles escalation of approval requests when thresholds are exceeded,
 * including delegation with TTL reset support.
 *
 * @see §21 HITL Architecture - Escalation support
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import { ValidationError } from "../../contracts/errors.js";
/**
 * Notification channel types.
 */
export var NotificationChannelType;
(function (NotificationChannelType) {
    NotificationChannelType["EMAIL"] = "email";
    NotificationChannelType["SLACK"] = "slack";
    NotificationChannelType["FEISHU"] = "feishu";
    NotificationChannelType["WEBHOOK"] = "webhook";
})(NotificationChannelType || (NotificationChannelType = {}));
/**
 * Priority level for notifications.
 */
export var NotificationPriority;
(function (NotificationPriority) {
    NotificationPriority["HIGH"] = "high";
    NotificationPriority["NORMAL"] = "normal";
    NotificationPriority["LOW"] = "low";
})(NotificationPriority || (NotificationPriority = {}));
/**
 * Reasons for escalation.
 */
export var EscalationReason;
(function (EscalationReason) {
    EscalationReason["TIMEOUT"] = "timeout";
    EscalationReason["QUORUM_NOT_MET"] = "quorum_not_met";
    EscalationReason["MANUAL"] = "manual";
    EscalationReason["CRITICAL_RISK"] = "critical_risk";
})(EscalationReason || (EscalationReason = {}));
/**
 * Status of a delegation.
 */
export var DelegationStatus;
(function (DelegationStatus) {
    DelegationStatus["ACTIVE"] = "active";
    DelegationStatus["EXPIRED"] = "expired";
    DelegationStatus["REVOKED"] = "revoked";
    DelegationStatus["COMPLETED"] = "completed";
})(DelegationStatus || (DelegationStatus = {}));
/**
 * Default escalation timeout in milliseconds (30 minutes).
 */
const DEFAULT_ESCALATION_TIMEOUT_MS = 30 * 60 * 1000;
/**
 * Default delegation TTL in milliseconds (2 hours).
 */
const DEFAULT_DELEGATION_TTL_MS = 2 * 60 * 60 * 1000;
/**
 * Maximum delegation resets allowed.
 */
const DEFAULT_MAX_TTL_RESETS = 3;
/**
 * Manages escalation of approval requests.
 */
export class EscalationManager {
    defaultTimeoutMs;
    logger = new StructuredLogger({ retentionLimit: 50 });
    escalationHistory = new Map();
    delegations = new Map();
    // C-11: TTL-based eviction to prevent memory leaks
    MAX_ENTRIES = 500;
    ENTRY_TTL_MS = 30 * 60 * 1000; // 30 minutes
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
    constructor(defaultTimeoutMs = DEFAULT_ESCALATION_TIMEOUT_MS) {
        this.defaultTimeoutMs = defaultTimeoutMs;
    }
    /**
     * C-11: Evict expired escalation entries to prevent memory leaks.
     */
    evictExpiredEntries() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.ENTRY_TTL_MS;
        const entriesToDelete = [];
        // Find expired escalationHistory entries
        for (const [approvalId, history] of this.escalationHistory) {
            if (history.length > 0) {
                const lastEscalationTime = new Date(history[history.length - 1].escalatedAt).getTime();
                if (lastEscalationTime < expiryThreshold) {
                    entriesToDelete.push(approvalId);
                }
            }
        }
        for (const approvalId of entriesToDelete) {
            this.escalationHistory.delete(approvalId);
            this.delegations.delete(approvalId);
        }
        // If still over capacity, remove oldest entries
        if (this.escalationHistory.size > this.MAX_ENTRIES) {
            const sortedEntries = [...this.escalationHistory.entries()].sort((a, b) => {
                const aTime = a[1].length > 0 ? new Date(a[1][a[1].length - 1].escalatedAt).getTime() : 0;
                const bTime = b[1].length > 0 ? new Date(b[1][b[1].length - 1].escalatedAt).getTime() : 0;
                return aTime - bTime;
            });
            const toRemove = this.escalationHistory.size - this.MAX_ENTRIES;
            for (let i = 0; i < toRemove; i++) {
                const approvalId = sortedEntries[i][0];
                this.escalationHistory.delete(approvalId);
                this.delegations.delete(approvalId);
            }
        }
    }
    /**
     * Checks if escalation is possible within the max depth.
     *
     * @param currentLevel - Current escalation level
     * @param maxDepth - Maximum allowed escalation depth
     * @returns True if further escalation is allowed
     */
    canEscalate(currentLevel, maxDepth) {
        return currentLevel < maxDepth;
    }
    /**
     * Creates a new escalation level.
     *
     * @param context - Escalation context
     * @param rule - Escalation rule to apply
     * @returns The new escalation level
     */
    createEscalation(context, rule) {
        // C-11: Evict expired entries before creating new one
        this.evictExpiredEntries();
        const newLevel = context.currentLevel + 1;
        if (!this.canEscalate(newLevel, rule.maxEscalationDepth)) {
            throw new ValidationError("escalation.max_depth_exceeded", `Cannot escalate beyond max depth of ${rule.maxEscalationDepth}`, { details: { currentLevel: context.currentLevel, maxDepth: rule.maxEscalationDepth } });
        }
        const escalation = {
            level: newLevel,
            escalateTo: rule.escalateTo,
            escalatedAt: nowIso(),
            escalatedBy: "system",
            reason: context.reason,
            sourceApprovalId: context.approvalId,
        };
        // Store in history
        const history = this.escalationHistory.get(context.approvalId) ?? [];
        this.escalationHistory.set(context.approvalId, [...history, escalation]);
        this.logger.info("Escalation created", {
            approvalId: context.approvalId,
            newLevel,
            reason: context.reason,
            escalateTo: rule.escalateTo,
        });
        return escalation;
    }
    /**
     * Performs escalation for an approval request.
     *
     * @param context - Escalation context
     * @param rule - Escalation rule to apply
     * @returns Result of the escalation operation
     */
    async escalate(context, rule) {
        try {
            const newLevel = this.createEscalation(context, rule);
            // Notify channels
            await this.notifyChannels(rule.notificationChannels, {
                title: `Approval Escalated - Level ${newLevel.level}`,
                body: `Approval ${context.approvalId} has been escalated to ${rule.escalateTo.identifier}`,
                metadata: {
                    taskId: context.taskId,
                    executionId: context.executionId,
                    escalationLevel: newLevel.level,
                    reason: context.reason,
                },
                priority: NotificationPriority.HIGH,
            });
            return { success: true, newLevel };
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            this.logger.error("Escalation failed", { approvalId: context.approvalId, error: message });
            return { success: false, error: message };
        }
    }
    /**
     * Creates a delegation from one approver to another.
     *
     * @param fromApprover - Original approver
     * @param toApprover - Delegated approver
     * @param approvalId - Approval ID being delegated
     * @param ttlMs - Time-to-live in milliseconds
     * @param maxTtlResets - Maximum number of TTL resets allowed
     * @returns The created delegation
     */
    createDelegation(fromApprover, toApprover, approvalId, ttlMs = DEFAULT_DELEGATION_TTL_MS, maxTtlResets = DEFAULT_MAX_TTL_RESETS) {
        if (fromApprover === toApprover) {
            throw new ValidationError("delegation.self_delegation", "Cannot delegate to yourself", { details: { fromApprover, toApprover } });
        }
        const delegation = {
            delegationId: newId("delegation"),
            fromApprover,
            toApprover,
            delegatedAt: nowIso(),
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            originalApprovalId: approvalId,
            ttlResetCount: 0,
            maxTtlResets,
            status: DelegationStatus.ACTIVE,
        };
        this.delegations.set(delegation.delegationId, delegation);
        this.logger.info("Delegation created", {
            delegationId: delegation.delegationId,
            fromApprover,
            toApprover,
            approvalId,
            expiresAt: delegation.expiresAt,
        });
        return delegation;
    }
    /**
     * Checks if a delegation has expired.
     *
     * @param delegation - Delegation to check
     * @returns True if the delegation has expired
     */
    isDelegationExpired(delegation) {
        if (delegation.status !== DelegationStatus.ACTIVE) {
            return delegation.status === DelegationStatus.EXPIRED;
        }
        return new Date(delegation.expiresAt).getTime() <= Date.now();
    }
    /**
     * Resets the TTL of an active delegation.
     * Only allowed if reset count is below max.
     *
     * @param delegation - Delegation to reset
     * @param ttlMs - New TTL in milliseconds
     * @returns Updated delegation
     * @throws Error if max resets exceeded
     */
    resetDelegationTtl(delegation, ttlMs = DEFAULT_DELEGATION_TTL_MS) {
        if (delegation.ttlResetCount >= delegation.maxTtlResets) {
            throw new ValidationError("delegation.max_resets_exceeded", `Cannot reset TTL more than ${delegation.maxTtlResets} times`, { details: { delegationId: delegation.delegationId, ttlResetCount: delegation.ttlResetCount } });
        }
        if (delegation.status !== DelegationStatus.ACTIVE) {
            throw new ValidationError("delegation.not_active", "Cannot reset TTL on inactive delegation", { details: { delegationId: delegation.delegationId, status: delegation.status } });
        }
        const updated = {
            ...delegation,
            expiresAt: new Date(Date.now() + ttlMs).toISOString(),
            ttlResetCount: delegation.ttlResetCount + 1,
        };
        this.delegations.set(delegation.delegationId, updated);
        this.logger.info("Delegation TTL reset", {
            delegationId: delegation.delegationId,
            newExpiresAt: updated.expiresAt,
            resetCount: updated.ttlResetCount,
        });
        return updated;
    }
    /**
     * Revokes a delegation.
     *
     * @param delegationId - ID of delegation to revoke
     */
    revokeDelegation(delegationId) {
        const delegation = this.delegations.get(delegationId);
        if (!delegation) {
            throw new ValidationError("delegation.not_found", `Delegation not found: ${delegationId}`);
        }
        const updated = {
            ...delegation,
            status: DelegationStatus.REVOKED,
        };
        this.delegations.set(delegationId, updated);
        this.logger.info("Delegation revoked", { delegationId });
    }
    /**
     * Marks a delegation as completed.
     *
     * @param delegationId - ID of delegation to complete
     */
    completeDelegation(delegationId) {
        const delegation = this.delegations.get(delegationId);
        if (!delegation) {
            throw new ValidationError("delegation.not_found", `Delegation not found: ${delegationId}`);
        }
        const updated = {
            ...delegation,
            status: DelegationStatus.COMPLETED,
        };
        this.delegations.set(delegationId, updated);
        this.logger.info("Delegation completed", { delegationId });
    }
    /**
     * Gets a delegation by ID.
     *
     * @param delegationId - ID to look up
     * @returns Delegation or undefined
     */
    getDelegation(delegationId) {
        return this.delegations.get(delegationId);
    }
    /**
     * Gets the active delegation for an approval.
     *
     * @param approvalId - Approval to find delegation for
     * @returns Active delegation or undefined
     */
    getActiveDelegationForApproval(approvalId) {
        for (const delegation of this.delegations.values()) {
            if (delegation.originalApprovalId === approvalId &&
                delegation.status === DelegationStatus.ACTIVE &&
                !this.isDelegationExpired(delegation)) {
                return delegation;
            }
        }
        return undefined;
    }
    /**
     * Gets the escalation history for an approval.
     *
     * @param approvalId - Approval to get history for
     * @returns Array of escalation levels
     */
    getEscalationHistory(approvalId) {
        return this.escalationHistory.get(approvalId) ?? [];
    }
    /**
     * Gets the current escalation level for an approval.
     *
     * @param approvalId - Approval to check
     * @returns Current level or 0 if not escalated
     */
    getCurrentEscalationLevel(approvalId) {
        const history = this.escalationHistory.get(approvalId) ?? [];
        if (history.length === 0)
            return 0;
        return Math.max(...history.map((h) => h.level));
    }
    /**
     * Notifies all enabled notification channels.
     * This is fire-and-forget; errors are logged but don't block.
     *
     * @param channels - Channels to notify
     * @param message - Message to send
     */
    async notifyChannels(channels, message) {
        const promises = channels
            .filter((ch) => ch.enabled)
            .map((channel) => this.sendNotification(channel, message));
        // Fire and forget - log any errors but don't throw
        Promise.allSettled(promises).then((results) => {
            for (const result of results) {
                if (result.status === "rejected") {
                    this.logger.warn("Notification failed", {
                        error: result.reason,
                        channel: result.reason?.channel,
                    });
                }
            }
        });
    }
    /**
     * Sends a notification to a single channel.
     *
     * @param channel - Channel to send to
     * @param message - Message to send
     * @returns Promise that resolves when sent
     */
    async sendNotification(channel, message) {
        switch (channel.type) {
            case NotificationChannelType.EMAIL:
                await this.sendEmail(channel, message);
                break;
            case NotificationChannelType.SLACK:
            case NotificationChannelType.FEISHU:
                await this.sendWebhook(channel, message);
                break;
            case NotificationChannelType.WEBHOOK:
                await this.sendWebhook(channel, message);
                break;
        }
    }
    /**
     * Sends an email notification.
     */
    async sendEmail(channel, message) {
        // Email implementation would integrate with SMTP adapter
        this.logger.info("Email notification", {
            to: channel.address,
            title: message.title,
            priority: message.priority,
        });
        // Placeholder for actual email integration
    }
    /**
     * Sends a webhook notification.
     */
    async sendWebhook(channel, message) {
        // Webhook implementation would make HTTP request
        this.logger.info("Webhook notification", {
            url: channel.address,
            title: message.title,
            priority: message.priority,
        });
        // Placeholder for actual webhook implementation
    }
    /**
     * Creates an escalation context for a timeout.
     *
     * @param approvalId - Approval ID
     * @param taskId - Task ID
     * @param executionId - Execution ID
     * @param currentLevel - Current escalation level
     * @returns Escalation context
     */
    createTimeoutContext(approvalId, taskId, executionId, currentLevel) {
        return {
            approvalId,
            taskId,
            executionId,
            currentLevel,
            reason: EscalationReason.TIMEOUT,
        };
    }
    /**
     * Creates an escalation context for quorum not met.
     */
    createQuorumNotMetContext(approvalId, taskId, executionId, currentLevel) {
        return {
            approvalId,
            taskId,
            executionId,
            currentLevel,
            reason: EscalationReason.QUORUM_NOT_MET,
        };
    }
}
//# sourceMappingURL=escalation-manager.js.map