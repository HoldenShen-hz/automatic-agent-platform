/**
 * Cache Orchestration Module
 *
 * Unified cache management for Prompt, Tool, Memory, and Planner caches.
 * Provides multi-level caching (L1/L2/L3) with consistent key generation,
 * invalidation, and metrics.
 */

// Core types
export * from './cache-types.js';

// Errors
export * from './cache-errors.js';

// Store interfaces and implementations
export type { CacheStore } from './stores/cache-store.js';
export { MemoryCacheStore } from './stores/memory-cache-store.js';
export { MultiLevelCacheStore } from './stores/multi-level-cache-store.js';
export { SqliteCacheStore } from './stores/sqlite-cache-store.js';

// Key generation and normalization
export { CacheKeyFactory } from './cache-key-factory.js';
export { CacheNormalizer, normalizePath, normalizeQuery } from './cache-normalizer.js';
export * from './utils/stable-stringify.js';
export * from './utils/stable-hash.js';
export * from './utils/normalize-path.js';
export * from './utils/normalize-query.js';
export * from './utils/tag-builder.js';

// Policy
export * from './cache-policy.js';
export * from './policies/tool-cache-policy.js';
export * from './policies/prompt-cache-policy.js';
export * from './policies/memory-cache-policy.js';
export * from './policies/planner-cache-policy.js';

// Facade and metrics
export { CacheFacade } from './cache-facade.js';
export { CacheMetrics } from './cache-metrics.js';
export { CacheInvalidationEngine } from './cache-invalidation.js';
export { CacheOrchestrationService } from './cache-orchestration-service.js';

// Bootstrap
export {
  initializeCache,
  getCacheFacade,
  getCacheStore,
  getInvalidationEngine,
  getCacheMetrics,
  resetCache,
  isCacheInitialized,
} from './cache-bootstrap.js';

// Middleware
export {
  createCacheGovernanceMiddleware,
  createCacheSummaryMiddleware,
  invalidateToolCache,
} from './middleware/cache-governance-middleware.js';
