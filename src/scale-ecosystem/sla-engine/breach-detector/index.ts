export interface SlaObservation {
  readonly latencyMs: number;
  readonly successRate: number;
  readonly queueWaitMs: number;
}

export interface SlaCommitment {
  readonly maxLatencyMs: number;
  readonly minSuccessRate: number;
  readonly maxQueueWaitMs: number;
}

export function detectSlaBreach(observation: SlaObservation, commitment: SlaCommitment): string[] {
  const breaches: string[] = [];
  if (observation.latencyMs > commitment.maxLatencyMs) breaches.push("sla.latency_breach");
  if (observation.successRate < commitment.minSuccessRate) breaches.push("sla.success_rate_breach");
  if (observation.queueWaitMs > commitment.maxQueueWaitMs) breaches.push("sla.queue_wait_breach");
  return breaches;
}
