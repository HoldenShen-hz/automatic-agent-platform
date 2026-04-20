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
import type { CacheStore } from "./stores/cache-store.js";
import { CacheInvalidationEngine } from "./cache-invalidation.js";
import { CacheMetrics } from "./cache-metrics.js";
import type { RedisCacheConfig } from "./stores/redis-cache-store.js";
import { RedisCacheStore } from "./stores/redis-cache-store.js";

let cacheInstance: CacheFacade | null = null;
let cacheStoreInstance: CacheStore | null = null;
let invalidationEngineInstance: CacheInvalidationEngine | null = null;
let metricsInstance: CacheMetrics | null = null;

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

function createDefaultStore(maxL1Entries: number, redisConfig?: RedisCacheConfig): CacheStore {
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
export function initializeCache(options: CacheBootstrapOptions = {}): CacheFacade {
  if (cacheInstance) {
    return cacheInstance;
  }

  const {
    maxL1Entries = 2000,
    l2l3Store,
    redis: redisConfig,
  } = options;

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
export function getCacheFacade(): CacheFacade {
  if (!cacheInstance) {
    throw new InternalAppError(
      "cache.not_initialized",
      "CacheFacade not initialized. Call initializeCache() first.",
      { source: "runtime" },
    );
  }
  return cacheInstance;
}

/**
 * Returns the cache store instance.
 */
export function getCacheStore(): CacheStore {
  if (!cacheStoreInstance) {
    throw new InternalAppError(
      "cache.store_not_initialized",
      "Cache store not initialized. Call initializeCache() first.",
      { source: "runtime" },
    );
  }
  return cacheStoreInstance;
}

/**
 * Returns the invalidation engine.
 */
export function getInvalidationEngine(): CacheInvalidationEngine {
  if (!invalidationEngineInstance) {
    throw new InternalAppError(
      "cache.invalidation_not_initialized",
      "Cache not initialized. Call initializeCache() first.",
      { source: "runtime" },
    );
  }
  return invalidationEngineInstance;
}

/**
 * Returns the metrics instance.
 */
export function getCacheMetrics(): CacheMetrics {
  if (!metricsInstance) {
    throw new InternalAppError(
      "cache.metrics_not_initialized",
      "Cache not initialized. Call initializeCache() first.",
      { source: "runtime" },
    );
  }
  return metricsInstance;
}

/**
 * Resets the cache subsystem (for testing).
 */
export function resetCache(): void {
  cacheInstance = null;
  cacheStoreInstance = null;
  invalidationEngineInstance = null;
  metricsInstance = null;
}

/**
 * Returns true if cache has been initialized.
 */
export function isCacheInitialized(): boolean {
  return cacheInstance !== null;
}
