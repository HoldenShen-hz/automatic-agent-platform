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
import type { CacheStore } from "./stores/cache-store.js";
import { CacheInvalidationEngine } from "./cache-invalidation.js";
import { CacheMetrics } from "./cache-metrics.js";
import type { RedisCacheConfig } from "./stores/redis-cache-store.js";
import { RedisCacheStore } from "./stores/redis-cache-store.js";

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

interface CacheBootstrapRuntime {
  facade: CacheFacade;
  store: CacheStore;
  invalidationEngine: CacheInvalidationEngine;
  metrics: CacheMetrics;
  configKey: string;
}

class CacheBootstrapManager {
  private runtime: CacheBootstrapRuntime | null = null;

  public initialize(options: CacheBootstrapOptions = {}): CacheFacade {
    const configKey = this.createConfigKey(options);
    if (this.runtime != null) {
      if (this.runtime.configKey !== configKey) {
        throw new InternalAppError(
          "cache.reinitialize_with_different_options",
          "Cache has already been initialized with a different configuration.",
          { source: "runtime", details: { previousConfigKey: this.runtime.configKey, requestedConfigKey: configKey } },
        );
      }
      return this.runtime.facade;
    }

    const {
      maxL1Entries = 2000,
      l2l3Store,
      redis: redisConfig,
    } = options;

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

  public getFacade(): CacheFacade {
    return this.getRuntime().facade;
  }

  public getStore(): CacheStore {
    return this.getRuntime().store;
  }

  public getInvalidationEngine(): CacheInvalidationEngine {
    return this.getRuntime().invalidationEngine;
  }

  public getMetrics(): CacheMetrics {
    return this.getRuntime().metrics;
  }

  public reset(): void {
    this.runtime = null;
  }

  public isInitialized(): boolean {
    return this.runtime != null;
  }

  private getRuntime(): CacheBootstrapRuntime {
    if (this.runtime == null) {
      throw new InternalAppError(
        "cache.not_initialized",
        "CacheFacade not initialized. Call initializeCache() first.",
        { source: "runtime" },
      );
    }
    return this.runtime;
  }

  private createConfigKey(options: CacheBootstrapOptions): string {
    return JSON.stringify({
      maxL1Entries: options.maxL1Entries ?? 2000,
      enableL3Cache: options.enableL3Cache ?? true,
      hasCustomStore: options.l2l3Store != null,
      redis: options.redis ?? null,
    });
  }
}

const CACHE_BOOTSTRAP_MANAGER_SERVICE = "cache-bootstrap-manager";
function getCacheBootstrapManager(): CacheBootstrapManager {
  const registry = ServiceRegistry.getInstance();
  try {
    return registry.get<CacheBootstrapManager>(CACHE_BOOTSTRAP_MANAGER_SERVICE);
  } catch (error) {
    if (!(error instanceof InternalAppError) || error.code !== "service_registry.not_registered") {
      throw error;
    }
    registry.register(CACHE_BOOTSTRAP_MANAGER_SERVICE, {
      init: () => new CacheBootstrapManager(),
    });
    return registry.get<CacheBootstrapManager>(CACHE_BOOTSTRAP_MANAGER_SERVICE);
  }
}

/**
 * Initializes the cache subsystem.
 * Idempotent - subsequent calls return the same instance.
 */
export function initializeCache(options: CacheBootstrapOptions = {}): CacheFacade {
  return getCacheBootstrapManager().initialize(options);
}

/**
 * Returns the initialized cache facade.
 * Throws if cache has not been initialized.
 */
export function getCacheFacade(): CacheFacade {
  return getCacheBootstrapManager().getFacade();
}

/**
 * Returns the cache store instance.
 */
export function getCacheStore(): CacheStore {
  try {
    return getCacheBootstrapManager().getStore();
  } catch (error) {
    if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
      throw new InternalAppError(
        "cache.store_not_initialized",
        "Cache store not initialized. Call initializeCache() first.",
        { source: "runtime" },
      );
    }
    throw error;
  }
}

/**
 * Returns the invalidation engine.
 */
export function getInvalidationEngine(): CacheInvalidationEngine {
  try {
    return getCacheBootstrapManager().getInvalidationEngine();
  } catch (error) {
    if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
      throw new InternalAppError(
        "cache.invalidation_not_initialized",
        "Cache not initialized. Call initializeCache() first.",
        { source: "runtime" },
      );
    }
    throw error;
  }
}

/**
 * Returns the metrics instance.
 */
export function getCacheMetrics(): CacheMetrics {
  try {
    return getCacheBootstrapManager().getMetrics();
  } catch (error) {
    if (error instanceof InternalAppError && error.code === "cache.not_initialized") {
      throw new InternalAppError(
        "cache.metrics_not_initialized",
        "Cache not initialized. Call initializeCache() first.",
        { source: "runtime" },
      );
    }
    throw error;
  }
}

/**
 * Resets the cache subsystem (for testing).
 */
export function resetCache(): void {
  getCacheBootstrapManager().reset();
}

/**
 * Returns true if cache has been initialized.
 */
export function isCacheInitialized(): boolean {
  return getCacheBootstrapManager().isInitialized();
}
