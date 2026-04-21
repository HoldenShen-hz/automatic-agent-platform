/**
 * Cache Metrics
 *
 * Tracks cache performance metrics including hits, misses,
 * invalidations, and per-namespace statistics.
 */
import type { CacheLayer, CacheMissReason } from './cache-types.js';
export interface CacheMetricEntry {
    hit: boolean;
    namespace?: string;
    layer?: CacheLayer;
    reason?: CacheMissReason;
}
export interface CacheMetricsSnapshot {
    totalHits: number;
    totalMisses: number;
    hitRate: number;
    byNamespace: Record<string, {
        hits: number;
        misses: number;
        hitRate: number;
        byLayer?: Record<string, number>;
        byReason?: Record<string, number>;
    }>;
}
export declare class CacheMetrics {
    private hits;
    private misses;
    private byNamespace;
    record(entry: CacheMetricEntry): void;
    snapshot(): CacheMetricsSnapshot;
    reset(): void;
}
