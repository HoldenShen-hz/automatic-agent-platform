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
    byLayer: Record<string, number>;
    byReason: Record<string, number>;
  }>;
}

export class CacheMetrics {
  private hits = 0;
  private misses = 0;
  private byNamespace: Record<string, { hits: number; misses: number; byLayer: Record<string, number>; byReason: Record<string, number> }> = {};

  record(entry: CacheMetricEntry): void {
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
    } else {
      this.misses++;
      this.byNamespace[namespace].misses++;
      if (entry.reason) {
        this.byNamespace[namespace].byReason[entry.reason] =
          (this.byNamespace[namespace].byReason[entry.reason] ?? 0) + 1;
      }
    }
  }

  snapshot(): CacheMetricsSnapshot {
    const total = this.hits + this.misses;
    const result: CacheMetricsSnapshot = {
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

  reset(): void {
    this.hits = 0;
    this.misses = 0;
    this.byNamespace = {};
  }
}
