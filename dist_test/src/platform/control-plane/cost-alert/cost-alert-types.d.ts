/**
 * Cost Alert Types
 *
 * Defines types for real-time cost alerting when usage thresholds are exceeded.
 * Supports platform-level, tenant-level, pack-level, and step-level budget enforcement.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §18
 */
import type { Timestamp } from "../../contracts/types/domain.js";
/**
 * Budget scope defines the granularity and主体 of budget control.
 */
export type BudgetScope = "platform" | "tenant" | "pack" | "step";
/**
 * Budget period defines the time window for budget reset.
 */
export type BudgetPeriod = "monthly" | "weekly" | "per_run";
/**
 * Budget policy defining cost limits and warning thresholds.
 */
export interface BudgetPolicy {
    scope: BudgetScope;
    scopeId: string;
    period: BudgetPeriod;
    limitTokens?: number;
    limitCostUsd?: number;
    warningThreshold: number;
    actionsOnWarning: CostAlertAction[];
    actionsOnBreach: CostAlertAction[];
}
/**
 * Actions to take when cost threshold is crossed.
 */
export type CostAlertAction = "sev1_alert" | "sev2_alert" | "sev3_alert" | "queue_slowdown" | "workflow_pause" | "workflow_degrade" | "step_abort";
/**
 * Tracks accumulated cost for a given scope.
 */
export interface CostAccumulator {
    scope: BudgetScope;
    scopeId: string;
    accumulatedCostUsd: number;
    accumulatedTokens: number;
    periodStart: Timestamp;
    periodEnd: Timestamp;
    lastUpdatedAt: Timestamp;
}
/**
 * Result of evaluating cost against a budget policy.
 */
export interface CostEvaluationResult {
    allowed: boolean;
    currentCostUsd: number;
    projectedCostUsd: number | null;
    remainingBudgetUsd: number | null;
    thresholdRatio: number;
    alertLevel: CostAlertLevel;
    reasonCode: CostAlertReasonCode;
}
/**
 * Alert level based on threshold proximity.
 */
export type CostAlertLevel = "ok" | "warning" | "critical" | "exceeded";
/**
 * Reason codes for cost evaluation results.
 */
export type CostAlertReasonCode = "cost.ok" | "cost.approaching_limit" | "cost.critical" | "cost.exceeded" | "cost.step_limit_exceeded" | "cost.daily_limit_exceeded" | "cost.monthly_limit_exceeded";
/**
 * Event emitted when a cost threshold is exceeded.
 * Used for real-time alerting and automated response.
 */
export interface CostThresholdExceededEvent {
    eventType: "cost.threshold.exceeded";
    eventTier: "tier_1" | "tier_2" | "tier_3";
    scope: BudgetScope;
    scopeId: string;
    alertLevel: CostAlertLevel;
    reasonCode: CostAlertReasonCode;
    currentCostUsd: number;
    limitCostUsd: number | null;
    accumulatedTokens: number;
    limitTokens: number | null;
    periodStart: Timestamp;
    periodEnd: Timestamp;
    triggeredAt: Timestamp;
    tenantId: string | null;
    taskId: string | null;
    executionId: string | null;
    stepId: string | null;
}
/**
 * Cost alert configuration for a tenant or platform.
 */
export interface CostAlertConfig {
    enabled: boolean;
    platformBudgetPolicy: BudgetPolicy | null;
    tenantBudgetPolicies: Record<string, BudgetPolicy>;
    packBudgetPolicies: Record<string, BudgetPolicy>;
    defaultWarningThreshold: number;
}
/**
 * Step-level usage record for cost tracking.
 * Matches the architecture doc §18 UsageRecord specification.
 */
export interface StepUsageRecord {
    recordId: string;
    timestamp: Timestamp;
    tenantId: string;
    workflowRunId: string | null;
    stepId: string;
    provider: string;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd: number;
    currency: "USD";
    cached: boolean;
}
