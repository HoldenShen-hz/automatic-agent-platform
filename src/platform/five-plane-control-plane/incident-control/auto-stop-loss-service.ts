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
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import {
  DEFAULT_PLAYBOOKS,
  HEALTH_TO_ESCALATION,
  SEVERITY_TO_ESCALATION,
  type ActionHandler,
  type AutoStopLossConfig,
  type ConditionMatchContext,
  type EscalationLevel,
  type PendingApprovalExecution,
  type PlaybookCondition,
  type StopLossAction,
  type StopLossEvent,
  type StopLossPlaybook,
  type SystemHealthSnapshot,
} from "./auto-stop-loss-types.js";

const logger = new StructuredLogger({ retentionLimit: 100 });

// ── Service ─────────────────────────────────────────────────────────────
export type {
  ActionContext,
  ActionHandler,
  ActionResult,
  AutoStopLossConfig,
  ConditionMatchContext,
  EscalationLevel,
  PendingApprovalExecution,
  PlaybookCondition,
  StopLossAction,
  StopLossEvent,
  StopLossPlaybook,
  SystemHealthSnapshot,
} from "./auto-stop-loss-types.js";

export interface AutoStopLossServiceOptions {
  config?: Partial<AutoStopLossConfig>;
  playbooks?: StopLossPlaybook[];
  now?: () => Date;
}

/**
 * AutoStopLossService provides automated protective actions when system anomalies
 * or health degradation are detected. It evaluates anomalies and health snapshots
 * against registered playbooks, executing protective actions while respecting
 * cooldown periods and rate limits.
 */
export class AutoStopLossService {
  private readonly config: AutoStopLossConfig;
  private readonly now: () => Date;
  private readonly playbooks: Map<string, StopLossPlaybook> = new Map();
  private readonly executionHistory: Map<number, StopLossEvent> = new Map();
  private executionHistorySeq = 0;
  private oldestExecutionHistorySeq = 0;
  private readonly MAX_EXECUTION_HISTORY = 1000;
  private readonly executionCounts: Map<string, number> = new Map();
  private readonly lastExecutionTime: Map<string, number> = new Map();
  private readonly pendingApprovals: Map<string, PendingApprovalExecution> = new Map();
  private readonly actionHandlers: Map<StopLossAction, ActionHandler> = new Map();
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
    this.now = options?.now ?? (() => new Date());

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
    return this.normalizeAnomalySeverity(context?.anomalySeverity ?? context?.severity);
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

  private normalizeSeverityAlias(normalized: string): AnomalySeverity | undefined {
    const aliases: Readonly<Record<string, AnomalySeverity>> = {
      info: "info",
      informational: "info",
      sev_info: "info",
      warning: "warning",
      warn: "warning",
      sev_warning: "warning",
      critical: "critical",
      crit: "critical",
      sev_critical: "critical",
      emergency: "emergency",
      sev_emergency: "emergency",
    };
    return aliases[normalized];
  }

  private normalizeAnomalySeverity(value: unknown): AnomalySeverity | undefined {
    if (this.isAnomalySeverity(value)) {
      return value;
    }
    if (typeof value !== "string") {
      return undefined;
    }

    const normalized = value.trim().toLowerCase().replace(/[\s-]+/g, "_");
    return this.normalizeSeverityAlias(normalized);
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
    return this.now().getTime() - lastExec < playbook.cooldownMs;
  }

  /**
   * Checks if a playbook has exceeded its hourly execution limit.
   */
  private isPlaybookRateLimited(playbook: StopLossPlaybook): boolean {
    const hourKey = this.getHourKey();
    this.pruneExecutionCounts(hourKey);
    const count = this.executionCounts.get(`${playbook.id}_${hourKey}`) ?? 0;
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
    let actionsExecuted: StopLossAction[] = [];
    let allSuccess = true;
    let errorMessage: string | undefined;
    const escalationLevel = this.resolveEscalationLevel(playbook, context);

    // Check if human approval is required
    if (playbook.requireHumanApproval && this.config.enableHumanEscalation) {
      // Queue for human approval instead of auto-executing
      const event: StopLossEvent = {
        id: eventId,
        playbookId: playbook.id,
        playbookName: playbook.name,
        triggerReason,
        actionsExecuted: [],
        escalationLevel,
        executedAt: startTime,
        completedAt: null,
        success: false,
        errorMessage: "Pending human approval",
        autoTriggered: false,
        humanApproved: false,
      };
      this.pendingApprovals.set(eventId, {
        playbook,
        triggerReason,
        ...(context !== undefined ? { context } : {}),
      });
      // Persist the pending event immediately so approvals can be listed and resolved later.
      // Do not update cooldown or hourly execution counters until human approval succeeds.
      this.recordEvent(event);
      return event;
    }

    // Execute each action
    ({ actionsExecuted, allSuccess, errorMessage } = await this.executeActions(playbook, triggerReason, context));

    const event: StopLossEvent = {
      id: eventId,
      playbookId: playbook.id,
      playbookName: playbook.name,
      triggerReason,
      actionsExecuted,
      escalationLevel,
      executedAt: startTime,
      completedAt: nowIso(),
      success: allSuccess,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
      autoTriggered: true,
      humanApproved: false,
    };

    this.recordEvent(event, playbook.id);
    this.lastExecutionTime.set(playbook.id, this.now().getTime());

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

  private resolveEscalationLevel(
    playbook: StopLossPlaybook,
    context?: Record<string, unknown>,
  ): EscalationLevel {
    const severity = this.getContextAnomalySeverity(context);
    if (severity !== undefined) {
      return SEVERITY_TO_ESCALATION[severity];
    }
    const healthStatus = this.getContextHealthStatus(context);
    if (healthStatus !== undefined) {
      return HEALTH_TO_ESCALATION[healthStatus] ?? "observe";
    }
    return this.determineEscalation(playbook);
  }

  private async executeActions(
    playbook: StopLossPlaybook,
    triggerReason: string,
    context?: Record<string, unknown>,
  ): Promise<{ actionsExecuted: StopLossAction[]; allSuccess: boolean; errorMessage?: string }> {
    const actionsExecuted: StopLossAction[] = [];
    for (const action of playbook.actions) {
      const handler = this.actionHandlers.get(action);
      if (!handler) {
        return {
          actionsExecuted,
          allSuccess: false,
          errorMessage: `No handler for action: ${action}`,
        };
      }

      try {
        const result = await handler({ playbookId: playbook.id, reason: triggerReason, ...context });
        if (!result.success) {
          return {
            actionsExecuted,
            allSuccess: false,
            errorMessage: result.message,
          };
        }
        actionsExecuted.push(action);
      } catch (err) {
        return {
          actionsExecuted,
          allSuccess: false,
          errorMessage: err instanceof Error ? err.message : String(err),
        };
      }
    }

    return { actionsExecuted, allSuccess: true };
  }

  /**
   * Records an execution event and updates rate limit counters.
   */
  private recordEvent(event: StopLossEvent, playbookId?: string): void {
    const seq = this.executionHistorySeq++;
    this.executionHistory.set(seq, event);

    // Keep history bounded to prevent memory exhaustion - O(1) eviction
    while (this.executionHistory.size > this.MAX_EXECUTION_HISTORY) {
      this.executionHistory.delete(this.oldestExecutionHistorySeq++);
    }

    // Update rate limit counters (reset hourly via hour key)
    if (playbookId) {
      this.incrementExecutionCount(playbookId);
    }
  }

  private incrementExecutionCount(playbookId: string): void {
    const hourKey = this.getHourKey();
    this.pruneExecutionCounts(hourKey);
    const countKey = `${playbookId}_${hourKey}`;
    const currentCount = this.executionCounts.get(countKey) ?? 0;
    this.executionCounts.set(countKey, currentCount + 1);
  }

  private pruneExecutionCounts(currentHourKey: string): void {
    for (const countKey of this.executionCounts.keys()) {
      if (!countKey.endsWith(`_${currentHourKey}`)) {
        this.executionCounts.delete(countKey);
      }
    }
  }

  /**
   * Generates a key based on the current hour for rate limiting.
   */
  private getHourKey(): string {
    const now = this.now();
    const month = String(now.getUTCMonth() + 1).padStart(2, "0");
    const day = String(now.getUTCDate()).padStart(2, "0");
    const hours = String(now.getUTCHours()).padStart(2, "0");
    return `${now.getUTCFullYear()}-${month}-${day}T${hours}`;
  }

  // ── Human Approval ──────────────────────────────────────────────────

  /**
   * Approves or rejects a pending human approval request.
   *
   * @param eventId - The ID of the pending StopLossEvent
   * @param approved - Whether to approve (true) or reject (false) the execution
   * @returns true if the approval/rejection was successful
   */
  async approvePendingExecution(eventId: string, approved: boolean): Promise<boolean> {
    let foundSeq: number | null = null;
    let event: StopLossEvent | undefined;
    for (const [seq, e] of this.executionHistory.entries()) {
      if (e.id === eventId) {
        foundSeq = seq;
        event = e;
        break;
      }
    }
    if (foundSeq === null || !event || event.completedAt !== null) return false;
    const pendingExecution = this.pendingApprovals.get(eventId);
    if (!pendingExecution) {
      return false;
    }

    if (approved) {
      const executionResult = await this.executeActions(
        pendingExecution.playbook,
        pendingExecution.triggerReason,
        pendingExecution.context,
      );
      event.humanApproved = true;
      event.completedAt = nowIso();
      event.success = executionResult.allSuccess;
      event.actionsExecuted = executionResult.actionsExecuted;
      event.escalationLevel = this.resolveEscalationLevel(
        pendingExecution.playbook,
        pendingExecution.context,
      );
      if (executionResult.errorMessage !== undefined) {
        event.errorMessage = executionResult.errorMessage;
      } else {
        delete event.errorMessage;
      }
      this.incrementExecutionCount(pendingExecution.playbook.id);
      this.lastExecutionTime.set(pendingExecution.playbook.id, this.now().getTime());
      this.pendingApprovals.delete(eventId);
      return true;
    } else {
      event.completedAt = nowIso();
      event.success = false;
      event.errorMessage = "Rejected by human";
      this.pendingApprovals.delete(eventId);
      return true;
    }
  }

  /**
   * Returns all pending approval requests (events awaiting human approval).
   */
  getPendingApprovals(): StopLossEvent[] {
    return [...this.executionHistory.values()].filter((e) => e.errorMessage === "Pending human approval");
  }

  // ── History ─────────────────────────────────────────────────────────

  /**
   * Returns the most recent execution events up to the specified limit.
   */
  getExecutionHistory(limit: number = 100): StopLossEvent[] {
    const sortedSeqs = [...this.executionHistory.keys()].sort((a, b) => a - b);
    const startIdx = Math.max(0, sortedSeqs.length - limit);
    const selectedSeqs = sortedSeqs.slice(startIdx);
    return selectedSeqs.map((seq) => this.executionHistory.get(seq)!);
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
    const events = [...this.executionHistory.values()];
    return {
      totalExecutions: events.length,
      successfulExecutions: events.filter((e) => e.success).length,
      failedExecutions: events.filter((e) => !e.success && e.completedAt !== null).length,
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
    // R11-30 fix: properly handle rejections with logger.error instead of silent swallow
    for (const playbook of matchingPlaybooks) {
      void this.executePlaybook(playbook, `Health check: ${snapshot.status}`, {
        healthStatus: snapshot.status,
        ...snapshot,
      }).catch((err) => {
        this.recordPlaybookError(playbook.id, snapshot.status, err);
      });
    }
  }

  private recordPlaybookError(
    playbookId: string,
    healthStatus: SystemHealthSnapshot["status"],
    error: unknown,
  ): void {
    const classified = this.classifyPlaybookError(error);
    logger.error("auto_stop_loss.playbook_execution_failed", {
      playbookId,
      healthStatus,
      errorCode: classified.code,
      errorMessage: classified.message,
    });
  }

  private classifyPlaybookError(error: unknown): { readonly code: string; readonly message: string } {
    if (error instanceof Error) {
      return {
        code: error.name?.trim().length > 0 ? `playbook.${this.toSnakeCase(error.name)}` : "playbook.execution_failed",
        message: error.message,
      };
    }
    return {
      code: "playbook.execution_failed",
      message: String(error),
    };
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
