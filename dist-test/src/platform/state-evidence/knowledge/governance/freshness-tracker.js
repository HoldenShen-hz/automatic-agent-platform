export class FreshnessTracker {
    assess(source, namespace, now = new Date()) {
        const ageMs = now.getTime() - new Date(source.freshnessTimestamp).getTime();
        const daysOld = Math.max(0, Math.floor(ageMs / (24 * 60 * 60 * 1000)));
        const stale = daysOld > namespace.freshnessPolicy.maxAgeDays;
        return {
            stale,
            daysOld,
            effectiveTrustLevel: stale && source.trustLevel === "verified" ? "reviewed" : source.trustLevel,
            action: stale ? namespace.freshnessPolicy.staleAction : null,
        };
    }
}
//# sourceMappingURL=freshness-tracker.js.map