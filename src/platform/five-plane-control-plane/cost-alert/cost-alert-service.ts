/**
 * Cost Alert Service
 *
 * Provides real-time cost alerting when usage thresholds are exceeded.
 * Supports platform-level, tenant-level, pack-level, and step-level budget enforcement.
 *
 * Emits `cost:limit_reached` events when thresholds are crossed, enabling
 * automated responses like workflow degradation, pausing, or alerting.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §18
 */

import { createHash } from "node:crypto";
import type { AuthoritativeSqlDatabase } from "../../five-plane-state-evidence/truth/authoritative-sql-database.js";
import { newId, nowIso } from "../../contracts/types/ids.js";
import type { AuthoritativeTaskStore } from "../../five-plane-state-evidence/truth/authoritative-task-store.js";
import { StorageError } from "../../contracts/errors.js";
import { LocalTypedEventEmitter } from "../../shared/events/local-typed-event-emitter.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type {
  BudgetPolicy,
  CostAccumulator,
  CostEvaluationResult,
  CostThresholdExceededEvent,
  CostAlertConfig,
  StepUsageRecord,
  BudgetScope,
  CostAlertLevel,
  CostAlertReasonCode,
  CostAlertAction,
} from "./cost-alert-types.js";

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_WARNING_THRESHOLD = 0.8; // 80% of limit triggers warning
const DEFAULT_CRITICAL_THRESHOLD = 0.95; // 95% of limit triggers critical alert
const logger = new StructuredLogger({ retentionLimit: 100 });

// ---------------------------------------------------------------------------
// Cost Alert Service
// ---------------------------------------------------------------------------

/**
 * Service for evaluating cost against budget policies and emitting alerts.
 *
 * Tracks accumulated costs per scope and evaluates against configured limits.
 * Emits `cost:limit_reached` events when thresholds are crossed.
 *
 * Usage:
 * 1. Create service with database access
 * 2. Call evaluateCost() before each billable action
 * 3. Call recordCost() after each LLM call to update accumulators
 * 4. Listen for `cost:limit_reached` events to trigger automated responses
 */
export class CostAlertService extends LocalTypedEventEmitter<Record<string, unknown>> {
  private readonly accumulators: Map<string, CostAccumulator> = new Map();
  private readonly lastAlertByKey: Map<string, string> = new Map();
  private config: CostAlertConfig;
  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_ACCUMULATORS = 500;
  private readonly ACCUMULATOR_TTL_MS = 60 * 60 * 1000; // 1 hour
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  public constructor(
    private readonly db: AuthoritativeSqlDatabase,
    private readonly store: AuthoritativeTaskStore,
    config?: Partial<CostAlertConfig>,
  ) {
    super();
    this.config = {
      enabled: config?.enabled ?? true,
      platformBudgetPolicy: config?.platformBudgetPolicy ?? null,
      tenantBudgetPolicies: config?.tenantBudgetPolicies ?? {},
      packBudgetPolicies: config?.packBudgetPolicies ?? {},
      stepBudgetPolicies: config?.stepBudgetPolicies ?? {},
      defaultWarningThreshold: config?.defaultWarningThreshold ?? DEFAULT_WARNING_THRESHOLD,
      minAlertIntervalMs: config?.minAlertIntervalMs ?? 300_000,
    };
  }

  /**
   * C-11: Evict expired cost accumulators to prevent memory leaks.
   */
  private evictExpiredAccumulators(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.ACCUMULATOR_TTL_MS;
    const entriesToDelete: string[] = [];

    for (const [key, accumulator] of this.accumulators) {
      if (accumulator.lastUpdatedAt) {
        const lastUpdated = new Date(accumulator.lastUpdatedAt).getTime();
        if (lastUpdated < expiryThreshold) {
          entriesToDelete.push(key);
        }
      }
    }

    for (const key of entriesToDelete) {
      this.accumulators.delete(key);
    }

    // If still over capacity, remove oldest accumulators
    if (this.accumulators.size > this.MAX_ACCUMULATORS) {
      const sortedEntries = [...this.accumulators.entries()].sort((a, b) => {
        const aTime = a[1].lastUpdatedAt ? new Date(a[1].lastUpdatedAt).getTime() : 0;
        const bTime = b[1].lastUpdatedAt ? new Date(b[1].lastUpdatedAt).getTime() : 0;
        return aTime - bTime;
      });

      const toRemove = this.accumulators.size - this.MAX_ACCUMULATORS;
      for (let i = 0; i < toRemove; i++) {
        this.accumulators.delete(sortedEntries[i]![0]);
      }
    }
  }

  /**
   * Evaluates whether a cost action should be allowed based on current spend.
   *
   * Checks the projected cost against the budget policy limits and returns
   * an evaluation result with the decision and remaining budget.
   */
  public evaluateCost(input: {
    scope: BudgetScope;
    scopeId: string;
    projectedCostUsd: number;
    projectedTokens?: number;
    tenantId?: string | null;
    taskId?: string | null;
    executionId?: string | null;
    stepId?: string | null;
  }): CostEvaluationResult {
    const policy = this.resolvePolicy(input.scope, input.scopeId, input.tenantId);

    if (!policy || !this.config.enabled) {
      return {
        allowed: true,
        currentCostUsd: 0,
        projectedCostUsd: input.projectedCostUsd,
        remainingBudgetUsd: null,
        thresholdRatio: 0,
        alertLevel: "ok",
        reasonCode: "cost.ok",
      };
    }

    const accumulator = this.getOrCreateAccumulator(policy);
    const currentCost = accumulator.accumulatedCostUsd + accumulator.pendingProjectedCostUsd;
    const currentTokens = accumulator.accumulatedTokens + accumulator.pendingProjectedTokens;
    const projectedCost = currentCost + input.projectedCostUsd;
    const projectedTokens = currentTokens + (input.projectedTokens ?? 0);

    const costLimit = policy.limitCostUsd ?? null;
    const tokenLimit = policy.limitTokens ?? null;
    const usesCostMetric = costLimit != null;
    const remainingBudget = costLimit == null ? null : Math.max(0, costLimit - projectedCost);
    const thresholdRatio = usesCostMetric
      ? (costLimit! > 0 ? projectedCost / costLimit! : 0)
      : tokenLimit != null && tokenLimit > 0
        ? projectedTokens / tokenLimit
        : 0;

    let alertLevel: CostAlertLevel = "ok";
    let reasonCode: CostAlertReasonCode = "cost.ok";

    if (usesCostMetric && costLimit === 0 && projectedCost > 0) {
      alertLevel = "exceeded";
      reasonCode = this.getExceededReasonCode(input.scope, policy);
    } else if (thresholdRatio >= 1.0) {
      alertLevel = "exceeded";
      reasonCode = this.getExceededReasonCode(input.scope, policy);
    } else if (thresholdRatio >= DEFAULT_CRITICAL_THRESHOLD) {
      alertLevel = "critical";
      reasonCode = "cost.critical";
    } else if (thresholdRatio >= (policy.warningThreshold ?? this.config.defaultWarningThreshold)) {
      alertLevel = "warning";
      reasonCode = "cost.approaching_limit";
    }

    const allowed = alertLevel === "ok" || alertLevel === "warning";
    if (allowed) {
      accumulator.pendingProjectedCostUsd += input.projectedCostUsd;
      accumulator.pendingProjectedTokens += input.projectedTokens ?? 0;
      accumulator.lastUpdatedAt = nowIso();
    }

    return {
      allowed,
      currentCostUsd: currentCost,
      projectedCostUsd: projectedCost,
      remainingBudgetUsd: remainingBudget,
      thresholdRatio,
      alertLevel,
      reasonCode,
    };
  }

  /**
   * Records actual cost after a billable action completes.
   *
   * Updates the cost accumulator and emits threshold exceeded events
   * if the configured thresholds are crossed.
   */
  public recordCost(input: {
    scope: BudgetScope;
    scopeId: string;
    actualCostUsd: number;
    tokens?: number;
    tenantId?: string | null;
    taskId?: string | null;
    executionId?: string | null;
    stepId?: string | null;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    cached?: boolean;
  }): void {
    const policy = this.resolvePolicy(input.scope, input.scopeId, input.tenantId);

    if (!policy || !this.config.enabled) {
      return;
    }

    const accumulator = this.getOrCreateAccumulator(policy);
    const previousCost = accumulator.accumulatedCostUsd;
    const previousTokens = accumulator.accumulatedTokens;

    accumulator.pendingProjectedCostUsd = Math.max(0, accumulator.pendingProjectedCostUsd - input.actualCostUsd);
    accumulator.pendingProjectedTokens = Math.max(0, accumulator.pendingProjectedTokens - (input.tokens ?? 0));
    accumulator.accumulatedCostUsd += input.actualCostUsd;
    accumulator.accumulatedTokens += input.tokens ?? 0;
    accumulator.lastUpdatedAt = nowIso();

    // Persist step usage record if stepId is provided
    if (input.stepId) {
      this.recordStepUsage({
        tenantId: input.tenantId ?? "unknown",
        stepId: input.stepId,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        costUsd: input.actualCostUsd,
        tokens: input.tokens ?? 0,
        provider: input.provider ?? "unknown",
        model: input.model ?? "unknown",
        promptTokens: input.promptTokens ?? 0,
        completionTokens: input.completionTokens ?? 0,
        cached: input.cached ?? false,
      });
    }

    // Check if threshold was crossed
    const usesCostMetric = policy.limitCostUsd != null;
    const thresholdRatio = usesCostMetric
      ? accumulator.accumulatedCostUsd / policy.limitCostUsd!
      : policy.limitTokens != null && policy.limitTokens > 0
        ? accumulator.accumulatedTokens / policy.limitTokens
        : 0;

    const warningThresholdBoundary = usesCostMetric
      ? policy.limitCostUsd! * (policy.warningThreshold ?? this.config.defaultWarningThreshold)
      : (policy.limitTokens ?? Infinity) * (policy.warningThreshold ?? this.config.defaultWarningThreshold);
    const criticalThresholdBoundary = usesCostMetric
      ? policy.limitCostUsd! * DEFAULT_CRITICAL_THRESHOLD
      : (policy.limitTokens ?? Infinity) * DEFAULT_CRITICAL_THRESHOLD;
    const breachBoundary = usesCostMetric ? policy.limitCostUsd! : (policy.limitTokens ?? Infinity);

    const previousMetricValue = usesCostMetric ? previousCost : previousTokens;
    const currentMetricValue = usesCostMetric ? accumulator.accumulatedCostUsd : accumulator.accumulatedTokens;

    const wasWarning = previousMetricValue >= warningThresholdBoundary;
    const isWarning = thresholdRatio >= (policy.warningThreshold ?? this.config.defaultWarningThreshold);

    const wasCritical = previousMetricValue >= criticalThresholdBoundary;
    const isCritical = thresholdRatio >= DEFAULT_CRITICAL_THRESHOLD;

    const wasExceeded = previousMetricValue >= breachBoundary;
    const isExceeded = thresholdRatio >= 1.0;

    // Emit events if thresholds were crossed (order matters: exceeded > critical > warning)
    if (!wasExceeded && isExceeded) {
      this.emitThresholdExceeded({
        scope: input.scope,
        scopeId: input.scopeId,
        alertLevel: "exceeded",
        reasonCode: this.getExceededReasonCode(input.scope, policy),
        currentCostUsd: accumulator.accumulatedCostUsd,
        limitCostUsd: policy.limitCostUsd ?? null,
        accumulatedTokens: accumulator.accumulatedTokens,
        limitTokens: policy.limitTokens ?? null,
        thresholdMetric: usesCostMetric ? "cost_usd" : "tokens",
        periodStart: accumulator.periodStart,
        periodEnd: accumulator.periodEnd,
        tenantId: input.tenantId ?? null,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        stepId: input.stepId ?? null,
        actions: policy.actionsOnBreach,
      });
    } else if (!wasCritical && isCritical) {
      this.emitThresholdExceeded({
        scope: input.scope,
        scopeId: input.scopeId,
        alertLevel: "critical",
        reasonCode: "cost.critical",
        currentCostUsd: accumulator.accumulatedCostUsd,
        limitCostUsd: policy.limitCostUsd ?? null,
        accumulatedTokens: accumulator.accumulatedTokens,
        limitTokens: policy.limitTokens ?? null,
        thresholdMetric: usesCostMetric ? "cost_usd" : "tokens",
        periodStart: accumulator.periodStart,
        periodEnd: accumulator.periodEnd,
        tenantId: input.tenantId ?? null,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        stepId: input.stepId ?? null,
        actions: policy.actionsOnWarning,
      });
    }

    // Warning is checked separately from exceeded/critical to ensure it fires
    // even when cost crosses warning threshold before exceeding
    if (!wasWarning && isWarning && !isExceeded && !isCritical) {
      this.emitThresholdExceeded({
        scope: input.scope,
        scopeId: input.scopeId,
        alertLevel: "warning",
        reasonCode: "cost.approaching_limit",
        currentCostUsd: accumulator.accumulatedCostUsd,
        limitCostUsd: policy.limitCostUsd ?? null,
        accumulatedTokens: accumulator.accumulatedTokens,
        limitTokens: policy.limitTokens ?? null,
        thresholdMetric: usesCostMetric ? "cost_usd" : "tokens",
        periodStart: accumulator.periodStart,
        periodEnd: accumulator.periodEnd,
        tenantId: input.tenantId ?? null,
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        stepId: input.stepId ?? null,
        actions: policy.actionsOnWarning,
      });
    }
  }

  /**
   * Gets the current cost accumulator for a scope.
   */
  public getAccumulator(scope: BudgetScope, scopeId: string): CostAccumulator | null {
    return this.accumulators.get(this.getAccumulatorKey(scope, scopeId)) ?? null;
  }

  /**
   * Resets the cost accumulator for a scope (e.g., at period boundary).
   */
  public resetAccumulator(scope: BudgetScope, scopeId: string): void {
    const key = this.getAccumulatorKey(scope, scopeId);
    const existing = this.accumulators.get(key);
    if (existing) {
      const newAccumulator: CostAccumulator = {
        scope: existing.scope,
        scopeId: existing.scopeId,
        accumulatedCostUsd: 0,
        accumulatedTokens: 0,
        pendingProjectedCostUsd: 0,
        pendingProjectedTokens: 0,
        periodStart: nowIso(),
        periodEnd: existing.periodEnd, // Keep same period end
        lastUpdatedAt: nowIso(),
      };
      this.accumulators.set(key, newAccumulator);
    }
  }

  /**
   * Updates the cost alert configuration.
   */
  public updateConfig(config: Partial<CostAlertConfig>): void {
    this.config = {
      ...this.config,
      ...config,
    };
  }

  /**
   * Resolves the applicable budget policy for a scope.
   */
  private resolvePolicy(scope: BudgetScope, scopeId: string, tenantId?: string | null): BudgetPolicy | null {
    switch (scope) {
      case "platform":
        return this.config.platformBudgetPolicy;
      case "tenant":
        return this.config.tenantBudgetPolicies[scopeId] ?? null;
      case "pack":
        return this.config.packBudgetPolicies[scopeId] ?? null;
      case "step":
        if (this.config.stepBudgetPolicies[scopeId]) {
          return this.config.stepBudgetPolicies[scopeId] ?? null;
        }
        if (tenantId) {
          return this.config.tenantBudgetPolicies[tenantId] ?? null;
        }
        return null;
      default:
        return null;
    }
  }

  /**
   * Gets or creates a cost accumulator for a policy.
   */
  private getOrCreateAccumulator(policy: BudgetPolicy): CostAccumulator {
    // C-11: Evict expired accumulators before creating new one
    this.evictExpiredAccumulators();

    const key = this.getAccumulatorKey(policy.scope, policy.scopeId);
    let accumulator = this.accumulators.get(key);

    if (!accumulator) {
      const now = nowIso();
      accumulator = {
        scope: policy.scope,
        scopeId: policy.scopeId,
        accumulatedCostUsd: 0,
        accumulatedTokens: 0,
        pendingProjectedCostUsd: 0,
        pendingProjectedTokens: 0,
        periodStart: now,
        periodEnd: this.calculatePeriodEnd(now, policy.period),
        lastUpdatedAt: now,
      };
      this.accumulators.set(key, accumulator);
    }

    // Check if we need to reset for a new period
    const now = nowIso();
    if (now > accumulator.periodEnd) {
      accumulator.accumulatedCostUsd = 0;
      accumulator.accumulatedTokens = 0;
      accumulator.pendingProjectedCostUsd = 0;
      accumulator.pendingProjectedTokens = 0;
      accumulator.periodStart = accumulator.periodEnd;
      accumulator.periodEnd = this.calculatePeriodEnd(now, policy.period);
    }

    return accumulator;
  }

  /**
   * Calculates the end of a budget period.
   */
  private calculatePeriodEnd(start: string, period: BudgetPolicy["period"]): string {
    const startDate = new Date(start);
    const year = startDate.getUTCFullYear();
    const month = startDate.getUTCMonth();
    const day = startDate.getUTCDate();
    switch (period) {
      case "monthly":
        return new Date(Date.UTC(year, month + 1, day, 0, 0, 0, 0)).toISOString();
      case "weekly":
        return new Date(Date.UTC(year, month, day + 7, 0, 0, 0, 0)).toISOString();
      case "per_run":
        // per_run resets at the end of the current day
        return new Date(Date.UTC(year, month, day + 1, 0, 0, 0, 0)).toISOString();
    }
  }

  /**
   * Gets the accumulator key for a scope.
   */
  private getAccumulatorKey(scope: BudgetScope, scopeId: string): string {
    return `${scope}:${scopeId}`;
  }

  /**
   * Gets the reason code for exceeded budget.
   */
  private getExceededReasonCode(scope: BudgetScope, policy: BudgetPolicy): CostAlertReasonCode {
    switch (scope) {
      case "step":
        return "cost.step_limit_exceeded";
      case "platform":
        return "cost.monthly_limit_exceeded";
      default:
        return "cost.exceeded";
    }
  }

  /**
   * Emits a cost:limit_reached event.
   */
  private emitThresholdExceeded(input: {
    scope: BudgetScope;
    scopeId: string;
    alertLevel: CostAlertLevel;
    reasonCode: CostAlertReasonCode;
    currentCostUsd: number;
    limitCostUsd: number | null;
    accumulatedTokens: number;
    limitTokens: number | null;
    thresholdMetric: "cost_usd" | "tokens";
    periodStart: string;
    periodEnd: string;
    tenantId: string | null;
    taskId: string | null;
    executionId: string | null;
    stepId: string | null;
    actions: CostAlertAction[];
  }): void {
    if (!this.shouldEmitAlert(input.scope, input.scopeId, input.alertLevel, input.periodStart)) {
      return;
    }
    const event: CostThresholdExceededEvent = {
      eventType: "cost:limit_reached",
      eventTier: this.getEventTier(input.alertLevel),
      scope: input.scope,
      scopeId: input.scopeId,
      alertLevel: input.alertLevel,
      reasonCode: input.reasonCode,
      currentCostUsd: input.currentCostUsd,
      limitCostUsd: input.limitCostUsd,
      accumulatedTokens: input.accumulatedTokens,
      limitTokens: input.limitTokens,
      thresholdMetric: input.thresholdMetric,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
      triggeredAt: nowIso(),
      tenantId: input.tenantId,
      taskId: input.taskId,
      executionId: input.executionId,
      stepId: input.stepId,
    };

    // Emit on the service for listeners
    this.emit("cost:limit_reached", event);

    // Also persist the event to the event store
    this.persistCostEvent(event);
  }

  /**
   * Gets the event tier based on alert level.
   */
  private getEventTier(alertLevel: CostAlertLevel): "tier_1" | "tier_2" | "tier_3" {
    switch (alertLevel) {
      case "exceeded":
        return "tier_1";
      case "critical":
        return "tier_2";
      case "warning":
        return "tier_3";
      default:
        return "tier_3";
    }
  }

  /**
   * Persists a cost event to the event store.
   */
  private persistCostEvent(event: CostThresholdExceededEvent): void {
    try {
      this.store.event.insertEvent({
        id: newId("evt"),
        taskId: event.taskId ?? null,
        executionId: event.executionId ?? null,
        eventType: event.eventType,
        eventTier: event.eventTier,
        payloadJson: JSON.stringify(event),
        traceId: null,
        createdAt: event.triggeredAt,
      });
    } catch (error) {
      logger.warn("cost_alert.event_persistence_failed", {
        taskId: event.taskId ?? null,
        executionId: event.executionId ?? null,
        scope: event.scope,
        scopeId: event.scopeId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Records step-level usage for fine-grained cost tracking.
   */
  private recordStepUsage(input: {
    tenantId?: string | null;
    stepId: string;
    taskId?: string | null;
    executionId?: string | null;
    costUsd: number;
    tokens?: number;
    provider?: string;
    model?: string;
    promptTokens?: number;
    completionTokens?: number;
    cached?: boolean;
  }): void {
    // Step usage records are stored as artifacts for now
    // This enables step-level cost attribution and analysis
    try {
      const record: StepUsageRecord = {
        recordId: newId("stepusage"),
        timestamp: nowIso(),
        tenantId: input.tenantId ?? "unknown",
        workflowRunId: input.executionId ?? null,
        stepId: input.stepId,
        provider: input.provider ?? "unknown",
        model: input.model ?? "unknown",
        promptTokens: input.promptTokens ?? 0,
        completionTokens: input.completionTokens ?? 0,
        totalTokens: input.tokens ?? 0,
        costUsd: input.costUsd,
        currency: "USD",
        cached: input.cached ?? false,
      };
      const serialized = JSON.stringify(record);
      const artifactId = newId("artifact");
      const checksum = createHash("sha256").update(serialized).digest("hex");
      if (input.taskId == null) {
        return;
      }

      // Store in artifact for retrieval
      // The artifact store can be queried to build cost reports
      this.store.artifact.insertArtifact({
        artifactId,
        taskId: input.taskId,
        executionId: input.executionId ?? null,
        stepId: input.stepId,
        kind: "step_usage_record",
        storagePath: `step-usage/${input.stepId}/${record.recordId}.json`,
        fileName: `step-usage-${input.stepId}-${record.timestamp}.json`,
        mimeType: "application/json",
        sizeBytes: Buffer.byteLength(serialized, "utf8"),
        checksum,
        lineageJson: null,
        createdAt: record.timestamp,
      });
    } catch (error) {
      logger.warn("cost_alert.step_usage_record_failed", {
        taskId: input.taskId ?? null,
        executionId: input.executionId ?? null,
        stepId: input.stepId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private shouldEmitAlert(
    scope: BudgetScope,
    scopeId: string,
    alertLevel: CostAlertLevel,
    periodStart: string,
  ): boolean {
    const alertKey = `${scope}:${scopeId}:${alertLevel}`;
    const lastTriggeredAt = this.lastAlertByKey.get(alertKey);
    const now = Date.now();
    if (lastTriggeredAt != null) {
      const lastMs = new Date(lastTriggeredAt).getTime();
      const periodMs = new Date(periodStart).getTime();
      if (lastMs >= periodMs && now - lastMs < this.config.minAlertIntervalMs) {
        return false;
      }
    }
    this.lastAlertByKey.set(alertKey, new Date(now).toISOString());
    return true;
  }
}
