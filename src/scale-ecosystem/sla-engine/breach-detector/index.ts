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

export function detectSlaBreach(observation: SlaObservation, commitment: SlaCommitment): string[] {
  const breaches: string[] = [];
  if (observation.latencyMs > commitment.maxLatencyMs) breaches.push("sla.latency_breach");
  if (observation.successRate < commitment.minSuccessRate) breaches.push("sla.success_rate_breach");
  if (observation.queueWaitMs > commitment.maxQueueWaitMs) breaches.push("sla.queue_wait_breach");
  if ((observation.executionTimeoutRate ?? 0) > (commitment.maxExecutionTimeoutRate ?? Number.POSITIVE_INFINITY)) breaches.push("sla.execution_timeout_breach");
  if ((observation.dependencyAvailability ?? 1) < (commitment.minDependencyAvailability ?? 0)) breaches.push("sla.dependency_unavailability_breach");
  return breaches;
}
