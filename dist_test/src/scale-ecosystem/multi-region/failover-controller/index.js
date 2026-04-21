export function resolveRegionFailover(input) {
    if (input.primaryHealthy || input.candidateRegionIds.length === 0) {
        return { shouldFailover: false, targetRegionId: null };
    }
    return { shouldFailover: true, targetRegionId: input.candidateRegionIds[0] ?? null };
}
//# sourceMappingURL=index.js.map