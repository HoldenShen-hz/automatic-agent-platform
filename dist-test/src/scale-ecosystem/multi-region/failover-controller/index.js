export function resolveRegionFailover(input) {
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
//# sourceMappingURL=index.js.map