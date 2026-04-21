/**
 * Cache Facade
 *
 * Main entry point for cache operations. Provides get/set/getOrCompute
 * with automatic key generation, policy resolution, and metrics collection.
 */
import type { CacheComputeOptions, CacheLookupResult } from './cache-types.js';
import type { CacheFacade as ICacheFacade } from './cache-facade.js';
import type { CacheStore } from './stores/cache-store.js';
import { CacheMetrics } from './cache-metrics.js';
export declare class CacheFacade implements ICacheFacade {
    private readonly store;
    private readonly metrics;
    private readonly pendingComputes;
    constructor(store: CacheStore, metrics?: CacheMetrics);
    get<T>(namespace: string, normalizedInput: unknown): Promise<CacheLookupResult<T>>;
    set<T>(namespace: string, normalizedInput: unknown, value: T, options?: CacheComputeOptions): Promise<void>;
    getOrCompute<T>(namespace: string, normalizedInput: unknown, compute: () => Promise<T>, options?: CacheComputeOptions): Promise<{
        value: T;
        fromCache: boolean;
    }>;
    invalidateByTag(tag: string): Promise<number>;
    invalidateNamespace(namespace: string): Promise<number>;
    getMetricsSnapshot(): import("./cache-metrics.js").CacheMetricsSnapshot;
}
