/**
 * @fileoverview Auto Stop-Loss Service
 *
 * Provides automated response to system anomalies and health degradation:
 * - Monitors anomaly detection and health metrics
 * - Triggers predefined stop-loss playbooks based on conditions
 * - Supports escalation levels: observe -> warn -> act -> critical
 * - Executes protective actions (circuit break, scale down, isolate, etc.)
 * - Audit trail for all automated decisions
 */
import { newId, nowIso } from "../../contracts/types/ids.js";
// ── Default Playbooks ──────────────────────────────────────────────────
const DEFAULT_PLAYBOOKS = [
    {
        id: "playbook_circuit_break_provider",
        name: "Circuit Break Unhealthy Provider",
        description: "Open circuit breaker when provider failure is detected",
        triggerCondition: {
            type: "anomaly_severity",
            severityThreshold: "critical",
        },
        actions: ["circuit_break", "isolate_provider"],
        cooldownMs: 60000,
        maxExecutionsPerHour: 10,
        requireHumanApproval: false,
        enabled: true,
    },
    {
        id: "playbook_critical_anomaly_escalate",
        name: "Critical Anomaly Human Escalation",
        description: "Escalate to human when emergency anomaly detected",
        triggerCondition: {
            type: "anomaly_severity",
            severityThreshold: "emergency",
        },
        actions: ["escalate_to_human"],
        cooldownMs: 300000,
        maxExecutionsPerHour: 5,
        requireHumanApproval: false,
        enabled: true,
    },
    {
        id: "playbook_overloaded_pause_non_critical",
        name: "Pause Non-Critical Under Overload",
        description: "Pause non-critical tasks when system is overloaded",
        triggerCondition: {
            type: "health_status",
            healthStatusThreshold: "overloaded",
        },
        actions: ["pause_non_critical", "reject_low_priority"],
        cooldownMs: 120000,
        maxExecutionsPerHour: 20,
        requireHumanApproval: false,
        enabled: true,
    },
    {
        id: "playbook_memory_pressure_scale_down",
        name: "Scale Down Under Memory Pressure",
        description: "Reduce execution capacity under memory pressure",
        triggerCondition: {
            type: "metric_threshold",
            metricName: "memory_usage_mb",
            metricValue: 1024,
            operator: "gt",
        },
        actions: ["scale_down", "force_garbage_collection"],
        cooldownMs: 180000,
        maxExecutionsPerHour: 10,
        requireHumanApproval: true,
        enabled: true,
    },
    {
        id: "playbook_unhealthy_disable_new_tasks",
        name: "Disable New Tasks When Unhealthy",
        description: "Stop accepting new tasks when system is unhealthy",
        triggerCondition: {
            type: "health_status",
            healthStatusThreshold: "unhealthy",
        },
        actions: ["disable_new_tasks", "pause_non_critical"],
        cooldownMs: 300000,
        maxExecutionsPerHour: 3,
        requireHumanApproval: true,
        enabled: true,
    },
];
// ── Escalation Mapping ────────────────────────────────────────────────
const SEVERITY_TO_ESCALATION = {
    info: "observe",
    warning: "warn",
    critical: "act",
    emergency: "critical",
};
const HEALTH_TO_ESCALATION = {
    ok: "observe",
    degraded: "warn",
    overloaded: "act",
    unhealthy: "critical",
};
/**
 * AutoStopLossService provides automated protective actions when system anomalies
 * or health degradation are detected. It evaluates anomalies and health snapshots
 * against registered playbooks, executing protective actions while respecting
 * cooldown periods and rate limits.
 */
export class AutoStopLossService {
    config;
    playbooks = new Map();
    executionHistory = [];
    executionCounts = new Map();
    lastExecutionTime = new Map();
    actionHandlers = new Map();
    lastHealthCheck = null;
    constructor(options) {
        this.config = {
            enabled: options?.config?.enabled ?? true,
            defaultCooldownMs: options?.config?.defaultCooldownMs ?? 60000,
            maxEventsPerHour: options?.config?.maxEventsPerHour ?? 100,
            enableAutoExecution: options?.config?.enableAutoExecution ?? true,
            enableHumanEscalation: options?.config?.enableHumanEscalation ?? true,
            healthCheckIntervalMs: options?.config?.healthCheckIntervalMs ?? 30000,
        };
        // Register default playbooks
        for (const playbook of options?.playbooks ?? DEFAULT_PLAYBOOKS) {
            this.playbooks.set(playbook.id, playbook);
        }
        // Register default action handlers
        this.registerDefaultHandlers();
    }
    /**
     * Registers default action handlers for all supported stop-loss actions.
     * These handlers can be overridden via registerActionHandler().
     */
    registerDefaultHandlers() {
        this.registerActionHandler("circuit_break", async () => {
            return { success: true, message: "Circuit break signaled" };
        });
        this.registerActionHandler("isolate_provider", async (context) => {
            return { success: true, message: `Provider isolation signaled for: ${context?.provider ?? "unknown"}` };
        });
        this.registerActionHandler("scale_down", async () => {
            return { success: true, message: "Scale down execution signaled" };
        });
        this.registerActionHandler("pause_non_critical", async () => {
            return { success: true, message: "Non-critical task pause signaled" };
        });
        this.registerActionHandler("queue_only", async () => {
            return { success: true, message: "Queue-only mode enabled" };
        });
        this.registerActionHandler("reject_low_priority", async () => {
            return { success: true, message: "Low priority rejection enabled" };
        });
        this.registerActionHandler("enable_circuit_breaker", async () => {
            return { success: true, message: "Circuit breaker enabled" };
        });
        this.registerActionHandler("disable_new_tasks", async () => {
            return { success: true, message: "New task admission disabled" };
        });
        this.registerActionHandler("force_garbage_collection", async () => {
            if (global.gc) {
                global.gc();
                return { success: true, message: "Manual GC triggered" };
            }
            return { success: false, message: "GC not exposed" };
        });
        this.registerActionHandler("escalate_to_human", async (context) => {
            return {
                success: true,
                message: `Human escalation triggered: ${context?.reason ?? "Critical condition detected"}`,
                requiresApproval: true,
            };
        });
    }
    /**
     * Registers a custom handler for a specific stop-loss action.
     * Custom handlers override the default handlers.
     */
    registerActionHandler(action, handler) {
        this.actionHandlers.set(action, handler);
    }
    // ── Playbook Management ──────────────────────────────────────────────
    /**
     * Registers a new playbook with the service.
     */
    registerPlaybook(playbook) {
        this.playbooks.set(playbook.id, playbook);
    }
    /**
     * Unregisters a playbook by ID.
     * @returns true if the playbook was found and removed
     */
    unregisterPlaybook(playbookId) {
        return this.playbooks.delete(playbookId);
    }
    /**
     * Retrieves a playbook by its ID.
     */
    getPlaybook(playbookId) {
        return this.playbooks.get(playbookId) ?? null;
    }
    /**
     * Lists all registered playbooks.
     */
    listPlaybooks() {
        return [...this.playbooks.values()];
    }
    /**
     * Enables a playbook by ID.
     * @returns true if the playbook was found and enabled
     */
    enablePlaybook(playbookId) {
        const playbook = this.playbooks.get(playbookId);
        if (playbook) {
            playbook.enabled = true;
            return true;
        }
        return false;
    }
    /**
     * Disables a playbook by ID.
     * @returns true if the playbook was found and disabled
     */
    disablePlaybook(playbookId) {
        const playbook = this.playbooks.get(playbookId);
        if (playbook) {
            playbook.enabled = false;
            return true;
        }
        return false;
    }
    // ── Evaluation ──────────────────────────────────────────────────────
    /**
     * Evaluates an anomaly against registered playbooks to determine if
     * any protective actions should be taken.
     *
     * @param severity - The severity level of the detected anomaly
     * @param metricName - The name of the metric that triggered the anomaly
     * @param context - Additional context for condition matching
     * @returns Evaluation result with matching playbooks and escalation level
     */
    evaluateAnomaly(severity, metricName, context) {
        const escalation = SEVERITY_TO_ESCALATION[severity];
        const matchingPlaybooks = [];
        for (const playbook of this.playbooks.values()) {
            if (!playbook.enabled)
                continue;
            if (this.isPlaybookInCooldown(playbook))
                continue;
            if (this.isPlaybookRateLimited(playbook))
                continue;
            if (this.conditionMatches(playbook.triggerCondition, { severity: severity, metricName: metricName, ...(context !== undefined ? { context } : {}) })) {
                matchingPlaybooks.push(playbook);
            }
        }
        const shouldExecute = matchingPlaybooks.length > 0 && this.config.enableAutoExecution;
        return { shouldExecute, matchingPlaybooks, escalation };
    }
    /**
     * Evaluates a health status snapshot against registered playbooks.
     *
     * @param status - The current system health status
     * @param context - Additional context for condition matching
     * @returns Evaluation result with matching playbooks and escalation level
     */
    evaluateHealth(status, context) {
        const escalation = HEALTH_TO_ESCALATION[status] ?? "observe";
        const matchingPlaybooks = [];
        for (const playbook of this.playbooks.values()) {
            if (!playbook.enabled)
                continue;
            if (this.isPlaybookInCooldown(playbook))
                continue;
            if (this.isPlaybookRateLimited(playbook))
                continue;
            if (this.conditionMatches(playbook.triggerCondition, { healthStatus: status, ...(context !== undefined ? { context } : {}) })) {
                matchingPlaybooks.push(playbook);
            }
        }
        const shouldExecute = matchingPlaybooks.length > 0 && this.config.enableAutoExecution;
        return { shouldExecute, matchingPlaybooks, escalation };
    }
    /**
     * Evaluates whether a playbook's trigger condition matches the given context.
     * Supports simple conditions (anomaly severity, health status, metric threshold)
     * and compound conditions (AND/OR combinations).
     */
    conditionMatches(condition, ctx) {
        switch (condition.type) {
            case "anomaly_severity":
                if (!condition.severityThreshold || !ctx.severity)
                    return false;
                return this.compareSeverity(ctx.severity, condition.severityThreshold);
            case "health_status":
                if (!condition.healthStatusThreshold || !ctx.healthStatus)
                    return false;
                return this.compareHealthStatus(ctx.healthStatus, condition.healthStatusThreshold);
            case "metric_threshold": {
                if (!condition.metricName || condition.metricValue === undefined)
                    return false;
                if (ctx.metricName !== condition.metricName)
                    return false;
                const metricValue = ctx.context?.[condition.metricName];
                if (metricValue === undefined)
                    return false;
                return this.compareValue(metricValue, condition.metricValue, condition.operator ?? "gt");
            }
            case "compound":
                if (!condition.subConditions || condition.subConditions.length === 0)
                    return false;
                if (condition.compoundOperator === "and") {
                    return condition.subConditions.every((sub) => this.conditionMatches(sub, ctx));
                }
                else {
                    return condition.subConditions.some((sub) => this.conditionMatches(sub, ctx));
                }
            default:
                return false;
        }
    }
    /**
     * Compares two anomaly severity levels.
     * Returns true if the actual severity is >= the threshold (more severe or equal).
     */
    compareSeverity(actual, threshold) {
        const order = ["info", "warning", "critical", "emergency"];
        return order.indexOf(actual) >= order.indexOf(threshold);
    }
    /**
     * Compares two health status levels.
     * Returns true if the actual status is >= the threshold in severity.
     */
    compareHealthStatus(actual, threshold) {
        const order = ["ok", "degraded", "overloaded", "unhealthy"];
        return order.indexOf(actual) >= order.indexOf(threshold);
    }
    /**
     * Compares a metric value against a threshold using the specified operator.
     */
    compareValue(actual, threshold, operator) {
        switch (operator) {
            case "gt": return actual > threshold;
            case "lt": return actual < threshold;
            case "gte": return actual >= threshold;
            case "lte": return actual <= threshold;
            case "eq": return actual === threshold;
            default: return false;
        }
    }
    /**
     * Checks if a playbook is currently in its cooldown period.
     */
    isPlaybookInCooldown(playbook) {
        const lastExec = this.lastExecutionTime.get(playbook.id);
        if (lastExec === undefined)
            return false;
        return Date.now() - lastExec < playbook.cooldownMs;
    }
    /**
     * Checks if a playbook has exceeded its hourly execution limit.
     */
    isPlaybookRateLimited(playbook) {
        const count = this.executionCounts.get(playbook.id) ?? 0;
        return count >= playbook.maxExecutionsPerHour;
    }
    // ── Execution ───────────────────────────────────────────────────────
    /**
     * Executes a playbook's protective actions.
     * If human approval is required and enabled, queues the execution for approval
     * instead of auto-executing.
     *
     * @param playbook - The playbook to execute
     * @param triggerReason - Human-readable reason for triggering this playbook
     * @param context - Additional context passed to action handlers
     * @returns The resulting StopLossEvent with execution details
     */
    async executePlaybook(playbook, triggerReason, context) {
        const eventId = newId("stoploss");
        const startTime = nowIso();
        const actionsExecuted = [];
        let allSuccess = true;
        let errorMessage;
        // Check if human approval is required
        if (playbook.requireHumanApproval && this.config.enableHumanEscalation) {
            // Queue for human approval instead of auto-executing
            const event = {
                id: eventId,
                playbookId: playbook.id,
                playbookName: playbook.name,
                triggerReason,
                actionsExecuted: [],
                escalationLevel: SEVERITY_TO_ESCALATION[triggerReason.includes("emergency") ? "emergency" : "critical"],
                executedAt: startTime,
                completedAt: null,
                success: false,
                errorMessage: "Pending human approval",
                autoTriggered: false,
                humanApproved: false,
            };
            this.recordEvent(event, playbook.id);
            return event;
        }
        // Execute each action
        for (const action of playbook.actions) {
            const handler = this.actionHandlers.get(action);
            if (!handler) {
                errorMessage = `No handler for action: ${action}`;
                allSuccess = false;
                break;
            }
            try {
                const result = await handler({ playbookId: playbook.id, reason: triggerReason, ...context });
                if (!result.success) {
                    errorMessage = result.message;
                    allSuccess = false;
                    break;
                }
                actionsExecuted.push(action);
            }
            catch (err) {
                errorMessage = err instanceof Error ? err.message : String(err);
                allSuccess = false;
                break;
            }
        }
        const event = {
            id: eventId,
            playbookId: playbook.id,
            playbookName: playbook.name,
            triggerReason,
            actionsExecuted,
            escalationLevel: this.determineEscalation(playbook),
            executedAt: startTime,
            completedAt: nowIso(),
            success: allSuccess,
            ...(errorMessage !== undefined ? { errorMessage } : {}),
            autoTriggered: true,
            humanApproved: false,
        };
        this.recordEvent(event, playbook.id);
        this.lastExecutionTime.set(playbook.id, Date.now());
        return event;
    }
    /**
     * Determines the escalation level based on the playbook's actions.
     * Actions like escalation_to_human or disable_new_tasks are considered critical.
     */
    determineEscalation(playbook) {
        if (playbook.actions.includes("escalate_to_human") || playbook.actions.includes("disable_new_tasks")) {
            return "critical";
        }
        if (playbook.actions.includes("pause_non_critical") || playbook.actions.includes("scale_down")) {
            return "act";
        }
        return "warn";
    }
    /**
     * Records an execution event and updates rate limit counters.
     */
    recordEvent(event, playbookId) {
        this.executionHistory.push(event);
        // Keep history bounded to prevent memory exhaustion
        if (this.executionHistory.length > 1000) {
            this.executionHistory.splice(0, this.executionHistory.length - 1000);
        }
        // Update rate limit counters (reset hourly via hour key)
        if (playbookId) {
            const hourKey = this.getHourKey();
            const countKey = `${playbookId}_${hourKey}`;
            const currentCount = this.executionCounts.get(countKey) ?? 0;
            this.executionCounts.set(countKey, currentCount + 1);
        }
    }
    /**
     * Generates a key based on the current hour for rate limiting.
     */
    getHourKey() {
        const now = new Date();
        return `${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}`;
    }
    // ── Human Approval ──────────────────────────────────────────────────
    /**
     * Approves or rejects a pending human approval request.
     *
     * @param eventId - The ID of the pending StopLossEvent
     * @param approved - Whether to approve (true) or reject (false) the execution
     * @returns true if the approval/rejection was successful
     */
    approvePendingExecution(eventId, approved) {
        const event = this.executionHistory.find((e) => e.id === eventId);
        if (!event || event.completedAt !== null)
            return false;
        if (approved) {
            event.humanApproved = true;
            event.completedAt = nowIso();
            delete event.errorMessage;
            return true;
        }
        else {
            event.completedAt = nowIso();
            event.success = false;
            event.errorMessage = "Rejected by human";
            return true;
        }
    }
    /**
     * Returns all pending approval requests (events awaiting human approval).
     */
    getPendingApprovals() {
        return this.executionHistory.filter((e) => e.errorMessage === "Pending human approval");
    }
    // ── History ─────────────────────────────────────────────────────────
    /**
     * Returns the most recent execution events up to the specified limit.
     */
    getExecutionHistory(limit = 100) {
        return this.executionHistory.slice(-limit);
    }
    /**
     * Returns aggregated execution statistics.
     */
    getExecutionStats() {
        return {
            totalExecutions: this.executionHistory.length,
            successfulExecutions: this.executionHistory.filter((e) => e.success).length,
            failedExecutions: this.executionHistory.filter((e) => !e.success && e.completedAt !== null).length,
            pendingApprovals: this.getPendingApprovals().length,
        };
    }
    // ── Health Check ────────────────────────────────────────────────────
    /**
     * Updates the service with a new health snapshot and automatically evaluates
     * health-based playbooks for any matching protective actions.
     *
     * @param snapshot - The current system health snapshot
     */
    updateHealthCheck(snapshot) {
        this.lastHealthCheck = snapshot;
        if (!this.config.enabled || !this.config.enableAutoExecution)
            return;
        // Evaluate health status against playbooks
        const { matchingPlaybooks } = this.evaluateHealth(snapshot.status, {
            activeExecutions: snapshot.activeExecutions,
            queuedTasks: snapshot.queuedTasks,
            memoryUsageMb: snapshot.memoryUsageMb,
            eventLoopLagMs: snapshot.eventLoopLagMs,
        });
        // Execute matching playbooks asynchronously (fire-and-forget)
        for (const playbook of matchingPlaybooks) {
            this.executePlaybook(playbook, `Health check: ${snapshot.status}`, {
                healthStatus: snapshot.status,
                ...snapshot,
            }).catch(() => {
                // Log error but don't block the health check loop
            });
        }
    }
    /**
     * Returns the most recent health snapshot received by the service.
     */
    getLastHealthCheck() {
        return this.lastHealthCheck;
    }
    // ── Configuration ──────────────────────────────────────────────────
    /**
     * Returns whether the service is currently enabled.
     */
    isEnabled() {
        return this.config.enabled;
    }
    /**
     * Enables or disables the auto stop-loss service.
     */
    setEnabled(enabled) {
        this.config.enabled = enabled;
    }
    /**
     * Returns the current service configuration.
     */
    getConfig() {
        return { ...this.config };
    }
}
//# sourceMappingURL=auto-stop-loss-service.js.map