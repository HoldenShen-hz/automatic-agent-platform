/**
 * Cache Bootstrap
 *
 * Initializes the cache subsystem and provides access to the cache facade.
 * Singleton pattern with lazy initialization.
 */
import { CacheFacade } from "./cache-facade.js";
import type { CacheStore } from "./stores/cache-store.js";
import { CacheInvalidationEngine } from "./cache-invalidation.js";
import { CacheMetrics } from "./cache-metrics.js";
import type { RedisCacheConfig } from "./stores/redis-cache-store.js";
export interface CacheBootstrapOptions {
    /** Maximum L1 memory cache entries (default: 2000) */
    maxL1Entries?: number;
    /** Whether to enable persistent L3 cache (default: true) */
    enableL3Cache?: boolean;
    /** Custom L2/L3 store (optional) */
    l2l3Store?: CacheStore;
    /** Redis configuration for L2 shared cache */
    redis?: RedisCacheConfig;
}
/**
 * Initializes the cache subsystem.
 * Idempotent - subsequent calls return the same instance.
 */
export declare function initializeCache(options?: CacheBootstrapOptions): CacheFacade;
/**
 * Returns the initialized cache facade.
 * Throws if cache has not been initialized.
 */
export declare function getCacheFacade(): CacheFacade;
/**
 * Returns the cache store instance.
 */
export declare function getCacheStore(): CacheStore;
/**
 * Returns the invalidation engine.
 */
export declare function getInvalidationEngine(): CacheInvalidationEngine;
/**
 * Returns the metrics instance.
 */
export declare function getCacheMetrics(): CacheMetrics;
/**
 * Resets the cache subsystem (for testing).
 */
export declare function resetCache(): void;
/**
 * Returns true if cache has been initialized.
 */
export declare function isCacheInitialized(): boolean;
