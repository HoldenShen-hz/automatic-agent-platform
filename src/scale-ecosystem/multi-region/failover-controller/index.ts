export interface RegionFailoverInput {
  readonly primaryHealthy: boolean;
  readonly candidateRegionIds: readonly string[];
  readonly primaryLatencyMs?: number;
  readonly maxAcceptableLatencyMs?: number;
  readonly primaryErrorRate?: number;
  readonly maxAcceptableErrorRate?: number;
  readonly preferredRegionId?: string | null;
}

export interface RegionFailoverDecision {
  readonly shouldFailover: boolean;
  readonly targetRegionId: string | null;
  readonly rationale: string;
}

export function resolveRegionFailover(input: RegionFailoverInput): RegionFailoverDecision {
  const latencyBreached = input.primaryLatencyMs != null
    && input.maxAcceptableLatencyMs != null
    && input.primaryLatencyMs > input.maxAcceptableLatencyMs;
  const errorRateBreached = input.primaryErrorRate != null
    && input.maxAcceptableErrorRate != null
    && input.primaryErrorRate > input.maxAcceptableErrorRate;
  const degraded = !input.primaryHealthy || latencyBreached || errorRateBreached;

  if (!degraded || input.candidateRegionIds.length === 0) {
    return {
      shouldFailover: false,
      targetRegionId: null,
      rationale: degraded ? "multi_region.no_candidate_available" : "multi_region.primary_within_threshold",
    };
  }

  const targetRegionId = input.preferredRegionId && input.candidateRegionIds.includes(input.preferredRegionId)
    ? input.preferredRegionId
    : input.candidateRegionIds[0] ?? null;
  return {
    shouldFailover: true,
    targetRegionId,
    rationale: !input.primaryHealthy
      ? "multi_region.primary_unhealthy"
      : latencyBreached
        ? "multi_region.primary_latency_breached"
        : "multi_region.primary_error_rate_breached",
  };
}
