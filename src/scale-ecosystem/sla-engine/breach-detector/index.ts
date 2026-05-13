export interface SlaObservation {
  readonly latencyMs: number;
  readonly successRate: number;
  readonly queueWaitMs: number;
  readonly executionTimeoutRate?: number;
  readonly dependencyAvailability?: number;
  readonly requestCount?: number;
  readonly windowMs?: number;
}

export interface SlaCommitment {
  readonly maxLatencyMs: number;
  readonly minSuccessRate: number;
  readonly maxQueueWaitMs: number;
  readonly maxExecutionTimeoutRate?: number;
  readonly minDependencyAvailability?: number;
  readonly errorBudgetPercent?: number;
  readonly budgetWindowMs?: number;
  readonly warningBurnRateThreshold?: number;
  readonly criticalBurnRateThreshold?: number;
}

export interface SlaBudgetAnalysis {
  readonly allowedErrorRate: number;
  readonly currentErrorRate: number;
  readonly errorBudget: number;
  readonly errorBudgetConsumed: number;
  readonly errorBudgetRemaining: number;
  readonly burnRate: number;
  readonly timeToExhaustMs: number | null;
  readonly latencyBurnRate: number;
  readonly queueWaitBurnRate: number;
}

export interface SlaBreachAnalysis {
  readonly breaches: string[];
  readonly alerts: string[];
  readonly budget: SlaBudgetAnalysis;
}

export interface SloBurnRateObservation {
  readonly errorCount: number;
  readonly requestCount: number;
  readonly timestampMs: number;
}

export interface SloBurnRateState {
  readonly windowStartMs: number;
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly currentBurnRate: number;
  readonly errorBudgetRemaining: number;
  readonly errorBudgetConsumed: number;
}

export function analyzeSlaBreach(observation: SlaObservation, commitment: SlaCommitment): SlaBreachAnalysis {
  const breaches: string[] = [];
  if (observation.latencyMs > commitment.maxLatencyMs) breaches.push("sla.latency_breach");
  if (observation.successRate < commitment.minSuccessRate) breaches.push("sla.success_rate_breach");
  if (observation.queueWaitMs > commitment.maxQueueWaitMs) breaches.push("sla.queue_wait_breach");
  if ((observation.executionTimeoutRate ?? 0) > (commitment.maxExecutionTimeoutRate ?? Number.POSITIVE_INFINITY)) breaches.push("sla.execution_timeout_breach");
  if ((observation.dependencyAvailability ?? 1) < (commitment.minDependencyAvailability ?? 0)) breaches.push("sla.dependency_unavailability_breach");

  const requestCount = Math.max(0, observation.requestCount ?? 0);
  const windowMs = Math.max(0, observation.windowMs ?? commitment.budgetWindowMs ?? 0);
  const allowedErrorRate = Math.max(0, commitment.errorBudgetPercent ?? (1 - commitment.minSuccessRate));
  const currentErrorRate = Math.max(0, 1 - observation.successRate);
  const errorBudget = requestCount * allowedErrorRate;
  const errorBudgetConsumed = requestCount * currentErrorRate;
  const errorBudgetRemaining = errorBudget - errorBudgetConsumed;
  const burnRate = allowedErrorRate <= 0
    ? (currentErrorRate > 0 ? Number.POSITIVE_INFINITY : 0)
    : currentErrorRate / allowedErrorRate;
  const errorsPerMs = windowMs > 0 ? errorBudgetConsumed / windowMs : 0;
  const timeToExhaustMs = errorBudgetRemaining > 0 && errorsPerMs > 0
    ? errorBudgetRemaining / errorsPerMs
    : errorBudgetRemaining <= 0
      ? 0
      : null;
  const latencyBurnRate = commitment.maxLatencyMs <= 0 ? 0 : observation.latencyMs / commitment.maxLatencyMs;
  const queueWaitBurnRate = commitment.maxQueueWaitMs <= 0 ? 0 : observation.queueWaitMs / commitment.maxQueueWaitMs;

  const alerts: string[] = [];
  const warningThreshold = commitment.warningBurnRateThreshold ?? 1;
  const criticalThreshold = commitment.criticalBurnRateThreshold ?? 2;
  if (burnRate >= criticalThreshold) {
    alerts.push("sla.error_budget_burn_critical");
  } else if (burnRate >= warningThreshold) {
    alerts.push("sla.error_budget_burn_warning");
  }
  if (timeToExhaustMs === 0 && errorBudget > 0) {
    alerts.push("sla.error_budget_exhausted");
  }

  return {
    breaches,
    alerts,
    budget: {
      allowedErrorRate,
      currentErrorRate,
      errorBudget,
      errorBudgetConsumed,
      errorBudgetRemaining,
      burnRate,
      timeToExhaustMs,
      latencyBurnRate,
      queueWaitBurnRate,
    },
  };
}

export function detectSlaBreach(observation: SlaObservation, commitment: SlaCommitment): string[] {
  return analyzeSlaBreach(observation, commitment).breaches;
}

export function calculateBurnRate(
  observations: readonly SloBurnRateObservation[],
  windowMs: number,
  targetErrorRate: number,
  nowMs: number = Date.now(),
): SloBurnRateState {
  const windowStartMs = nowMs - windowMs;
  const inWindow = observations.filter((observation) => observation.timestampMs >= windowStartMs && observation.timestampMs <= nowMs);
  const totalRequests = inWindow.reduce((sum, observation) => sum + Math.max(0, observation.requestCount), 0);
  const errorCount = inWindow.reduce((sum, observation) => sum + Math.max(0, observation.errorCount), 0);
  const currentErrorRate = totalRequests > 0 ? errorCount / totalRequests : 0;
  const currentBurnRate = targetErrorRate > 0 ? currentErrorRate / targetErrorRate : 0;
  const allowedErrors = totalRequests * Math.max(0, targetErrorRate);
  const rawConsumed = allowedErrors > 0 ? (errorCount / allowedErrors) * 100 : 0;
  const errorBudgetConsumed = Math.min(100, Math.max(0, rawConsumed));
  const errorBudgetRemaining = Math.max(0, 100 - errorBudgetConsumed);

  return {
    windowStartMs,
    totalRequests,
    errorCount,
    currentBurnRate,
    errorBudgetRemaining,
    errorBudgetConsumed,
  };
}
