/**
 * Cost Alert Service
 *
 * Provides real-time cost alerting when usage thresholds are exceeded.
 * Supports platform-level, tenant-level, pack-level, and step-level budget enforcement.
 *
 * Emits `cost.threshold.exceeded` events when thresholds are crossed, enabling
 * automated responses like workflow degradation, pausing, or alerting.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §18
 */
import { EventEmitter } from "node:events";
import type { AuthoritativeSqlDatabase } from "../../state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../state-evidence/truth/authoritative-task-store.js";
import type { CostAccumulator, CostEvaluationResult, CostAlertConfig, BudgetScope } from "./cost-alert-types.js";
/**
 * Service for evaluating cost against budget policies and emitting alerts.
 *
 * Tracks accumulated costs per scope and evaluates against configured limits.
 * Emits `cost.threshold.exceeded` events when thresholds are crossed.
 *
 * Usage:
 * 1. Create service with database access
 * 2. Call evaluateCost() before each billable action
 * 3. Call recordCost() after each LLM call to update accumulators
 * 4. Listen for `cost.threshold.exceeded` events to trigger automated responses
 */
export declare class CostAlertService extends EventEmitter {
    private readonly db;
    private readonly store;
    private readonly accumulators;
    private config;
    private readonly MAX_ACCUMULATORS;
    private readonly ACCUMULATOR_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(db: AuthoritativeSqlDatabase, store: AuthoritativeTaskStore, config?: Partial<CostAlertConfig>);
    /**
     * C-11: Evict expired cost accumulators to prevent memory leaks.
     */
    private evictExpiredAccumulators;
    /**
     * Evaluates whether a cost action should be allowed based on current spend.
     *
     * Checks the projected cost against the budget policy limits and returns
     * an evaluation result with the decision and remaining budget.
     */
    evaluateCost(input: {
        scope: BudgetScope;
        scopeId: string;
        projectedCostUsd: number;
        tenantId?: string | null;
        taskId?: string | null;
        executionId?: string | null;
        stepId?: string | null;
    }): CostEvaluationResult;
    /**
     * Records actual cost after a billable action completes.
     *
     * Updates the cost accumulator and emits threshold exceeded events
     * if the configured thresholds are crossed.
     */
    recordCost(input: {
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
    }): void;
    /**
     * Gets the current cost accumulator for a scope.
     */
    getAccumulator(scope: BudgetScope, scopeId: string): CostAccumulator | null;
    /**
     * Resets the cost accumulator for a scope (e.g., at period boundary).
     */
    resetAccumulator(scope: BudgetScope, scopeId: string): void;
    /**
     * Updates the cost alert configuration.
     */
    updateConfig(config: Partial<CostAlertConfig>): void;
    /**
     * Resolves the applicable budget policy for a scope.
     */
    private resolvePolicy;
    /**
     * Gets or creates a cost accumulator for a policy.
     */
    private getOrCreateAccumulator;
    /**
     * Calculates the end of a budget period.
     */
    private calculatePeriodEnd;
    /**
     * Gets the accumulator key for a scope.
     */
    private getAccumulatorKey;
    /**
     * Gets the reason code for exceeded budget.
     */
    private getExceededReasonCode;
    /**
     * Emits a cost.threshold.exceeded event.
     */
    private emitThresholdExceeded;
    /**
     * Gets the event tier based on alert level.
     */
    private getEventTier;
    /**
     * Persists a cost event to the event store.
     */
    private persistCostEvent;
    /**
     * Records step-level usage for fine-grained cost tracking.
     */
    private recordStepUsage;
}
