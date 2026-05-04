import { newId, nowIso } from "../../platform/contracts/types/ids.js";
import { resolveTriggerActionMode } from "./trigger-engine/index.js";

export interface ProactiveTrigger {
  readonly triggerId: string;
  readonly kind: "schedule" | "event" | "signal";
  readonly expression: string;
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

export interface ProactiveSuggestionContext {
  readonly triggerType: CanonicalTriggerType;
  readonly riskLevel: TriggerDefinition["riskLevel"];
  readonly sourceSummary: string;
  readonly matchedSignal: string | null;
  readonly targetDomainId: string;
  readonly requireConfirmation: boolean;
}

export interface ProactiveSuggestion {
  readonly suggestionId: string;
  readonly triggerId: string;
  readonly domainId: string;
  readonly createdAt: string;
  readonly title: string;
  readonly action: TriggerAction;
  readonly context: ProactiveSuggestionContext;
  readonly qualityScore: number;
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
  /** §42.5: Current autonomy level to check before auto_execution (requires semi_auto+ for medium+ risk) */
  readonly currentAutonomyLevel?: "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";
  /** §41.1: Optional domain descriptor validator - validates trigger attributes against domain capabilities */
  readonly domainDescriptorValidator?: (
    domainId: string,
    trigger: TriggerDefinition,
  ) => readonly string[] | null;
}

interface TriggerRuntimeState {
  trigger: TriggerDefinition;
  lastFiredAt: string | null;
  fireTimestamps: string[];
  consecutiveFailures: number;
  fireCount: number;
  pendingBatch: TriggerBatchState | null;
}

interface TriggerBatchState {
  openedAt: string;
  lastEventAt: string;
  events: {
    source: string;
    name: string;
    payload?: Record<string, unknown>;
  }[];
}

function parseDurationMs(raw: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(raw.trim());
  if (!match) {
    return 0;
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
      return 0;
  }
}

function parseRateWindow(raw: string): { max: number; windowMs: number } {
  const match = /^(\d+)\/(hour|minute|day)$/.exec(raw.trim());
  if (!match) {
    return { max: Number.POSITIVE_INFINITY, windowMs: 0 };
  }
  return {
    max: Number(match[1]),
    windowMs: match[2] === "minute" ? 60_000 : match[2] === "day" ? 86_400_000 : 3_600_000,
  };
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
          timezone: "UTC",
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

function buildSuggestionContext(
  trigger: TriggerDefinition,
  input: TriggerEvaluationInput,
): ProactiveSuggestionContext {
  const normalizedType = normalizeTriggerType(trigger.type);
  if ((normalizedType === "event" || normalizedType === "webhook") && input.event != null) {
    return {
      triggerType: normalizedType,
      riskLevel: trigger.riskLevel,
      sourceSummary: `${input.event.source}:${input.event.name}`,
      matchedSignal: input.event.payload == null ? null : JSON.stringify(input.event.payload),
      targetDomainId: trigger.domainId,
      requireConfirmation: trigger.action.requireConfirmation,
    };
  }

  if (normalizedType === "condition" && input.metric != null) {
    const previousValue = input.metric.previousValue == null ? "" : ` (prev ${input.metric.previousValue})`;
    return {
      triggerType: normalizedType,
      riskLevel: trigger.riskLevel,
      sourceSummary: `${input.metric.source}:${input.metric.name}`,
      matchedSignal: `${input.metric.value}${previousValue}`,
      targetDomainId: trigger.domainId,
      requireConfirmation: trigger.action.requireConfirmation,
    };
  }

  return {
    triggerType: normalizedType,
    riskLevel: trigger.riskLevel,
    sourceSummary: trigger.name,
    matchedSignal: null,
    targetDomainId: trigger.domainId,
    requireConfirmation: trigger.action.requireConfirmation,
  };
}

function generateSuggestionTitle(trigger: TriggerDefinition, context: ProactiveSuggestionContext): string {
  const riskLabel = context.riskLevel === "critical" ? "critical" : context.riskLevel;
  if (context.matchedSignal != null && context.matchedSignal.length > 0) {
    return `[${riskLabel}] ${trigger.name}: ${context.sourceSummary}`;
  }
  return `[${riskLabel}] ${trigger.name}`;
}

function scoreSuggestionQuality(trigger: TriggerDefinition, context: ProactiveSuggestionContext): number {
  let score = 0.4;
  if (context.matchedSignal != null && context.matchedSignal.length > 0) {
    score += 0.2;
  }
  if (Object.keys(trigger.action.template).length > 0) {
    score += 0.15;
  }
  if (trigger.boundAgentId != null) {
    score += 0.1;
  }
  if (trigger.feedbackTargetTriggerIds != null && trigger.feedbackTargetTriggerIds.length > 0) {
    score += 0.05;
  }
  if (trigger.riskLevel === "low") {
    score += 0.05;
  }
  return Number(Math.min(1, score).toFixed(4));
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
  /** §42.5: Current autonomy level for trigger-autonomy linkage */
  private readonly currentAutonomyLevel: "suggestion" | "supervised" | "semi_auto" | "full_auto" | "frozen";
  /** §41.1: Domain descriptor validator for trigger attribute validation */
  private readonly domainDescriptorValidator: (
    domainId: string,
    trigger: TriggerDefinition,
  ) => readonly string[] | null;

  public constructor(options: ProactiveAgentServiceOptions = {}) {
    this.declaredTriggerIdsByDomain = options.declaredTriggerIdsByDomain ?? {};
    this.maxConsecutiveFailures = options.maxConsecutiveFailures ?? 3;
    this.dailyTriggerBudgetByDomain = options.dailyTriggerBudgetByDomain ?? {};
    this.budgetPoolsByDomain = options.budgetPoolsByDomain ?? {};
    this.currentAutonomyLevel = options.currentAutonomyLevel ?? "supervised";
    this.domainDescriptorValidator = options.domainDescriptorValidator ?? (() => null);
  }

  public async registerTrigger(trigger: ProactiveTrigger | TriggerDefinition): Promise<void> {
    const definition = toDefinition(trigger);
    const declared = this.declaredTriggerIdsByDomain[definition.domainId];
    if (declared != null && !declared.includes(definition.triggerId)) {
      throw new Error(`proactive_agent.trigger_not_declared:${definition.domainId}:${definition.triggerId}`);
    }
    // §41.1: Validate trigger attributes against DomainDescriptor capabilities
    const validationErrors = this.domainDescriptorValidator(definition.domainId, definition);
    if (validationErrors != null && validationErrors.length > 0) {
      throw new Error(
        `proactive_agent.domain_descriptor_validation_failed:${definition.domainId}:${definition.triggerId}:${validationErrors.join(",")}`,
      );
    }
    this.states.set(definition.triggerId, {
      trigger: definition,
      lastFiredAt: null,
      fireTimestamps: [],
      consecutiveFailures: 0,
      fireCount: 0,
      pendingBatch: null,
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
      // §41.1: Use the configured userInitiatedReserveRatio; proactive budget is whatever remains
      // after user-initiated reserve is deducted from totalDailyBudget.
      const reserveRatio = Math.max(0, Math.min(1, budgetPool.userInitiatedReserveRatio));
      const proactiveBudgetCap = Math.floor(budgetPool.totalDailyBudget * (1 - reserveRatio));
      if ((this.dailyTriggerUsage.get(usageKey) ?? 0) >= proactiveBudgetCap) {
        reasons.push("proactive_agent.user_initiated_reserve_protected");
      }
    }

    const cooldownMs = parseDurationMs(state.trigger.cooldown);
    if (state.lastFiredAt != null && cooldownMs > 0 && now - new Date(state.lastFiredAt).getTime() < cooldownMs) {
      reasons.push("proactive_agent.cooldown_active");
    }

    const { max, windowMs } = parseRateWindow(state.trigger.maxFireRate);
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

    if (reasons.length > 0) {
      return {
        allowed: false,
        reasonCodes: reasons,
        actionMode: "silent_record",
        queuedSuggestionId: null,
      };
    }

    const effectiveInput = this.resolveBatchWindowInput(state, input, now);
    if (effectiveInput == null) {
      return {
        allowed: false,
        reasonCodes: ["proactive_agent.batch_window_collecting"],
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

    // R16-21 FIX: Use resolveTriggerActionMode for all trigger action types to ensure
    // consistent action-mode determination across all risk levels (no duplication).
    let actionMode = resolveTriggerActionMode(
      state.trigger.action.requireConfirmation,
      state.trigger.riskLevel,
    );

    // R17-23 FIX: Enforce suggestion mode for medium+ risk when confirmation is disabled.
    // If requireConfirmation=false but risk is medium+, we must NOT auto-execute.
    // resolveTriggerActionMode only runs when requireConfirmation is true, so we need
    // an explicit check here to catch the requireConfirmation=false case.
    if (!state.trigger.action.requireConfirmation && (state.trigger.riskLevel === "medium" || state.trigger.riskLevel === "high" || state.trigger.riskLevel === "critical")) {
      actionMode = "suggest";
    }

    // §42.5: Autonomy level must be semi_auto+ for auto_execute
    // If autonomy is suggestion/supervised/frozen, downgrade auto_execute to suggest
    const autoExecutePermitted = this.currentAutonomyLevel === "semi_auto"
      || this.currentAutonomyLevel === "full_auto";
    if (!autoExecutePermitted && actionMode === "auto_execute") {
      actionMode = "suggest";
    }

    const queuedSuggestionId = actionMode === "suggest" ? this.enqueueSuggestion(state.trigger, effectiveInput) : null;

    return {
      allowed: true,
      reasonCodes: [
        "proactive_agent.fire_allowed",
        ...(effectiveInput !== input ? ["proactive_agent.batch_window_aggregated"] : []),
      ],
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

  /**
   * §47: ProactiveSuggestion pipeline with full stage decomposition.
   *
   * Pipeline stages:
   * 1. Context Builder - builds suggestion context from trigger and input
   * 2. Generator - generates the suggestion with metadata
   * 3. Queue - enqueues suggestion for later processing
   * 4. Quality Scoring - computes quality score for ranking/prioritization
   */
  private buildSuggestionPipeline(
    trigger: TriggerDefinition,
    input: TriggerEvaluationInput,
  ): { context: ProactiveSuggestionContext; suggestion: ProactiveSuggestion } {
    // Stage 1: Context Builder
    const context = this.buildSuggestionContext(trigger, input);

    // Stage 2: Generator - creates the suggestion object
    const suggestionId = newId("suggestion");
    const title = this.generateSuggestionTitle(trigger, context);

    // Stage 3: Queue (enqueue) - suggestion is stored in suggestions map
    // Stage 4: Quality Scoring - compute quality score before creating suggestion
    const qualityScore = this.scoreSuggestionQuality(trigger, context);

    const suggestion: ProactiveSuggestion = {
      suggestionId,
      triggerId: trigger.triggerId,
      domainId: trigger.domainId,
      createdAt: nowIso(),
      title,
      action: trigger.action,
      context,
      qualityScore,
    };

    // Enqueue to the queue
    this.suggestions.set(suggestionId, suggestion);

    return { context, suggestion };
  }

  /**
   * Stage 1: Context Builder - builds suggestion context from trigger and input
   */
  private buildSuggestionContext(
    trigger: TriggerDefinition,
    input: TriggerEvaluationInput,
  ): ProactiveSuggestionContext {
    const normalizedType = normalizeTriggerType(trigger.type);
    if ((normalizedType === "event" || normalizedType === "webhook") && input.event != null) {
      return {
        triggerType: normalizedType,
        riskLevel: trigger.riskLevel,
        sourceSummary: `${input.event.source}:${input.event.name}`,
        matchedSignal: input.event.payload == null ? null : JSON.stringify(input.event.payload),
        targetDomainId: trigger.domainId,
        requireConfirmation: trigger.action.requireConfirmation,
      };
    }

    if (normalizedType === "condition" && input.metric != null) {
      const previousValue = input.metric.previousValue == null ? "" : ` (prev ${input.metric.previousValue})`;
      return {
        triggerType: normalizedType,
        riskLevel: trigger.riskLevel,
        sourceSummary: `${input.metric.source}:${input.metric.name}`,
        matchedSignal: `${input.metric.value}${previousValue}`,
        targetDomainId: trigger.domainId,
        requireConfirmation: trigger.action.requireConfirmation,
      };
    }

    return {
      triggerType: normalizedType,
      riskLevel: trigger.riskLevel,
      sourceSummary: trigger.name,
      matchedSignal: null,
      targetDomainId: trigger.domainId,
      requireConfirmation: trigger.action.requireConfirmation,
    };
  }

  /**
   * Stage 2: Generator - generates suggestion title
   */
  private generateSuggestionTitle(trigger: TriggerDefinition, context: ProactiveSuggestionContext): string {
    const riskLabel = context.riskLevel === "critical" ? "critical" : context.riskLevel;
    if (context.matchedSignal != null && context.matchedSignal.length > 0) {
      return `[${riskLabel}] ${trigger.name}: ${context.sourceSummary}`;
    }
    return `[${riskLabel}] ${trigger.name}`;
  }

  /**
   * Stage 4: Quality Scoring - computes quality score for suggestion ranking
   */
  private scoreSuggestionQuality(trigger: TriggerDefinition, context: ProactiveSuggestionContext): number {
    let score = 0.4;
    if (context.matchedSignal != null && context.matchedSignal.length > 0) {
      score += 0.2;
    }
    if (Object.keys(trigger.action.template).length > 0) {
      score += 0.15;
    }
    if (trigger.boundAgentId != null) {
      score += 0.1;
    }
    if (trigger.feedbackTargetTriggerIds != null && trigger.feedbackTargetTriggerIds.length > 0) {
      score += 0.05;
    }
    if (trigger.riskLevel === "low") {
      score += 0.05;
    }
    return Number(Math.min(1, score).toFixed(4));
  }

  /**
   * Stage 3: Queue - enqueues suggestion for later processing
   */
  private enqueueSuggestionToQueue(suggestion: ProactiveSuggestion): string {
    this.suggestions.set(suggestion.suggestionId, suggestion);
    return suggestion.suggestionId;
  }

  private matchesTrigger(trigger: TriggerDefinition, input: TriggerEvaluationInput): boolean {
    if (normalizeTriggerType(trigger.type) !== normalizeTriggerType(input.kind)) {
      return false;
    }

    if (normalizeTriggerType(trigger.type) === "event" || normalizeTriggerType(trigger.type) === "webhook") {
      const config = trigger.config as EventTriggerConfig;
      return input.event?.source === config.eventSource
        && input.event?.name?.includes(config.eventPattern)
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
      return Math.abs(metric.value - metric.previousValue) > config.threshold;
    }

    return true;
  }

  private enqueueSuggestion(trigger: TriggerDefinition, input: TriggerEvaluationInput): string {
    // §47: Use the full pipeline with Context Builder, Generator, Queue, and Quality Scoring
    const { suggestion } = this.buildSuggestionPipeline(trigger, input);
    return suggestion.suggestionId;
  }

  private resolveBatchWindowInput(
    state: TriggerRuntimeState,
    input: TriggerEvaluationInput,
    now: number,
  ): TriggerEvaluationInput | null {
    const normalizedType = normalizeTriggerType(state.trigger.type);
    if ((normalizedType !== "event" && normalizedType !== "webhook") || input.event == null) {
      return input;
    }

    const batchWindow = (state.trigger.config as EventTriggerConfig).batchWindow;
    const batchWindowMs = batchWindow == null ? 0 : parseDurationMs(batchWindow);
    if (batchWindowMs <= 0) {
      return input;
    }

    const timestamp = new Date(now).toISOString();
    const eventSample = {
      source: input.event.source,
      name: input.event.name,
      ...(input.event.payload == null ? {} : { payload: input.event.payload }),
    };

    if (state.pendingBatch == null) {
      state.pendingBatch = {
        openedAt: timestamp,
        lastEventAt: timestamp,
        events: [eventSample],
      };
      return null;
    }

    state.pendingBatch.events.push(eventSample);
    state.pendingBatch.lastEventAt = timestamp;
    const openedAt = new Date(state.pendingBatch.openedAt).getTime();
    if (now - openedAt < batchWindowMs) {
      return null;
    }

    const batch = state.pendingBatch;
    state.pendingBatch = null;
    const [firstEvent] = batch.events;
    if (firstEvent == null) {
      return input;
    }

    return {
      ...input,
      event: {
        source: firstEvent.source,
        name: firstEvent.name,
        payload: {
          batchCount: batch.events.length,
          batchWindow,
          events: batch.events.slice(0, 5),
        },
      },
    };
  }

  private detectFeedbackLoop(triggerId: string): void {
    const visited = new Set<string>();
    const stack = new Set<string>();
    // R16-20 FIX: Track only the cycle members, not the entire ancestry path
    const cycleMembers = new Set<string>();
    const hasCycle = (currentId: string): boolean => {
      if (stack.has(currentId)) {
        // Found a cycle — currentId is the cycle entry point; stack contains the rest
        cycleMembers.add(currentId);
        return true;
      }
      if (visited.has(currentId)) {
        return false;
      }
      visited.add(currentId);
      stack.add(currentId);
      try {
        const targets = this.states.get(currentId)?.trigger.feedbackTargetTriggerIds ?? [];
        for (const nextId of targets) {
          if (hasCycle(nextId)) {
            // If this node is in the cycle (not just an ancestor), mark it
            if (stack.has(nextId)) {
              cycleMembers.add(currentId);
            }
            return true;
          }
        }
        return false;
      } finally {
        // Root cause §175-2046: stack.delete was outside try/catch, so if the recursive
        // call threw or returned true, stack.delete still ran after the try block.
        // But worse: when hasCycle returned true (cycle detected), we returned true immediately
        // without cleaning up the stack frame. The finally ensures cleanup happens regardless
        // of which return path was taken.
        stack.delete(currentId);
      }
    };
    if (!hasCycle(triggerId)) {
      return;
    }
    // Only disable the triggers that are actually part of the cycle, not the whole ancestry path
    this.incidents.push({
      incidentId: newId("proactive_incident"),
      triggerIds: [...cycleMembers],
      reasonCode: "proactive_agent.feedback_loop_detected",
      createdAt: nowIso(),
    });
    for (const loopTriggerId of cycleMembers) {
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
