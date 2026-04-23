/**
 * Cache Metrics
 *
 * Tracks cache performance metrics including hits, misses,
 * invalidations, and per-namespace statistics.
 */
export class CacheMetrics {
    hits = 0;
    misses = 0;
    byNamespace = {};
    record(entry) {
        const namespace = entry.namespace ?? 'unknown';
        if (!this.byNamespace[namespace]) {
            this.byNamespace[namespace] = { hits: 0, misses: 0, byLayer: {}, byReason: {} };
        }
        if (entry.hit) {
            this.hits++;
            this.byNamespace[namespace].hits++;
            if (entry.layer) {
                this.byNamespace[namespace].byLayer[entry.layer] =
                    (this.byNamespace[namespace].byLayer[entry.layer] ?? 0) + 1;
            }
        }
        else {
            this.misses++;
            this.byNamespace[namespace].misses++;
            if (entry.reason) {
                this.byNamespace[namespace].byReason[entry.reason] =
                    (this.byNamespace[namespace].byReason[entry.reason] ?? 0) + 1;
            }
        }
    }
    snapshot() {
        const total = this.hits + this.misses;
        const result = {
            totalHits: this.hits,
            totalMisses: this.misses,
            hitRate: total > 0 ? this.hits / total : 0,
            byNamespace: {},
        };
        for (const [ns, stats] of Object.entries(this.byNamespace)) {
            const nsTotal = stats.hits + stats.misses;
            result.byNamespace[ns] = {
                hits: stats.hits,
                misses: stats.misses,
                hitRate: nsTotal > 0 ? stats.hits / nsTotal : 0,
                byLayer: stats.byLayer,
                byReason: stats.byReason,
            };
        }
        return result;
    }
    reset() {
        this.hits = 0;
        this.misses = 0;
        this.byNamespace = {};
    }
}
//# sourceMappingURL=cache-metrics.js.map