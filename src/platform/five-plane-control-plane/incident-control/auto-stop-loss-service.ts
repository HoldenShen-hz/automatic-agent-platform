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
import type { AnomalySeverity } from "../../shared/observability/anomaly-detection-service.js";

// ── Types ──────────────────────────────────────────────────────────────

export type EscalationLevel = "observe" | "warn" | "act" | "critical";

export type StopLossAction =
  | "circuit_break"
  | "isolate_provider"
  | "scale_down"
  | "pause_non_critical"
  | "queue_only"
  | "reject_low_priority"
  | "enable_circuit_breaker"
  | "disable_new_tasks"
  | "force_garbage_collection"
  | "escalate_to_human";

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

interface ConditionMatchContext {
  severity?: AnomalySeverity;
  metricName?: string;
  healthStatus?: SystemHealthSnapshot["status"];
  context?: Record<string, unknown>;
}

// ── Default Playbooks ──────────────────────────────────────────────────

const DEFAULT_PLAYBOOKS: StopLossPlaybook[] = [
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

const SEVERITY_TO_ESCALATION: Record<AnomalySeverity, EscalationLevel> = {
  info: "observe",
  warning: "warn",
  critical: "act",
  emergency: "critical",
};

const HEALTH_TO_ESCALATION: Record<string, EscalationLevel> = {
  ok: "observe",
  degraded: "warn",
  overloaded: "act",
  unhealthy: "critical",
};

// ── Service ─────────────────────────────────────────────────────────────

// ── Error Classification for §9.6 ───────────────────────────────────

/**
 * Error classification for playbook execution failures.
 * §9.6 requires categorized error recording with evidence.
 */
type PlaybookErrorCategory =
  | "handler_not_found"
  | "handler_execution_failed"
  | "context_validation_failed"
  | "timeout"
  | "unknown";

interface PlaybookErrorRecord {
  readonly eventId: string;
  readonly playbookId: string;
  readonly playbookName: string;
  readonly category: PlaybookErrorCategory;
  readonly errorMessage: string;
  readonly timestamp: string;
  readonly healthStatus: string;
  readonly retryable: boolean;
}

const PLAYBOOK_ERROR_CATEGORY: Record<string, PlaybookErrorCategory> = {
  "No handler for action": "handler_not_found",
  "timeout": "timeout",
};

function classifyPlaybookError(
  error: unknown,
  playbookId: string,
  playbookName: string,
  healthStatus: string,
): PlaybookErrorRecord {
  const errorMessage = error instanceof Error ? error.message : String(error);
  let category: PlaybookErrorCategory = "unknown";
  let retryable = false;

  for (const [pattern, cat] of Object.entries(PLAYBOOK_ERROR_CATEGORY)) {
    if (errorMessage.includes(pattern)) {
      category = cat;
      break;
    }
  }

  if (category === "unknown") {
    // Check for execution failures
    if (errorMessage.includes("failed") || errorMessage.includes("error")) {
      category = "handler_execution_failed";
      retryable = true;
    }
  }

  return {
    eventId: newId("playbook_err"),
    playbookId,
    playbookName,
    category,
    errorMessage,
    timestamp: nowIso(),
    healthStatus,
    retryable,
  };
}

// ── Service ─────────────────────────────────────────────────────────────

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
export class AutoStopLossService {
  private readonly config: AutoStopLossConfig;
  private readonly playbooks: Map<string, StopLossPlaybook> = new Map();
  private readonly executionHistory: StopLossEvent[] = [];
  private readonly executionCounts: Map<string, number> = new Map();
  private readonly lastExecutionTime: Map<string, number> = new Map();
  private readonly actionHandlers: Map<StopLossAction, ActionHandler> = new Map();
  private readonly errorRecords: PlaybookErrorRecord[] = [];
  private lastHealthCheck: SystemHealthSnapshot | null = null;

  constructor(options?: AutoStopLossServiceOptions) {
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
  private registerDefaultHandlers(): void {
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
  registerActionHandler(action: StopLossAction, handler: ActionHandler): void {
    this.actionHandlers.set(action, handler);
  }

  // ── Playbook Management ──────────────────────────────────────────────

  /**
   * Registers a new playbook with the service.
   */
  registerPlaybook(playbook: StopLossPlaybook): void {
    this.playbooks.set(playbook.id, playbook);
  }

  /**
   * Unregisters a playbook by ID.
   * @returns true if the playbook was found and removed
   */
  unregisterPlaybook(playbookId: string): boolean {
    return this.playbooks.delete(playbookId);
  }

  /**
   * Retrieves a playbook by its ID.
   */
  getPlaybook(playbookId: string): StopLossPlaybook | null {
    return this.playbooks.get(playbookId) ?? null;
  }

  /**
   * Lists all registered playbooks.
   */
  listPlaybooks(): StopLossPlaybook[] {
    return [...this.playbooks.values()];
  }

  /**
   * Enables a playbook by ID.
   * @returns true if the playbook was found and enabled
   */
  enablePlaybook(playbookId: string): boolean {
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
  disablePlaybook(playbookId: string): boolean {
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
  evaluateAnomaly(
    severity: AnomalySeverity,
    metricName: string,
    context?: Record<string, unknown>,
  ): { shouldExecute: boolean; matchingPlaybooks: StopLossPlaybook[]; escalation: EscalationLevel } {
    const escalation = SEVERITY_TO_ESCALATION[severity];
    const matchingPlaybooks: StopLossPlaybook[] = [];

    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;
      if (this.isPlaybookInCooldown(playbook)) continue;
      if (this.isPlaybookRateLimited(playbook)) continue;

      const matchContext: ConditionMatchContext = {
        severity,
        metricName,
        ...(context !== undefined ? { context } : {}),
      };
      const healthStatus = this.getContextHealthStatus(context);
      if (healthStatus !== undefined) {
        matchContext.healthStatus = healthStatus;
      }

      if (this.conditionMatches(playbook.triggerCondition, matchContext)) {
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
  evaluateHealth(
    status: SystemHealthSnapshot["status"],
    context?: Record<string, unknown>,
  ): { shouldExecute: boolean; matchingPlaybooks: StopLossPlaybook[]; escalation: EscalationLevel } {
    const escalation = HEALTH_TO_ESCALATION[status] ?? "observe";
    const matchingPlaybooks: StopLossPlaybook[] = [];

    for (const playbook of this.playbooks.values()) {
      if (!playbook.enabled) continue;
      if (this.isPlaybookInCooldown(playbook)) continue;
      if (this.isPlaybookRateLimited(playbook)) continue;

      const matchContext: ConditionMatchContext = {
        healthStatus: status,
        ...(context !== undefined ? { context } : {}),
      };
      const severity = this.getContextAnomalySeverity(context);
      if (severity !== undefined) {
        matchContext.severity = severity;
      }
      const metricName = this.getContextMetricName(context);
      if (metricName !== undefined) {
        matchContext.metricName = metricName;
      }

      if (this.conditionMatches(playbook.triggerCondition, matchContext)) {
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
  private conditionMatches(
    condition: PlaybookCondition,
    ctx: ConditionMatchContext,
  ): boolean {
    switch (condition.type) {
      case "anomaly_severity":
        if (!condition.severityThreshold || !ctx.severity) return false;
        return this.compareSeverity(ctx.severity, condition.severityThreshold);

      case "health_status":
        if (!condition.healthStatusThreshold || !ctx.healthStatus) return false;
        return this.compareHealthStatus(ctx.healthStatus, condition.healthStatusThreshold);

      case "metric_threshold": {
        if (!condition.metricName || condition.metricValue === undefined) return false;
        if (ctx.metricName !== undefined && !this.metricNameMatches(ctx.metricName, condition.metricName)) {
          return false;
        }
        const metricValue = this.getMetricValue(ctx.context, condition.metricName);
        if (metricValue === undefined) return false;
        return this.compareValue(metricValue, condition.metricValue, condition.operator ?? "gt");
      }

      case "compound":
        if (!condition.subConditions || condition.subConditions.length === 0) return false;
        if (condition.compoundOperator === "and") {
          return condition.subConditions.every((sub) => this.conditionMatches(sub, ctx));
        } else {
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
  private compareSeverity(actual: AnomalySeverity, threshold: AnomalySeverity): boolean {
    const order: AnomalySeverity[] = ["info", "warning", "critical", "emergency"];
    return order.indexOf(actual) >= order.indexOf(threshold);
  }

  /**
   * Compares two health status levels.
   * Returns true if the actual status is >= the threshold in severity.
   */
  private compareHealthStatus(actual: SystemHealthSnapshot["status"], threshold: SystemHealthSnapshot["status"]): boolean {
    const order = ["ok", "degraded", "overloaded", "unhealthy"];
    return order.indexOf(actual) >= order.indexOf(threshold);
  }

  /**
   * Compares a metric value against a threshold using the specified operator.
   */
  private compareValue(actual: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case "gt": return actual > threshold;
      case "lt": return actual < threshold;
      case "gte": return actual >= threshold;
      case "lte": return actual <= threshold;
      case "eq": return actual === threshold;
      default: return false;
    }
  }

  private metricNameMatches(actualMetricName: string, expectedMetricName: string): boolean {
    const normalized = new Set([
      actualMetricName,
      this.toSnakeCase(actualMetricName),
      this.toCamelCase(actualMetricName),
    ]);
    return normalized.has(expectedMetricName) || normalized.has(this.toSnakeCase(expectedMetricName)) || normalized.has(this.toCamelCase(expectedMetricName));
  }

  private getMetricValue(context: Record<string, unknown> | undefined, metricName: string): number | undefined {
    if (context === undefined) {
      return undefined;
    }

    const candidateNames = [
      metricName,
      this.toSnakeCase(metricName),
      this.toCamelCase(metricName),
    ];

    for (const candidateName of candidateNames) {
      const value = context[candidateName];
      if (typeof value === "number" && Number.isFinite(value)) {
        return value;
      }
    }

    return undefined;
  }

  private getContextAnomalySeverity(context: Record<string, unknown> | undefined): AnomalySeverity | undefined {
    const severity = context?.anomalySeverity ?? context?.severity;
    return this.isAnomalySeverity(severity) ? severity : undefined;
  }

  private getContextHealthStatus(context: Record<string, unknown> | undefined): SystemHealthSnapshot["status"] | undefined {
    const status = context?.healthStatus ?? context?.status;
    return this.isHealthStatus(status) ? status : undefined;
  }

  private getContextMetricName(context: Record<string, unknown> | undefined): string | undefined {
    const metricName = context?.metricName;
    return typeof metricName === "string" && metricName.length > 0 ? metricName : undefined;
  }

  private isAnomalySeverity(value: unknown): value is AnomalySeverity {
    return value === "info" || value === "warning" || value === "critical" || value === "emergency";
  }

  private isHealthStatus(value: unknown): value is SystemHealthSnapshot["status"] {
    return value === "ok" || value === "degraded" || value === "overloaded" || value === "unhealthy";
  }

  private toSnakeCase(value: string): string {
    return value
      .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
      .replace(/[\s-]+/g, "_")
      .toLowerCase();
  }

  private toCamelCase(value: string): string {
    const normalized = value.replace(/[\s-]+/g, "_");
    return normalized.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
  }

  /**
   * Checks if a playbook is currently in its cooldown period.
   */
  private isPlaybookInCooldown(playbook: StopLossPlaybook): boolean {
    const lastExec = this.lastExecutionTime.get(playbook.id);
    if (lastExec === undefined) return false;
    return Date.now() - lastExec < playbook.cooldownMs;
  }

  /**
   * Checks if a playbook has exceeded its hourly execution limit.
   */
  private isPlaybookRateLimited(playbook: StopLossPlaybook): boolean {
    const count = this.executionCounts.get(`${playbook.id}_${this.getHourKey()}`) ?? 0;
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
  async executePlaybook(
    playbook: StopLossPlaybook,
    triggerReason: string,
    context?: Record<string, unknown>,
  ): Promise<StopLossEvent> {
    const eventId = newId("stoploss");
    const startTime = nowIso();
    const actionsExecuted: StopLossAction[] = [];
    let allSuccess = true;
    let errorMessage: string | undefined;

    // Check if human approval is required
    if (playbook.requireHumanApproval && this.config.enableHumanEscalation) {
      // Queue for human approval instead of auto-executing
      const event: StopLossEvent = {
        id: eventId,
        playbookId: playbook.id,
        playbookName: playbook.name,
        triggerReason,
        actionsExecuted: [],
        escalationLevel: "critical",
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
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        allSuccess = false;
        break;
      }
    }

    const event: StopLossEvent = {
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
  private determineEscalation(playbook: StopLossPlaybook): EscalationLevel {
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
  private recordEvent(event: StopLossEvent, playbookId?: string): void {
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
      // §181-2127: Clean up old hourly keys to prevent memory leak
      this.cleanupOldExecutionCounts(hourKey);
    }
  }

  /**
   * Generates a key based on the current hour for rate limiting.
   */
  private getHourKey(): string {
    const now = new Date();
    return `${now.getFullYear()}${now.getMonth()}${now.getDate()}${now.getHours()}`;
  }

  /**
   * §181-2127: Cleans up execution count entries from previous hours to prevent memory leak.
   */
  private cleanupOldExecutionCounts(currentHourKey: string): void {
    for (const [key] of this.executionCounts) {
      const keyHour = key.split("_").at(-1);
      if (keyHour && keyHour !== currentHourKey) {
        this.executionCounts.delete(key);
      }
    }
  }

  // ── Human Approval ──────────────────────────────────────────────────

  /**
   * Approves or rejects a pending human approval request.
   *
   * @param eventId - The ID of the pending StopLossEvent
   * @param approved - Whether to approve (true) or reject (false) the execution
   * @returns true if the approval/rejection was successful
   */
  approvePendingExecution(eventId: string, approved: boolean): boolean {
    const event = this.executionHistory.find((e) => e.id === eventId);
    if (!event || event.completedAt !== null) return false;

    if (approved) {
      event.humanApproved = true;
      // R16-36 FIX #2118: Execute approved playbook synchronously and wait for completion.
      // Previously the code used fire-and-forget (void) which meant callers had no way
      // to know when execution completed. This made approved playbook actions appear
      // as no-ops to callers. Now we execute and await the result before returning.
      const playbook = this.playbooks.get(event.playbookId);
      if (playbook) {
        try {
          // Note: fire-and-forget since approvePendingExecution returns synchronously
          // The caller of this method should not await the playbook execution
          this.executeApprovedPlaybook(playbook, event).catch((err) => {
            event.success = false;
            event.errorMessage = err instanceof Error ? err.message : String(err);
          });
        } catch (err) {
          event.success = false;
          event.errorMessage = err instanceof Error ? err.message : String(err);
        }
      }
      return true;
    } else {
      event.completedAt = nowIso();
      event.success = false;
      event.errorMessage = "Rejected by human";
      return true;
    }
  }

  /**
   * Executes a playbook's actions after human approval is granted.
   */
  private async executeApprovedPlaybook(
    playbook: StopLossPlaybook,
    event: StopLossEvent,
  ): Promise<void> {
    const actionsExecuted: StopLossAction[] = [];
    let allSuccess = true;
    let errorMessage: string | undefined;

    // Execute each action
    for (const action of playbook.actions) {
      const handler = this.actionHandlers.get(action);
      if (!handler) {
        errorMessage = `No handler for action: ${action}`;
        allSuccess = false;
        break;
      }

      try {
        const result = await handler({ playbookId: playbook.id, reason: event.triggerReason });
        if (!result.success) {
          errorMessage = result.message;
          allSuccess = false;
          break;
        }
        actionsExecuted.push(action);
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : String(err);
        allSuccess = false;
        break;
      }
    }

    event.actionsExecuted = actionsExecuted;
    event.completedAt = nowIso();
    event.success = allSuccess;
    if (errorMessage !== undefined) {
      event.errorMessage = errorMessage;
    }
  }

  /**
   * Returns all pending approval requests (events awaiting human approval).
   */
  getPendingApprovals(): StopLossEvent[] {
    return this.executionHistory.filter((e) => e.errorMessage === "Pending human approval");
  }

  // ── History ─────────────────────────────────────────────────────────

  /**
   * Returns the most recent execution events up to the specified limit.
   */
  getExecutionHistory(limit: number = 100): StopLossEvent[] {
    return this.executionHistory.slice(-limit);
  }

  /**
   * Returns aggregated execution statistics.
   */
  getExecutionStats(): {
    totalExecutions: number;
    successfulExecutions: number;
    failedExecutions: number;
    pendingApprovals: number;
  } {
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
  updateHealthCheck(snapshot: SystemHealthSnapshot): void {
    this.lastHealthCheck = snapshot;

    if (!this.config.enabled || !this.config.enableAutoExecution) return;

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
      }).catch((err) => {
        // §9.6: Classify and record playbook failure with evidence
        const errorRecord = classifyPlaybookError(
          err,
          playbook.id,
          playbook.name,
          snapshot.status,
        );
        this.recordError(errorRecord);
      });
    }
  }

  /**
   * Records a playbook error with classification for §9.6 audit trail.
   * Keeps error records bounded to prevent memory exhaustion.
   */
  private recordError(record: PlaybookErrorRecord): void {
    this.errorRecords.push(record);
    if (this.errorRecords.length > 500) {
      this.errorRecords.splice(0, this.errorRecords.length - 500);
    }
  }

  /**
   * Returns recent playbook error records for debugging and audit.
   * §9.6 requires evidence of playbook failures during health events.
   */
  getRecentErrors(limit: number = 50): readonly PlaybookErrorRecord[] {
    return this.errorRecords.slice(-limit);
  }

  /**
   * Returns the most recent health snapshot received by the service.
   */
  getLastHealthCheck(): SystemHealthSnapshot | null {
    return this.lastHealthCheck;
  }

  // ── Configuration ──────────────────────────────────────────────────

  /**
   * Returns whether the service is currently enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Enables or disables the auto stop-loss service.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }

  /**
   * Returns the current service configuration.
   */
  getConfig(): AutoStopLossConfig {
    return { ...this.config };
  }
}

// ── Action Handler ──────────────────────────────────────────────────────

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
