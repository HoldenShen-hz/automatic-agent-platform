/**
 * Unit tests for CacheGovernanceMiddleware.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createCacheGovernanceMiddleware, createCacheSummaryMiddleware } from "../../../../../../src/platform/shared/cache/middleware/cache-governance-middleware.js";
import { CacheMetrics, type CacheMetricsSnapshot } from "../../../../../../src/platform/shared/cache/cache-metrics.js";
import type { CacheFacade } from "../../../../../../src/platform/shared/cache/cache-facade.js";
import type { CacheStore } from "../../../../../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheLookupResult } from "../../../../../../src/platform/shared/cache/cache-types.js";
import type { StructuredLogger, StructuredLogEntry } from "../../../../../../src/platform/shared/observability/structured-logger.js";

function createLookupResult<T>(value: T | null, hit = false): CacheLookupResult<T> {
  return hit ? { hit: true, value } : { hit: false, value, reason: "not_found" };
}

function createLogEntry(
  level: StructuredLogEntry["level"],
  message: string,
  data?: Record<string, unknown>,
): StructuredLogEntry {
  return {
    level,
    message,
    service: "test-service",
    timestamp: "2026-04-23T00:00:00.000Z",
    ...(data == null ? {} : { data }),
    createdAt: "2026-04-23T00:00:00.000Z",
  };
}

function createMockCache(overrides: {
  getOrCompute?: <T>(
    namespace: string,
    normalizedInput: unknown,
    compute: () => Promise<T>,
    options?: unknown,
  ) => Promise<{ value: T; fromCache: boolean }>;
  getMetricsSnapshot?: () => CacheMetricsSnapshot | undefined;
} = {}): CacheFacade {
  const store: CacheStore = {
    get: async <T>() => createLookupResult<T>(null),
    set: async () => {},
    delete: async () => {},
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    cleanupExpired: async () => 0,
  };

  return {
    pendingComputes: new Map<string, Promise<unknown>>(),
    store,
    metrics: new CacheMetrics(),
    get: async <T>() => createLookupResult<T>(null),
    getOrCompute: overrides.getOrCompute ?? (async <T>(
      _namespace: string,
      _normalizedInput: unknown,
      compute: () => Promise<T>,
    ): Promise<{ value: T; fromCache: boolean }> => {
      const value = await compute();
      return { value, fromCache: false };
    }),
    invalidateByTag: async () => 0,
    invalidateNamespace: async () => 0,
    getMetricsSnapshot: overrides.getMetricsSnapshot ?? (() => ({
      totalHits: 0,
      totalMisses: 0,
      hitRate: 0,
      byNamespace: {},
    })),
  } as unknown as CacheFacade;
}

function createMockLogger(overrides: {
  debug?: (message: string, data?: Record<string, unknown>) => StructuredLogEntry;
  warn?: (message: string, data?: Record<string, unknown>) => StructuredLogEntry;
} = {}): StructuredLogger {
  return {
    debug: overrides.debug ?? ((message, data) => createLogEntry("debug", message, data)),
    warn: overrides.warn ?? ((message, data) => createLogEntry("warn", message, data)),
  } as unknown as StructuredLogger;
}

test("createCacheGovernanceMiddleware returns middleware with name and priority", () => {
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache(),
  });

  assert.equal(middleware.name, "cache-governance");
  assert.equal(middleware.priority, 40);
});

test("createCacheSummaryMiddleware returns AfterAgentHook with name and priority", () => {
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache(),
  });

  assert.equal(hook.name, "cache-summary");
  assert.equal(hook.priority, 40);
});

test("createCacheSummaryMiddleware returns success true without metrics", async () => {
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache({
      getMetricsSnapshot: () => undefined,
    }),
  });

  const result = await hook.run({ taskId: "task-1" } as never, { response: null, toolsUsed: [] });
  assert.deepEqual(result, { success: true });
});

test("createCacheGovernanceMiddleware run returns next() result for non-cacheable tools", async () => {
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache(),
  });

  const result = await middleware.run(
    { taskId: "task-1" } as never,
    { toolName: "bash", args: {} },
    () => Promise.resolve("bash-result"),
  );

  assert.equal(result, "bash-result");
});

test("createCacheGovernanceMiddleware run returns next() when cache throws and warns", async () => {
  let warned = false;
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async (): Promise<never> => {
        throw new Error("Cache error");
      },
    }),
    logger: createMockLogger({
      warn: (message, data) => {
        warned = true;
        return createLogEntry("warn", message, data);
      },
    }),
  });

  const result = await middleware.run(
    { taskId: "task-2" } as never,
    { toolName: "read", args: { path: "/tmp/test" } },
    () => Promise.resolve("fallback-result"),
  );

  assert.equal(result, "fallback-result");
  assert.equal(warned, true);
});

test("createCacheSummaryMiddleware logs debug when metrics are present", async () => {
  let logged = false;
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache({
      getMetricsSnapshot: () => ({
        totalHits: 10,
        totalMisses: 2,
        hitRate: 10 / 12,
        byNamespace: {},
      }),
    }),
    logger: createMockLogger({
      debug: (message, data) => {
        logged = true;
        return createLogEntry("debug", message, data);
      },
    }),
  });

  await hook.run({ taskId: "task-4" } as never, { response: null, toolsUsed: [] });
  assert.equal(logged, true);
});
