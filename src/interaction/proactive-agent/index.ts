import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { resolveTriggerActionMode } from "./trigger-engine/index.js";
import { shouldConsumeProactiveEvent } from "./event-watcher/index.js";

export interface ProactiveTrigger {
  readonly triggerId: string;
  readonly kind: "schedule" | "event" | "signal";
  readonly expression: string;
  readonly timezone?: string;
}

export interface ProactiveAgentPort {
  registerTrigger(trigger: ProactiveTrigger): Promise<void>;
}

export type CanonicalTriggerType = "schedule" | "event" | "condition" | "webhook";
export type TriggerType = CanonicalTriggerType | "threshold" | "webhook_inbound";

export interface ScheduleTriggerConfig {
  readonly cron: string;
  readonly timezone: string;
  readonly skipIfPreviousRunning: boolean;
}

export interface EventTriggerConfig {
  readonly eventSource: string;
  readonly eventPattern: string;
  readonly filter: Record<string, string>;
  readonly batchWindow?: string;
}

export interface ConditionTriggerConfig {
  readonly metricSource: string;
  readonly metricName: string;
  readonly condition: "gt" | "lt" | "eq" | "change_rate_gt";
  readonly threshold: number;
  readonly evaluationWindow: string;
  readonly consecutiveBreaches: number;
}

export type ThresholdTriggerConfig = ConditionTriggerConfig;

export interface TriggerAction {
  readonly actionType: "create_task" | "create_goal" | "suggest_to_user" | "update_dashboard";
  readonly template: Record<string, unknown>;
  readonly requireConfirmation: boolean;
}

export interface TriggerDefinition {
  readonly triggerId: string;
  readonly domainId: string;
  readonly name: string;
  readonly type: TriggerType;
  readonly config: ScheduleTriggerConfig | EventTriggerConfig | ConditionTriggerConfig;
  readonly action: TriggerAction;
  readonly enabled: boolean;
  readonly riskLevel: "low" | "medium" | "high" | "critical";
  readonly maxFireRate: string;
  readonly cooldown: string;
  readonly maxFireCount?: number;
  readonly boundAgentId?: string;
  readonly feedbackTargetTriggerIds?: readonly string[];
}

export interface TriggerEvaluationInput {
  readonly kind: TriggerType;
  readonly now?: string;
  readonly event?: { source: string; name: string; payload?: Record<string, unknown> };
  readonly metric?: { source: string; name: string; value: number; previousValue?: number };
}

export interface TriggerFireDecision {
  readonly allowed: boolean;
  readonly reasonCodes: readonly string[];
  readonly actionMode: "auto_execute" | "suggest" | "silent_record";
  readonly queuedSuggestionId: string | null;
}

export interface ProactiveSuggestion {
  readonly suggestionId: string;
  readonly triggerId: string;
  readonly domainId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly action: TriggerAction;
  // R9-47: Quality scoring for suggestion ranking
  readonly qualityScore?: number;
  readonly context?: {
    readonly triggerType: string;
    readonly riskLevel: string;
    readonly fireCount: number;
    readonly lastFiredAt: string | null;
  };
}

export interface ProactiveBudgetPool {
  readonly domainId: string;
  readonly totalDailyBudget: number;
  readonly userInitiatedReserveRatio: number;
}

export interface ProactiveIncident {
  readonly incidentId: string;
  readonly triggerIds: readonly string[];
  readonly reasonCode: "proactive_agent.feedback_loop_detected";
  readonly createdAt: string;
}

export interface ProactiveAgentServiceOptions {
  readonly declaredTriggerIdsByDomain?: Readonly<Record<string, readonly string[]>>;
  readonly maxConsecutiveFailures?: number;
  readonly dailyTriggerBudgetByDomain?: Readonly<Record<string, number>>;
  readonly budgetPoolsByDomain?: Readonly<Record<string, ProactiveBudgetPool>>;
  // R5-27: Link autonomy level to proactive triggers
  readonly initialAutonomyLevel?: "suggestion" | "supervised" | "semi_auto" | "full_auto";
}

interface TriggerRuntimeState {
  trigger: TriggerDefinition;
  lastFiredAt: string | null;
  fireTimestamps: string[];
  consecutiveFailures: number;
  fireCount: number;
  /** R5-29: Batched events pending aggregation */
  pendingEvents: Array<{ timestamp: number; event: TriggerEvaluationInput["event"] }>;
}

function parseDurationMs(raw: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw.trim());
  if (!match) {
    return Number.NaN;
  }
  const value = Number(match[1]);
  switch (match[2]) {
    case "ms":
      return value;
    case "s":
      return value * 1000;
    case "m":
      return value * 60_000;
    case "h":
      return value * 3_600_000;
    case "d":
      return value * 86_400_000;
    default:
      return Number.NaN;
  }
}

function parseRateWindow(raw: string): { max: number; windowMs: number } {
  const match = /^(\d+)\/(hour|minute|day)$/.exec(raw.trim());
  if (!match) {
    return { max: 0, windowMs: Number.NaN };
  }
  return {
    max: Number(match[1]),
    windowMs: match[2] === "minute" ? 60_000 : match[2] === "day" ? 86_400_000 : 3_600_000,
  };
}

function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function toDefinition(trigger: ProactiveTrigger | TriggerDefinition): TriggerDefinition {
  if ("type" in trigger) {
    return {
      ...trigger,
      type: normalizeTriggerType(trigger.type),
    };
  }
  return {
    triggerId: trigger.triggerId,
    domainId: "general_ops",
    name: trigger.triggerId,
    type: trigger.kind === "signal" ? "condition" : trigger.kind,
    config: trigger.kind === "schedule"
      ? {
          cron: trigger.expression,
          timezone: trigger.timezone ?? "UTC",
          skipIfPreviousRunning: true,
        }
      : trigger.kind === "event"
        ? {
            eventSource: "unknown",
            eventPattern: trigger.expression,
            filter: {},
          }
        : {
            metricSource: "unknown",
            metricName: trigger.expression,
            condition: "gt",
            threshold: 1,
            evaluationWindow: "5m",
            consecutiveBreaches: 1,
          },
    action: {
      actionType: "suggest_to_user",
      template: {},
      requireConfirmation: true,
    },
    enabled: true,
    riskLevel: "medium",
    maxFireRate: "10/hour",
    cooldown: "5m",
  };
}

function normalizeTriggerType(type: TriggerType): CanonicalTriggerType {
  if (type === "threshold") {
    return "condition";
  }
  if (type === "webhook_inbound") {
    return "webhook";
  }
  return type;
}

export class ProactiveAgentService implements ProactiveAgentPort {
  private readonly states = new Map<string, TriggerRuntimeState>();
  private readonly suggestions = new Map<string, ProactiveSuggestion>();
  private readonly declaredTriggerIdsByDomain: Readonly<Record<string, readonly string[]>>;
  private readonly maxConsecutiveFailures: number;
  private readonly dailyTriggerBudgetByDomain: Readonly<Record<string, number>>;
  private readonly dailyTriggerUsage = new Map<string, number>();
  private readonly budgetPoolsByDomain: Readonly<Record<string, ProactiveBudgetPool>>;
  private readonly incidents: ProactiveIncident[] = [];
  // R5-27: Autonomy level linked to proactive triggers
  private currentAutonomyLevel: "suggestion" | "supervised" | "semi_auto" | "full_auto" = "full_auto";

  public constructor(options: ProactiveAgentServiceOptions = {}) {
    this.declaredTriggerIdsByDomain = options.declaredTriggerIdsByDomain ?? {};
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.dailyTriggerBudgetByDomain = options.dailyTriggerBudgetByDomain ?? {};
    this.budgetPoolsByDomain = options.budgetPoolsByDomain ?? {};
    this.currentAutonomyLevel = options.initialAutonomyLevel ?? "full_auto";
  }

  /**
   * R5-27: Update autonomy level - changes affect trigger action mode
   */
  public setAutonomyLevel(level: "suggestion" | "supervised" | "semi_auto" | "full_auto"): void {
    this.currentAutonomyLevel = level;
  }

  /**
   * R5-27: Get current autonomy level
   */
  public getAutonomyLevel(): "suggestion" | "supervised" | "semi_auto" | "full_auto" {
    return this.currentAutonomyLevel;
  }

  /**
   * R5-27: Get autonomy-adjusted action mode based on current autonomy level
   * Lower autonomy levels restrict auto_execute more heavily
   */
  private getAutonomyAdjustedActionMode(
    baseActionMode: "auto_execute" | "suggest" | "silent_record",
  ): "auto_execute" | "suggest" | "silent_record" {
    // If base mode is already suggest or silent_record, keep it
    if (baseActionMode !== "auto_execute") {
      return baseActionMode;
    }

    // R5-27: Restrict auto_execute based on autonomy level
    switch (this.currentAutonomyLevel) {
      case "suggestion":
        // Suggestion level only allows suggest mode
        return "suggest";
      case "supervised":
        // Supervised only allows suggest for most actions
        return "suggest";
      case "semi_auto":
        return baseActionMode;
      case "full_auto":
        // Full auto can use base mode
        return baseActionMode;
    }
  }

  public async registerTrigger(trigger: ProactiveTrigger | TriggerDefinition): Promise<void> {
    const definition = toDefinition(trigger);
    if (definition.type === "schedule") {
      const scheduleConfig = definition.config as ScheduleTriggerConfig;
      if (!isValidTimezone(scheduleConfig.timezone)) {
        throw new Error(`proactive_agent.invalid_timezone:${scheduleConfig.timezone}`);
      }
      if (!isValidCronExpression(scheduleConfig.cron)) {
        throw new Error(`proactive_agent.invalid_cron:${scheduleConfig.cron}`);
      }
    }
    const declared = this.declaredTriggerIdsByDomain[definition.domainId];
    if (declared != null && !declared.includes(definition.triggerId)) {
      throw new Error(`proactive_agent.trigger_not_declared:${definition.domainId}:${definition.triggerId}`);
    }
    this.states.set(definition.triggerId, {
      trigger: definition,
      lastFiredAt: null,
      fireTimestamps: [],
      consecutiveFailures: 0,
      fireCount: 0,
      // R5-29: Initialize pending events for batch aggregation
      pendingEvents: [],
    });
    this.detectFeedbackLoop(definition.triggerId);
  }

  public listTriggers(domainId?: string): TriggerDefinition[] {
    return [...this.states.values()]
      .map((entry) => entry.trigger)
      .filter((trigger) => domainId == null || trigger.domainId === domainId);
  }

  public listSuggestions(domainId?: string): ProactiveSuggestion[] {
    return [...this.suggestions.values()]
      .filter((item) => domainId == null || item.domainId === domainId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }

  public listIncidents(): ProactiveIncident[] {
    return [...this.incidents];
  }

  public evaluate(triggerId: string, input: TriggerEvaluationInput): TriggerFireDecision {
    const state = this.states.get(triggerId);
    if (state == null) {
      return { allowed: false, reasonCodes: ["proactive_agent.trigger_not_found"], actionMode: "silent_record", queuedSuggestionId: null };
    }

    const reasons: string[] = [];
    if (!state.trigger.enabled) {
      reasons.push("proactive_agent.trigger_disabled");
    }
    if (state.consecutiveFailures >= this.maxConsecutiveFailures) {
      reasons.push("proactive_agent.circuit_open");
    }
    const now = new Date(input.now ?? nowIso()).getTime();
    const dailyBudget = this.dailyTriggerBudgetByDomain[state.trigger.domainId];
    const usageKey = `${state.trigger.domainId}:${new Date(now).toISOString().slice(0, 10)}`;
    if (dailyBudget != null && (this.dailyTriggerUsage.get(usageKey) ?? 0) >= dailyBudget) {
      reasons.push("proactive_agent.domain_budget_exhausted");
    }
    const budgetPool = this.budgetPoolsByDomain[state.trigger.domainId];
    if (budgetPool != null) {
      const proactiveBudgetCap = Math.floor(
        budgetPool.totalDailyBudget * (1 - Math.max(0.6, budgetPool.userInitiatedReserveRatio)),
      );
      if ((this.dailyTriggerUsage.get(usageKey) ?? 0) >= proactiveBudgetCap) {
        reasons.push("proactive_agent.user_initiated_reserve_protected");
      }
    }

    const cooldownMs = parseDurationMs(state.trigger.cooldown);
    if (!Number.isFinite(cooldownMs)) {
      reasons.push("proactive_agent.invalid_cooldown");
    }
    if (state.lastFiredAt != null && cooldownMs > 0 && now - new Date(state.lastFiredAt).getTime() < cooldownMs) {
      reasons.push("proactive_agent.cooldown_active");
    }

    const { max, windowMs } = parseRateWindow(state.trigger.maxFireRate);
    if (!Number.isFinite(windowMs) || max <= 0) {
      reasons.push("proactive_agent.invalid_rate_limit");
    }
    if (windowMs > 0) {
      state.fireTimestamps = state.fireTimestamps.filter(
        (timestamp) => now - new Date(timestamp).getTime() <= windowMs,
      );
      const recentFireCount = state.fireTimestamps.length;
      if (recentFireCount >= max) {
        reasons.push("proactive_agent.rate_limited");
      }
    }
    if (state.trigger.maxFireCount != null && state.fireCount >= state.trigger.maxFireCount) {
      reasons.push("proactive_agent.max_fire_count_reached");
    }

    if (!this.matchesTrigger(state.trigger, input)) {
      reasons.push("proactive_agent.trigger_condition_not_met");
    }

    // R5-29: Batch window aggregation - accumulate events for batch evaluation
    const triggerConfig = state.trigger.config;
    if ("batchWindow" in triggerConfig && triggerConfig.batchWindow != null && input.event != null) {
      const batchWindowMs = parseDurationMs(triggerConfig.batchWindow);
      if (!Number.isFinite(batchWindowMs)) {
        reasons.push("proactive_agent.invalid_batch_window");
      } else if (batchWindowMs > 0) {
        // Add event to pending batch
        state.pendingEvents.push({ timestamp: now, event: input.event });
        // Filter out expired events from batch
        state.pendingEvents = state.pendingEvents.filter(
          (e) => now - e.timestamp <= batchWindowMs,
        );
        // R5-29: If this is not the first event in the batch window, aggregate and fire
        // If this IS the first event (pendingEvents.length was 0 or 1 before this push),
        // delay firing until batch window closes or more events arrive
        if (state.pendingEvents.length > 1) {
          // We have multiple events - batch is complete, fire with aggregated events
          // Clear the batch after we decide to fire
          state.pendingEvents = [];
        } else if (state.pendingEvents.length === 1) {
          // First event in batch - delay firing by adding pending reason
          // The event stays in pendingEvents and will be aggregated with subsequent events
          // or fired when the next evaluation occurs after the window has passed
          reasons.push("proactive_agent.batch_aggregation_pending");
        }
      }
    }

    // R5-27 / §42.5: Require semi_auto+ autonomy level to fire triggers
    if (this.currentAutonomyLevel !== "semi_auto" && this.currentAutonomyLevel !== "full_auto") {
      reasons.push("proactive_agent.autonomy_level_insufficient");
    }

    if (reasons.length > 0) {
      return {
        allowed: false,
        reasonCodes: reasons,
        actionMode: "silent_record",
        queuedSuggestionId: null,
      };
    }

    state.lastFiredAt = new Date(now).toISOString();
    state.fireTimestamps.push(state.lastFiredAt);
    state.fireCount += 1;
    if (dailyBudget != null) {
      this.dailyTriggerUsage.set(usageKey, (this.dailyTriggerUsage.get(usageKey) ?? 0) + 1);
    }
    const baseActionMode = state.trigger.action.actionType === "update_dashboard"
      ? "silent_record"
      : resolveTriggerActionMode(state.trigger.action.requireConfirmation, state.trigger.riskLevel);
    // R5-27: Apply autonomy level adjustment to action mode
    const actionMode = this.getAutonomyAdjustedActionMode(baseActionMode);
    const queuedSuggestionId = actionMode === "suggest" ? this.enqueueSuggestion(state.trigger) : null;

    return {
      allowed: true,
      reasonCodes: ["proactive_agent.fire_allowed"],
      actionMode,
      queuedSuggestionId,
    };
  }

  public recordExecutionOutcome(triggerId: string, success: boolean): void {
    const state = this.states.get(triggerId);
    if (state == null) {
      return;
    }
    state.consecutiveFailures = success ? 0 : state.consecutiveFailures + 1;
    if (!success && state.consecutiveFailures >= this.maxConsecutiveFailures) {
      state.trigger = {
        ...state.trigger,
        enabled: false,
      };
    }
  }

  public acknowledgeSuggestion(suggestionId: string): boolean {
    return this.suggestions.delete(suggestionId);
  }

  private matchesTrigger(trigger: TriggerDefinition, input: TriggerEvaluationInput): boolean {
    if (normalizeTriggerType(trigger.type) !== normalizeTriggerType(input.kind)) {
      return false;
    }

    if (normalizeTriggerType(trigger.type) === "schedule") {
      const config = trigger.config as ScheduleTriggerConfig;
      if (input.now == null) {
        return true;
      }
      return matchesCronSchedule(input.now, config.cron, config.timezone);
    }

    if (normalizeTriggerType(trigger.type) === "event" || normalizeTriggerType(trigger.type) === "webhook") {
      const config = trigger.config as EventTriggerConfig;
      return input.event != null
        && shouldConsumeProactiveEvent(input.event, config.eventSource, config.eventPattern)
        && Object.entries(config.filter).every(([key, value]) => String(input.event?.payload?.[key] ?? "") === value);
    }

    if (normalizeTriggerType(trigger.type) === "condition") {
      const config = trigger.config as ConditionTriggerConfig;
      const metric = input.metric;
      if (metric == null || metric.source !== config.metricSource || metric.name !== config.metricName) {
        return false;
      }
      if (config.condition === "gt") return metric.value > config.threshold;
      if (config.condition === "lt") return metric.value < config.threshold;
      if (config.condition === "eq") return metric.value === config.threshold;
      if (metric.previousValue == null) return false;
      // R32-27 fix: change_rate_gt must compute rate of change = |v-prev|/|prev|, not absolute difference
      const rateOfChange = Math.abs(metric.previousValue) > 0
        ? Math.abs(metric.value - metric.previousValue) / Math.abs(metric.previousValue)
        : 0;
      return rateOfChange > config.threshold;
    }

    return true;
  }

  private enqueueSuggestion(trigger: TriggerDefinition): string {
    const suggestionId = newId("suggestion");

    // R9-47: Compute quality score based on context factors
    const qualityScore = this.computeSuggestionQuality(trigger);

    this.suggestions.set(suggestionId, {
      suggestionId,
      triggerId: trigger.triggerId,
      domainId: trigger.domainId,
      createdAt: nowIso(),
      title: `Suggestion from trigger ${trigger.name}`,
      action: trigger.action,
      qualityScore,
      context: {
        triggerType: trigger.type,
        riskLevel: trigger.riskLevel,
        fireCount: this.states.get(trigger.triggerId)?.fireCount ?? 0,
        lastFiredAt: this.states.get(trigger.triggerId)?.lastFiredAt ?? null,
      },
    });
    return suggestionId;
  }

  /**
   * R9-47: Compute quality score for a suggestion based on context
   * Higher scores indicate better suggestion quality for ranking
   */
  private computeSuggestionQuality(trigger: TriggerDefinition): number {
    let score = 0.5; // Base score

    // Risk level factor: critical/high suggestions should be prioritized
    switch (trigger.riskLevel) {
      case "critical":
        score += 0.3;
        break;
      case "high":
        score += 0.2;
        break;
      case "medium":
        score += 0.1;
        break;
      case "low":
        score -= 0.1;
        break;
    }

    // Recency factor: recently fired triggers get higher scores (more relevant)
    const state = this.states.get(trigger.triggerId);
    if (state?.lastFiredAt != null) {
      const timeSinceLastFire = Date.now() - new Date(state.lastFiredAt).getTime();
      const hourInMs = 3_600_000;
      if (timeSinceLastFire < hourInMs) {
        score += 0.15; // Fired within last hour
      } else if (timeSinceLastFire < hourInMs * 24) {
        score += 0.1; // Fired within last 24 hours
      }
    }

    // Fire count factor: triggers with recent activity are more relevant
    if (state != null && state.fireCount > 0) {
      score += Math.min(0.1, state.fireCount * 0.01);
    }

    // Domain factor: high-risk domains get priority boost
    const highRiskDomains = ["finance-accounting", "legal", "medical", "healthcare", "quant-trading"];
    if (highRiskDomains.includes(trigger.domainId)) {
      score += 0.1;
    }

    // Cooldown factor: suggestions outside cooldown are more actionable
    const cooldownMs = parseDurationMs(trigger.cooldown);
    if (state?.lastFiredAt != null && cooldownMs > 0) {
      const timeSinceLastFire = Date.now() - new Date(state.lastFiredAt).getTime();
      if (timeSinceLastFire >= cooldownMs) {
        score += 0.05; // Outside cooldown window
      }
    }

    return Math.max(0, Math.min(1, score)); // Clamp to [0, 1]
  }

  private detectFeedbackLoop(triggerId: string): void {
    // R23-12 FIX: Use iterative DFS with explicit path tracking to capture all cycle members
    const visited = new Set<string>();
    const path: string[] = [];
    const pathSet = new Set<string>();

    const findCycle = (currentId: string): string[] | null => {
      if (pathSet.has(currentId)) {
        // Found cycle - return the cycle nodes starting from where currentId first appears in path
        const cycleStart = path.indexOf(currentId);
        return path.slice(cycleStart);
      }
      if (visited.has(currentId)) {
        return null; // Already explored this node, no cycle through this path
      }
      visited.add(currentId);
      path.push(currentId);
      pathSet.add(currentId);

      const targets = this.states.get(currentId)?.trigger.feedbackTargetTriggerIds ?? [];
      for (const nextId of targets) {
        const cycle = findCycle(nextId);
        if (cycle !== null) {
          return cycle;
        }
      }

      path.pop();
      pathSet.delete(currentId);
      return null;
    };

    const cycleNodes = findCycle(triggerId);
    if (cycleNodes === null || cycleNodes.length === 0) {
      return;
    }

    // R23-12 FIX: Report ALL triggerIds involved in the cycle, not just DFS stack
    this.incidents.push({
      incidentId: newId("proactive_incident"),
      triggerIds: cycleNodes,
      reasonCode: "proactive_agent.feedback_loop_detected",
      createdAt: nowIso(),
    });
    for (const loopTriggerId of cycleNodes) {
      const state = this.states.get(loopTriggerId);
      if (state != null) {
        state.trigger = {
          ...state.trigger,
          enabled: false,
        };
      }
    }
  }
}

const WEEKDAY_INDEX: Readonly<Record<string, number>> = {
  Sun: 0,
  Mon: 1,
  Tue: 2,
  Wed: 3,
  Thu: 4,
  Fri: 5,
  Sat: 6,
};

function isValidCronExpression(expression: string): boolean {
  const fields = parseCronFields(expression);
  if (fields == null) {
    return false;
  }
  return validateCronField(fields[0], 0, 59)
    && validateCronField(fields[1], 0, 23)
    && validateCronField(fields[2], 1, 31)
    && validateCronField(fields[3], 1, 12)
    && validateCronField(fields[4], 0, 7);
}

function matchesCronSchedule(nowIso: string, expression: string, timezone: string): boolean {
  const fields = parseCronFields(expression);
  if (fields == null) {
    return false;
  }
  const date = new Date(nowIso);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const parts = getZonedDateParts(date, timezone);
  return matchesCronField(fields[0], parts.minute, 0, 59)
    && matchesCronField(fields[1], parts.hour, 0, 23)
    && matchesCronField(fields[2], parts.dayOfMonth, 1, 31)
    && matchesCronField(fields[3], parts.month, 1, 12)
    && matchesCronField(fields[4], parts.dayOfWeek, 0, 7);
}

function parseCronFields(expression: string): readonly [string, string, string, string, string] | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return null;
  }
  return fields as [string, string, string, string, string];
}

function getZonedDateParts(date: Date, timezone: string): {
  readonly minute: number;
  readonly hour: number;
  readonly dayOfMonth: number;
  readonly month: number;
  readonly dayOfWeek: number;
} {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const weekday = parts.find((part) => part.type === "weekday")?.value ?? "Sun";
  return {
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    dayOfMonth: Number(parts.find((part) => part.type === "day")?.value ?? "1"),
    month: Number(parts.find((part) => part.type === "month")?.value ?? "1"),
    dayOfWeek: WEEKDAY_INDEX[weekday] ?? 0,
  };
}

function validateCronField(field: string, min: number, max: number): boolean {
  return field.split(",").every((segment) => validateCronSegment(segment.trim(), min, max));
}

function validateCronSegment(segment: string, min: number, max: number): boolean {
  if (segment.length === 0) {
    return false;
  }
  const [base = "", stepRaw] = segment.split("/");
  if (stepRaw != null) {
    const step = Number(stepRaw);
    if (!Number.isInteger(step) || step <= 0) {
      return false;
    }
  }
  if (base === "*") {
    return true;
  }
  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    return isCronValueInRange(startRaw, min, max) && isCronValueInRange(endRaw, min, max) && Number(startRaw) <= Number(endRaw);
  }
  return isCronValueInRange(base, min, max);
}

function matchesCronField(field: string, value: number, min: number, max: number): boolean {
  return field.split(",").some((segment) => matchesCronSegment(segment.trim(), value, min, max));
}

function matchesCronSegment(segment: string, value: number, min: number, max: number): boolean {
  const [base = "", stepRaw] = segment.split("/");
  const step = stepRaw == null ? 1 : Number(stepRaw);
  if (!Number.isInteger(step) || step <= 0) {
    return false;
  }

  if (base === "*") {
    return (value - min) % step === 0;
  }

  if (base.includes("-")) {
    const [startRaw, endRaw] = base.split("-");
    const start = normalizeCronValue(Number(startRaw), min, max);
    const end = normalizeCronValue(Number(endRaw), min, max);
    return start != null
      && end != null
      && value >= start
      && value <= end
      && (value - start) % step === 0;
  }

  const exact = normalizeCronValue(Number(base), min, max);
  return exact != null && exact === value;
}

function isCronValueInRange(raw: string | undefined, min: number, max: number): boolean {
  if (raw == null || raw.length === 0) {
    return false;
  }
  return normalizeCronValue(Number(raw), min, max) != null;
}

function normalizeCronValue(value: number, min: number, max: number): number | null {
  if (!Number.isInteger(value)) {
    return null;
  }
  if (min === 0 && max === 7 && value === 7) {
    return 0;
  }
  return value >= min && value <= max ? value : null;
}
