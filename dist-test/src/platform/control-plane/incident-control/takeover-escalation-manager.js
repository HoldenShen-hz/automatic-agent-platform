/**
 * Takeover Escalation Manager
 *
 * Manages timeout tracking, escalation policies, and acknowledgment states
 * for takeover sessions.
 */
import { nowIso } from "../../contracts/types/ids.js";
import { WorkflowStateError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
/**
 * Manages escalation, timeout, and acknowledgment for takeover sessions.
 *
 * Responsibilities:
 * - Start/stop timeout timers for sessions
 * - Track acknowledgment status
 * - Manage escalation policies and levels
 * - Handle session auto-close at max escalation
 */
export class TakeoverEscalationManager {
    config;
    eventEmitter;
    onAutoClose;
    /** Active timeout timers keyed by sessionId. */
    activeTimeouts = new Map();
    /** Active escalation timers keyed by sessionId. */
    escalationTimers = new Map();
    /** Acknowledgment status tracking keyed by sessionId. */
    ackStatuses = new Map();
    /** Escalation policies keyed by sessionId. */
    escalationPolicies = new Map();
    logger = new StructuredLogger({ retentionLimit: 100 });
    // C-11: TTL-based eviction
    MAX_SESSION_ENTRIES = 500;
    SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
    lastEvictionTime = 0;
    EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute
    constructor(config, eventEmitter, onAutoClose) {
        this.config = config;
        this.eventEmitter = eventEmitter;
        this.onAutoClose = onAutoClose;
    }
    /**
     * Starts timeout and escalation tracking for a newly opened session.
     */
    startSessionTracking(sessionId, taskId) {
        this.startTimeoutTimer(sessionId, taskId, this.config.defaultTimeoutMs);
        this.initializeEscalationPolicy(sessionId, taskId);
    }
    /**
     * Stops all tracking (timeout and escalation) for a session.
     */
    stopSessionTracking(sessionId) {
        const timeout = this.activeTimeouts.get(sessionId);
        if (timeout) {
            clearTimeout(timeout);
            this.activeTimeouts.delete(sessionId);
        }
        const escalation = this.escalationTimers.get(sessionId);
        if (escalation) {
            clearTimeout(escalation);
            this.escalationTimers.delete(sessionId);
        }
        this.ackStatuses.delete(sessionId);
        this.escalationPolicies.delete(sessionId);
    }
    /**
     * Starts a timeout timer for a takeover session.
     * If the timeout expires before acknowledgment, the session is escalated.
     */
    startTimeoutTimer(sessionId, taskId, durationMs) {
        const existing = this.activeTimeouts.get(sessionId);
        if (existing)
            clearTimeout(existing);
        const timeout = setTimeout(() => {
            this.handleSessionTimeout(sessionId, taskId);
        }, durationMs);
        this.activeTimeouts.set(sessionId, timeout);
        this.logger.log({
            level: "debug",
            message: "takeover.timeout_started",
            data: { sessionId, taskId, durationMs },
        });
    }
    /**
     * Handles session timeout — escalates or auto-expires.
     */
    handleSessionTimeout(sessionId, taskId) {
        this.activeTimeouts.delete(sessionId);
        const ackStatus = this.ackStatuses.get(sessionId);
        const isAcknowledged = ackStatus?.status === "acknowledged";
        if (!isAcknowledged) {
            this.eventEmitter.emit("takeover:timeout", {
                sessionId,
                taskId,
                reason: "Session expired without operator acknowledgment",
                timedOutAt: nowIso(),
            });
            this.escalateSession(sessionId, taskId, "timeout").catch((err) => {
                this.logger.log({
                    level: "error",
                    message: "takeover.escalation_failed",
                    data: { sessionId, error: err instanceof Error ? err.message : String(err) },
                });
            });
        }
    }
    /**
     * Initializes escalation policy for a new session.
     */
    initializeEscalationPolicy(sessionId, taskId) {
        const policy = {
            sessionId,
            currentLevel: "operator",
            escalationHistory: [],
            nextEscalationAt: null,
        };
        this.escalationPolicies.set(sessionId, policy);
        this.scheduleEscalationCheck(sessionId, taskId);
        this.logger.log({
            level: "debug",
            message: "takeover.escalation_initialized",
            data: { sessionId, initialLevel: "operator" },
        });
    }
    /**
     * Schedules the next escalation check.
     */
    scheduleEscalationCheck(sessionId, taskId) {
        const existing = this.escalationTimers.get(sessionId);
        if (existing)
            clearTimeout(existing);
        const timer = setTimeout(async () => {
            await this.checkEscalation(sessionId, taskId);
        }, this.config.escalationCheckIntervalMs);
        this.escalationTimers.set(sessionId, timer);
    }
    /**
     * Checks if a session needs escalation and performs it if so.
     */
    async checkEscalation(sessionId, taskId) {
        const policy = this.escalationPolicies.get(sessionId);
        if (!policy)
            return;
        const ackStatus = this.ackStatuses.get(sessionId);
        const now = new Date();
        if (ackStatus?.expiresAt && new Date(ackStatus.expiresAt) <= now) {
            ackStatus.status = "expired";
            this.eventEmitter.emit("takeover:ack_expired", {
                sessionId,
                taskId,
                expiredAt: nowIso(),
            });
        }
        if (ackStatus?.status === "pending" || ackStatus?.status === "expired") {
            await this.escalateSession(sessionId, taskId, "no_acknowledgment");
        }
        else {
            this.scheduleEscalationCheck(sessionId, taskId);
        }
    }
    /**
     * Escalates a takeover session to the next level.
     */
    async escalateSession(sessionId, taskId, reason) {
        const policy = this.escalationPolicies.get(sessionId);
        if (!policy)
            return;
        const previousLevel = policy.currentLevel;
        const nextLevel = this.getNextEscalationLevel(previousLevel);
        policy.escalationHistory.push({
            level: nextLevel,
            reason,
            timestamp: nowIso(),
            target: null,
        });
        policy.currentLevel = nextLevel;
        const escalationDelayMs = this.getEscalationDelayForLevel(nextLevel);
        if (escalationDelayMs > 0) {
            policy.nextEscalationAt = new Date(Date.now() + escalationDelayMs).toISOString();
        }
        else {
            policy.nextEscalationAt = null;
        }
        this.eventEmitter.emit("takeover:escalated", {
            sessionId,
            taskId,
            fromLevel: previousLevel,
            toLevel: nextLevel,
            reason,
            escalatedAt: nowIso(),
        });
        this.logger.log({
            level: "warn",
            message: "takeover.session_escalated",
            data: { sessionId, taskId, fromLevel: previousLevel, toLevel: nextLevel, reason },
        });
        if (nextLevel !== "auto_close") {
            this.scheduleEscalationCheck(sessionId, taskId);
        }
        else if (this.onAutoClose) {
            await this.onAutoClose(sessionId, taskId);
        }
    }
    /**
     * Gets the next escalation level given the current level.
     */
    getNextEscalationLevel(current) {
        switch (current) {
            case "operator": return "supervisor";
            case "supervisor": return "admin";
            case "admin": return "auto_close";
            case "auto_close": return "auto_close";
        }
    }
    /**
     * Gets the escalation delay in ms for a given level.
     */
    getEscalationDelayForLevel(level) {
        switch (level) {
            case "operator": return this.config.defaultTimeoutMs;
            case "supervisor": return this.config.defaultTimeoutMs * 2;
            case "admin": return this.config.defaultTimeoutMs * 4;
            case "auto_close": return 0;
        }
    }
    // -------------------------------------------------------------------------
    // Acknowledgment Management
    // -------------------------------------------------------------------------
    /**
     * Acknowledges a takeover session — operator is now actively working.
     */
    acknowledgeSession(sessionId, operatorId, taskId) {
        const existing = this.ackStatuses.get(sessionId);
        const previousStatus = existing?.status ?? "pending";
        const now = nowIso();
        const expiresAt = new Date(Date.now() + this.config.acknowledgmentTimeoutMs).toISOString();
        const ackStatus = {
            sessionId,
            acknowledgedAt: now,
            expiresAt,
            status: "acknowledged",
            acknowledgedBy: operatorId,
        };
        this.ackStatuses.set(sessionId, ackStatus);
        this.startTimeoutTimer(sessionId, taskId, this.config.acknowledgmentTimeoutMs);
        const policy = this.escalationPolicies.get(sessionId);
        if (policy) {
            policy.escalationHistory.push({
                level: policy.currentLevel,
                reason: "acknowledged",
                timestamp: now,
                target: operatorId,
            });
        }
        this.eventEmitter.emit("takeover:acknowledged", {
            sessionId,
            taskId,
            operatorId,
            acknowledgedAt: now,
            expiresAt,
        });
        this.logger.log({
            level: "info",
            message: "takeover.session_acknowledged",
            data: { sessionId, operatorId, expiresAt },
        });
        return { sessionId, acknowledged: true, acknowledgedAt: now, expiresAt, previousStatus };
    }
    /**
     * Gets the acknowledgment status for a session.
     */
    getAcknowledgmentStatus(sessionId) {
        const status = this.ackStatuses.get(sessionId);
        if (status?.status === "acknowledged" && status.expiresAt) {
            if (new Date(status.expiresAt) <= new Date()) {
                return { ...status, status: "expired" };
            }
        }
        return status ?? null;
    }
    /**
     * Extends the acknowledgment deadline for an active session.
     */
    extendAcknowledgment(sessionId, additionalMs) {
        const status = this.ackStatuses.get(sessionId);
        if (!status || status.status !== "acknowledged") {
            throw new WorkflowStateError("takeover.ack_not_found", "Acknowledgment not found or not active", { details: { sessionId, status: status?.status ?? "not_found" } });
        }
        const extensionMs = additionalMs ?? this.config.acknowledgmentTimeoutMs;
        const newExpiresAt = new Date(Date.now() + extensionMs).toISOString();
        status.expiresAt = newExpiresAt;
        this.startTimeoutTimer(sessionId, "", extensionMs);
        this.logger.log({
            level: "info",
            message: "takeover.ack_extended",
            data: { sessionId, newExpiresAt },
        });
        return {
            sessionId,
            acknowledged: true,
            acknowledgedAt: status.acknowledgedAt ?? nowIso(),
            expiresAt: newExpiresAt,
            previousStatus: status.status,
        };
    }
    /**
     * C-11: Evict expired session entries to prevent memory leaks.
     */
    evictExpiredSessionEntries() {
        const now = Date.now();
        if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
            return;
        }
        this.lastEvictionTime = now;
        const expiryThreshold = now - this.SESSION_TTL_MS;
        const entriesToDelete = [];
        for (const [sessionId, status] of this.ackStatuses) {
            if (status.acknowledgedAt) {
                const ackTime = new Date(status.acknowledgedAt).getTime();
                if (ackTime < expiryThreshold) {
                    entriesToDelete.push(sessionId);
                }
            }
        }
        for (const sessionId of entriesToDelete) {
            this.ackStatuses.delete(sessionId);
            this.escalationPolicies.delete(sessionId);
        }
        if (this.ackStatuses.size > this.MAX_SESSION_ENTRIES) {
            const sortedEntries = [...this.ackStatuses.entries()].sort((a, b) => {
                const aTime = a[1].acknowledgedAt ? new Date(a[1].acknowledgedAt).getTime() : 0;
                const bTime = b[1].acknowledgedAt ? new Date(b[1].acknowledgedAt).getTime() : 0;
                return aTime - bTime;
            });
            const toRemove = this.ackStatuses.size - this.MAX_SESSION_ENTRIES;
            for (let i = 0; i < toRemove; i++) {
                const sessionId = sortedEntries[i][0];
                this.ackStatuses.delete(sessionId);
                this.escalationPolicies.delete(sessionId);
            }
        }
    }
    /**
     * Clears all active timers. Used during shutdown.
     */
    clearAllTimers() {
        for (const timeout of this.activeTimeouts.values()) {
            clearTimeout(timeout);
        }
        this.activeTimeouts.clear();
        for (const timer of this.escalationTimers.values()) {
            clearTimeout(timer);
        }
        this.escalationTimers.clear();
    }
}
//# sourceMappingURL=takeover-escalation-manager.js.map