export interface SlaObservation {
  readonly latencyMs: number;
  readonly successRate: number;
  readonly queueWaitMs: number;
  readonly executionTimeoutRate?: number;
  readonly dependencyAvailability?: number;
}

export interface SlaCommitment {
  readonly maxLatencyMs: number;
  readonly minSuccessRate: number;
  readonly maxQueueWaitMs: number;
  readonly maxExecutionTimeoutRate?: number;
  readonly minDependencyAvailability?: number;
}

/**
 * SLO burn-rate and error-budget tracking state.
 * §181-2131: Previously there was no burn-rate/error-budget tracking.
 */
export interface SloBurnRateState {
  readonly windowStartMs: number;
  readonly totalRequests: number;
  readonly errorCount: number;
  readonly currentBurnRate: number; // errors per second
  readonly errorBudgetRemaining: number; // percentage (0-100)
  readonly errorBudgetConsumed: number; // percentage (0-100)
}

/**
 * Calculate burn-rate and error-budget consumption.
 * @param observations - Historical observations within the SLO window
 * @param sloWindowMs - SLO window in milliseconds (e.g., 30 days = 30*24*60*60*1000)
 * @param targetErrorRate - Target error rate (e.g., 0.01 for 1% errors allowed)
 * @returns Burn-rate state including error-budget consumption
 */
export function calculateBurnRate(
  observations: readonly { errorCount: number; requestCount: number; timestampMs: number }[],
  sloWindowMs: number,
  targetErrorRate: number,
): SloBurnRateState {
  if (observations.length === 0) {
    return {
      windowStartMs: Date.now(),
      totalRequests: 0,
      errorCount: 0,
      currentBurnRate: 0,
      errorBudgetRemaining: 100,
      errorBudgetConsumed: 0,
    };
  }

  const now = Date.now();
  const windowStartMs = now - sloWindowMs;
  const validObservations = observations.filter((o) => o.timestampMs >= windowStartMs);

  const totalRequests = validObservations.reduce((sum, o) => sum + o.requestCount, 0);
  const errorCount = validObservations.reduce((sum, o) => sum + o.errorCount, 0);

  // Actual error rate
  const actualErrorRate = totalRequests > 0 ? errorCount / totalRequests : 0;

  // Burn-rate: how fast we're consuming error budget relative to time elapsed
  // burn-rate > 1 means we're erroring faster than allowed
  // burn-rate < 1 means we're within SLO
  const elapsedMs = now - Math.min(...validObservations.map((o) => o.timestampMs));
  const expectedErrors = elapsedMs > 0 ? (elapsedMs / sloWindowMs) * totalRequests * targetErrorRate : 0;
  const currentBurnRate = expectedErrors > 0 ? errorCount / expectedErrors : 0;

  // Error budget calculations
  // Budget consumed = actual errors / allowed errors (at target rate)
  const allowedErrors = totalRequests * targetErrorRate;
  const errorBudgetConsumed = allowedErrors > 0 ? Math.min(100, (errorCount / allowedErrors) * 100) : 0;
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

export function detectSlaBreach(observation: SlaObservation, commitment: SlaCommitment): string[] {
  const breaches: string[] = [];
  if (observation.latencyMs > commitment.maxLatencyMs) breaches.push("sla.latency_breach");
  if (observation.successRate < commitment.minSuccessRate) breaches.push("sla.success_rate_breach");
  if (observation.queueWaitMs > commitment.maxQueueWaitMs) breaches.push("sla.queue_wait_breach");
  if ((observation.executionTimeoutRate ?? 0) > (commitment.maxExecutionTimeoutRate ?? Number.POSITIVE_INFINITY)) breaches.push("sla.execution_timeout_breach");
  if ((observation.dependencyAvailability ?? 1) < (commitment.minDependencyAvailability ?? 0)) breaches.push("sla.dependency_unavailability_breach");
  return breaches;
}
