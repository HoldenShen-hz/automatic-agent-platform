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
import type { AnomalySeverity } from "../../shared/observability/anomaly-detection-service.js";
export type EscalationLevel = "observe" | "warn" | "act" | "critical";
export type StopLossAction = "circuit_break" | "isolate_provider" | "scale_down" | "pause_non_critical" | "queue_only" | "reject_low_priority" | "enable_circuit_breaker" | "disable_new_tasks" | "force_garbage_collection" | "escalate_to_human";
export interface StopLossPlaybook {
    id: string;
    name: string;
    description: string;
    triggerCondition: PlaybookCondition;
    actions: StopLossAction[];
    cooldownMs: number;
    maxExecutionsPerHour: number;
    requireHumanApproval: boolean;
    enabled: boolean;
}
export interface PlaybookCondition {
    type: "anomaly_severity" | "health_status" | "metric_threshold" | "compound";
    severityThreshold?: AnomalySeverity;
    healthStatusThreshold?: "ok" | "degraded" | "overloaded" | "unhealthy";
    metricName?: string;
    metricValue?: number;
    operator?: "gt" | "lt" | "gte" | "lte" | "eq";
    compoundOperator?: "and" | "or";
    subConditions?: PlaybookCondition[];
}
export interface StopLossEvent {
    id: string;
    playbookId: string;
    playbookName: string;
    triggerReason: string;
    actionsExecuted: StopLossAction[];
    escalationLevel: EscalationLevel;
    executedAt: string;
    completedAt: string | null;
    success: boolean;
    errorMessage?: string;
    autoTriggered: boolean;
    humanApproved: boolean;
}
export interface AutoStopLossConfig {
    enabled: boolean;
    defaultCooldownMs: number;
    maxEventsPerHour: number;
    enableAutoExecution: boolean;
    enableHumanEscalation: boolean;
    healthCheckIntervalMs: number;
}
export interface SystemHealthSnapshot {
    status: "ok" | "degraded" | "overloaded" | "unhealthy";
    anomalySeverity: AnomalySeverity | null;
    activeExecutions: number;
    queuedTasks: number;
    memoryUsageMb: number;
    eventLoopLagMs: number;
    providerHealth: "healthy" | "degraded" | "failed";
}
export interface AutoStopLossServiceOptions {
    config?: Partial<AutoStopLossConfig>;
    playbooks?: StopLossPlaybook[];
}
/**
 * AutoStopLossService provides automated protective actions when system anomalies
 * or health degradation are detected. It evaluates anomalies and health snapshots
 * against registered playbooks, executing protective actions while respecting
 * cooldown periods and rate limits.
 */
export declare class AutoStopLossService {
    private readonly config;
    private readonly playbooks;
    private readonly executionHistory;
    private readonly executionCounts;
    private readonly lastExecutionTime;
    private readonly actionHandlers;
    private lastHealthCheck;
    constructor(options?: AutoStopLossServiceOptions);
    /**
     * Registers default action handlers for all supported stop-loss actions.
     * These handlers can be overridden via registerActionHandler().
     */
    private registerDefaultHandlers;
    /**
     * Registers a custom handler for a specific stop-loss action.
     * Custom handlers override the default handlers.
     */
    registerActionHandler(action: StopLossAction, handler: ActionHandler): void;
    /**
     * Registers a new playbook with the service.
     */
    registerPlaybook(playbook: StopLossPlaybook): void;
    /**
     * Unregisters a playbook by ID.
     * @returns true if the playbook was found and removed
     */
    unregisterPlaybook(playbookId: string): boolean;
    /**
     * Retrieves a playbook by its ID.
     */
    getPlaybook(playbookId: string): StopLossPlaybook | null;
    /**
     * Lists all registered playbooks.
     */
    listPlaybooks(): StopLossPlaybook[];
    /**
     * Enables a playbook by ID.
     * @returns true if the playbook was found and enabled
     */
    enablePlaybook(playbookId: string): boolean;
    /**
     * Disables a playbook by ID.
     * @returns true if the playbook was found and disabled
     */
    disablePlaybook(playbookId: string): boolean;
    /**
     * Evaluates an anomaly against registered playbooks to determine if
     * any protective actions should be taken.
     *
     * @param severity - The severity level of the detected anomaly
     * @param metricName - The name of the metric that triggered the anomaly
     * @param context - Additional context for condition matching
     * @returns Evaluation result with matching playbooks and escalation level
     */
    evaluateAnomaly(severity: AnomalySeverity, metricName: string, context?: Record<string, unknown>): {
        shouldExecute: boolean;
        matchingPlaybooks: StopLossPlaybook[];
        escalation: EscalationLevel;
    };
    /**
     * Evaluates a health status snapshot against registered playbooks.
     *
     * @param status - The current system health status
     * @param context - Additional context for condition matching
     * @returns Evaluation result with matching playbooks and escalation level
     */
    evaluateHealth(status: SystemHealthSnapshot["status"], context?: Record<string, unknown>): {
        shouldExecute: boolean;
        matchingPlaybooks: StopLossPlaybook[];
        escalation: EscalationLevel;
    };
    /**
     * Evaluates whether a playbook's trigger condition matches the given context.
     * Supports simple conditions (anomaly severity, health status, metric threshold)
     * and compound conditions (AND/OR combinations).
     */
    private conditionMatches;
    /**
     * Compares two anomaly severity levels.
     * Returns true if the actual severity is >= the threshold (more severe or equal).
     */
    private compareSeverity;
    /**
     * Compares two health status levels.
     * Returns true if the actual status is >= the threshold in severity.
     */
    private compareHealthStatus;
    /**
     * Compares a metric value against a threshold using the specified operator.
     */
    private compareValue;
    /**
     * Checks if a playbook is currently in its cooldown period.
     */
    private isPlaybookInCooldown;
    /**
     * Checks if a playbook has exceeded its hourly execution limit.
     */
    private isPlaybookRateLimited;
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
    executePlaybook(playbook: StopLossPlaybook, triggerReason: string, context?: Record<string, unknown>): Promise<StopLossEvent>;
    /**
     * Determines the escalation level based on the playbook's actions.
     * Actions like escalation_to_human or disable_new_tasks are considered critical.
     */
    private determineEscalation;
    /**
     * Records an execution event and updates rate limit counters.
     */
    private recordEvent;
    /**
     * Generates a key based on the current hour for rate limiting.
     */
    private getHourKey;
    /**
     * Approves or rejects a pending human approval request.
     *
     * @param eventId - The ID of the pending StopLossEvent
     * @param approved - Whether to approve (true) or reject (false) the execution
     * @returns true if the approval/rejection was successful
     */
    approvePendingExecution(eventId: string, approved: boolean): boolean;
    /**
     * Returns all pending approval requests (events awaiting human approval).
     */
    getPendingApprovals(): StopLossEvent[];
    /**
     * Returns the most recent execution events up to the specified limit.
     */
    getExecutionHistory(limit?: number): StopLossEvent[];
    /**
     * Returns aggregated execution statistics.
     */
    getExecutionStats(): {
        totalExecutions: number;
        successfulExecutions: number;
        failedExecutions: number;
        pendingApprovals: number;
    };
    /**
     * Updates the service with a new health snapshot and automatically evaluates
     * health-based playbooks for any matching protective actions.
     *
     * @param snapshot - The current system health snapshot
     */
    updateHealthCheck(snapshot: SystemHealthSnapshot): void;
    /**
     * Returns the most recent health snapshot received by the service.
     */
    getLastHealthCheck(): SystemHealthSnapshot | null;
    /**
     * Returns whether the service is currently enabled.
     */
    isEnabled(): boolean;
    /**
     * Enables or disables the auto stop-loss service.
     */
    setEnabled(enabled: boolean): void;
    /**
     * Returns the current service configuration.
     */
    getConfig(): AutoStopLossConfig;
}
interface ActionContext {
    playbookId?: string;
    reason?: string;
    provider?: string;
    metricName?: string;
    [key: string]: unknown;
}
interface ActionResult {
    success: boolean;
    message: string;
    requiresApproval?: boolean;
}
/**
 * Handler function type for stop-loss actions.
 * Custom action handlers implement this interface.
 */
type ActionHandler = (context: ActionContext) => Promise<ActionResult>;
export {};
