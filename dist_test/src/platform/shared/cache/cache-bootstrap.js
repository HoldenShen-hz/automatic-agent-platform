/**
 * Cache Bootstrap
 *
 * Initializes the cache subsystem and provides access to the cache facade.
 * Singleton pattern with lazy initialization.
 */
import { InternalAppError } from "../../contracts/errors.js";
import { CacheFacade } from "./cache-facade.js";
import { MemoryCacheStore } from "./stores/memory-cache-store.js";
import { MultiLevelCacheStore } from "./stores/multi-level-cache-store.js";
import { CacheInvalidationEngine } from "./cache-invalidation.js";
import { CacheMetrics } from "./cache-metrics.js";
import { RedisCacheStore } from "./stores/redis-cache-store.js";
let cacheInstance = null;
let cacheStoreInstance = null;
let invalidationEngineInstance = null;
let metricsInstance = null;
function createDefaultStore(maxL1Entries, redisConfig) {
    const l1 = new MemoryCacheStore(maxL1Entries);
    if (redisConfig) {
        // L2: Redis shared cache
        const l2 = new RedisCacheStore(redisConfig);
        // L3: same as L1 for now (SQLiteCacheStore can be added later)
        return new MultiLevelCacheStore(l1, l2, l1);
    }
    // L2 and L3 use in-memory fallback; can be replaced with SQLite
    return new MultiLevelCacheStore(l1, l1, l1);
}
/**
 * Initializes the cache subsystem.
 * Idempotent - subsequent calls return the same instance.
 */
export function initializeCache(options = {}) {
    if (cacheInstance) {
        return cacheInstance;
    }
    const { maxL1Entries = 2000, l2l3Store, redis: redisConfig, } = options;
    const metrics = new CacheMetrics();
    const store = l2l3Store ?? createDefaultStore(maxL1Entries, redisConfig);
    cacheStoreInstance = store;
    metricsInstance = metrics;
    cacheInstance = new CacheFacade(store, metrics);
    invalidationEngineInstance = new CacheInvalidationEngine(cacheInstance);
    return cacheInstance;
}
/**
 * Returns the initialized cache facade.
 * Throws if cache has not been initialized.
 */
export function getCacheFacade() {
    if (!cacheInstance) {
        throw new InternalAppError("cache.not_initialized", "CacheFacade not initialized. Call initializeCache() first.", { source: "runtime" });
    }
    return cacheInstance;
}
/**
 * Returns the cache store instance.
 */
export function getCacheStore() {
    if (!cacheStoreInstance) {
        throw new InternalAppError("cache.store_not_initialized", "Cache store not initialized. Call initializeCache() first.", { source: "runtime" });
    }
    return cacheStoreInstance;
}
/**
 * Returns the invalidation engine.
 */
export function getInvalidationEngine() {
    if (!invalidationEngineInstance) {
        throw new InternalAppError("cache.invalidation_not_initialized", "Cache not initialized. Call initializeCache() first.", { source: "runtime" });
    }
    return invalidationEngineInstance;
}
/**
 * Returns the metrics instance.
 */
export function getCacheMetrics() {
    if (!metricsInstance) {
        throw new InternalAppError("cache.metrics_not_initialized", "Cache not initialized. Call initializeCache() first.", { source: "runtime" });
    }
    return metricsInstance;
}
/**
 * Resets the cache subsystem (for testing).
 */
export function resetCache() {
    cacheInstance = null;
    cacheStoreInstance = null;
    invalidationEngineInstance = null;
    metricsInstance = null;
}
/**
 * Returns true if cache has been initialized.
 */
export function isCacheInitialized() {
    return cacheInstance !== null;
}
//# sourceMappingURL=cache-bootstrap.js.map