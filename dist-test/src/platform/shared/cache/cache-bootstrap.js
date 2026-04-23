/**
 * Cache Bootstrap
 *
 * Initializes the cache subsystem and provides access to the cache facade.
 * Singleton pattern with lazy initialization.
 */
import { InternalAppError } from "../../contracts/errors.js";
import { ServiceRegistry } from "../lifecycle/service-registry.js";
import { CacheFacade } from "./cache-facade.js";
import { MemoryCacheStore } from "./stores/memory-cache-store.js";
import { MultiLevelCacheStore } from "./stores/multi-level-cache-store.js";
import { CacheInvalidationEngine } from "./cache-invalidation.js";
import { CacheMetrics } from "./cache-metrics.js";
import { RedisCacheStore } from "./stores/redis-cache-store.js";
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
class CacheBootstrapManager {
    runtime = null;
    initialize(options = {}) {
        const configKey = this.createConfigKey(options);
        if (this.runtime != null) {
            if (this.runtime.configKey !== configKey) {
                throw new InternalAppError("cache.reinitialize_with_different_options", "Cache has already been initialized with a different configuration.", { source: "runtime", details: { previousConfigKey: this.runtime.configKey, requestedConfigKey: configKey } });
            }
            return this.runtime.facade;
        }
        const { maxL1Entries = 2000, l2l3Store, redis: redisConfig, } = options;
        const metrics = new CacheMetrics();
        const store = l2l3Store ?? createDefaultStore(maxL1Entries, redisConfig);
        const facade = new CacheFacade(store, metrics);
        const invalidationEngine = new CacheInvalidationEngine(facade);
        this.runtime = {
            facade,
            store,
            invalidationEngine,
            metrics,
            configKey,
        };
        return facade;
    }
    getFacade() {
        return this.getRuntime().facade;
    }
    getStore() {
        return this.getRuntime().store;
    }
    getInvalidationEngine() {
        return this.getRuntime().invalidationEngine;
    }
    getMetrics() {
        return this.getRuntime().metrics;
    }
    reset() {
        this.runtime = null;
    }
    isInitialized() {
        return this.runtime != null;
    }
    getRuntime() {
        if (this.runtime == null) {
            throw new InternalAppError("cache.not_initialized", "CacheFacade not initialized. Call initializeCache() first.", { source: "runtime" });
        }
        return this.runtime;
    }
    createConfigKey(options) {
        return JSON.stringify({
            maxL1Entries: options.maxL1Entries ?? 2000,
            enableL3Cache: options.enableL3Cache ?? true,
            hasCustomStore: options.l2l3Store != null,
            redis: options.redis ?? null,
        });
    }
}
const CACHE_BOOTSTRAP_MANAGER_SERVICE = "cache-bootstrap-manager";
function getCacheBootstrapManager() {
    const registry = ServiceRegistry.getInstance();
    registry.register(CACHE_BOOTSTRAP_MANAGER_SERVICE, {
        init: () => new CacheBootstrapManager(),
    });
    return registry.get(CACHE_BOOTSTRAP_MANAGER_SERVICE);
}
/**
 * Initializes the cache subsystem.
 * Idempotent - subsequent calls return the same instance.
 */
export function initializeCache(options = {}) {
    return getCacheBootstrapManager().initialize(options);
}
/**
 * Returns the initialized cache facade.
 * Throws if cache has not been initialized.
 */
export function getCacheFacade() {
    return getCacheBootstrapManager().getFacade();
}
/**
 * Returns the cache store instance.
 */
export function getCacheStore() {
    try {
        return getCacheBootstrapManager().getStore();
    }
    catch (error) {
        if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
            throw new InternalAppError("cache.store_not_initialized", "Cache store not initialized. Call initializeCache() first.", { source: "runtime" });
        }
        throw error;
    }
}
/**
 * Returns the invalidation engine.
 */
export function getInvalidationEngine() {
    try {
        return getCacheBootstrapManager().getInvalidationEngine();
    }
    catch (error) {
        if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
            throw new InternalAppError("cache.invalidation_not_initialized", "Cache not initialized. Call initializeCache() first.", { source: "runtime" });
        }
        throw error;
    }
}
/**
 * Returns the metrics instance.
 */
export function getCacheMetrics() {
    try {
        return getCacheBootstrapManager().getMetrics();
    }
    catch (error) {
        if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
            throw new InternalAppError("cache.metrics_not_initialized", "Cache not initialized. Call initializeCache() first.", { source: "runtime" });
        }
        throw error;
    }
}
/**
 * Resets the cache subsystem (for testing).
 */
export function resetCache() {
    getCacheBootstrapManager().reset();
}
/**
 * Returns true if cache has been initialized.
 */
export function isCacheInitialized() {
    return getCacheBootstrapManager().isInitialized();
}
//# sourceMappingURL=cache-bootstrap.js.map