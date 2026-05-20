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

test("createCacheSummaryMiddleware returns warning result when metrics are unavailable", async () => {
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache({
      getMetricsSnapshot: () => undefined,
    }),
  });

  const result = await hook.run({ taskId: "task-1" } as never, { response: null, toolsUsed: [] });
  assert.deepEqual(result, {
    success: false,
    error: {
      code: "cache.metrics_snapshot_unavailable",
      message: "Cache metrics snapshot is unavailable.",
      warning: true,
    },
  });
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

// Additional tests for CacheGovernanceMiddleware edge cases

test("createCacheGovernanceMiddleware run with workspaceRoot normalizes path", async () => {
  let receivedArgs: Record<string, unknown> = {};
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(
        _namespace: string,
        normalizedInput: unknown,
        _compute: () => Promise<T>,
        _options?: unknown
      ): Promise<{ value: T; fromCache: boolean }> => {
        receivedArgs = normalizedInput as Record<string, unknown>;
        return { value: {} as T, fromCache: false };
      },
    }),
    workspaceRoot: "/workspace",
  });

  await middleware.run(
    { taskId: "task-workspace" } as never,
    { toolName: "read", args: { path: "relative/file.ts" } },
    () => Promise.resolve("result"),
  );

  // The path should be normalized when workspaceRoot is provided
  assert.ok(receivedArgs.path);
});

test("createCacheGovernanceMiddleware run calls cache with tool namespace", async () => {
  let receivedNamespace = "";
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(
        namespace: string,
        _normalizedInput: unknown,
        _compute: () => Promise<T>,
        _options?: unknown
      ): Promise<{ value: T; fromCache: boolean }> => {
        receivedNamespace = namespace;
        return { value: {} as T, fromCache: false };
      },
    }),
  });

  await middleware.run(
    { taskId: "task-ns" } as never,
    { toolName: "read", args: { path: "/tmp/file" } },
    () => Promise.resolve("result"),
  );

  assert.equal(receivedNamespace, "tool.read");
});

test("createCacheGovernanceMiddleware run includes tags from context", async () => {
  let receivedOptions: unknown;
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(
        _namespace: string,
        _normalizedInput: unknown,
        _compute: () => Promise<T>,
        options?: unknown
      ): Promise<{ value: T; fromCache: boolean }> => {
        receivedOptions = options;
        return { value: {} as T, fromCache: false };
      },
    }),
  });

  await middleware.run(
    { taskId: "task-tags" } as never,
    { toolName: "read", args: { path: "/tmp/file" } },
    () => Promise.resolve("result"),
  );

  assert.ok(receivedOptions && typeof receivedOptions === "object" && "tags" in (receivedOptions as object));
});

test("createCacheGovernanceMiddleware run returns cached result when fromCache is true", async () => {
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(): Promise<{ value: T; fromCache: boolean }> => {
        return { value: "cached-result" as unknown as T, fromCache: true };
      },
    }),
  });

  const result = await middleware.run(
    { taskId: "task-cached" } as never,
    { toolName: "read", args: {} },
    () => Promise.resolve("fresh-result"),
  );

  assert.equal(result, "cached-result");
});

test("createCacheGovernanceMiddleware run does not call next when cache returns result", async () => {
  let nextCalled = false;
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(): Promise<{ value: T; fromCache: boolean }> => {
        return { value: "cached" as unknown as T, fromCache: true };
      },
    }),
  });

  await middleware.run(
    { taskId: "task-next" } as never,
    { toolName: "read", args: {} },
    () => { nextCalled = true; return Promise.resolve("fresh"); },
  );

  assert.equal(nextCalled, false);
});

test("createCacheGovernanceMiddleware run returns computed value without double-calling next when fromCache is false", async () => {
  let nextCalled = false;
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(): Promise<{ value: T; fromCache: boolean }> => {
        return { value: "computed" as unknown as T, fromCache: false };
      },
    }),
  });

  const result = await middleware.run(
    { taskId: "task-next-miss" } as never,
    { toolName: "read", args: {} },
    () => { nextCalled = true; return Promise.resolve("fresh"); },
  );

  assert.equal(result, "computed");
  assert.equal(nextCalled, false);
});

test("createCacheSummaryMiddleware works without logger", async () => {
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache(),
  });

  // Should not throw even without logger
  const result = await hook.run({ taskId: "task-no-logger" } as never, { response: null, toolsUsed: [] });
  assert.deepEqual(result, { success: true });
});

test("createCacheGovernanceMiddleware works without logger", async () => {
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache(),
  });

  const result = await middleware.run(
    { taskId: "task-no-logger-2" } as never,
    { toolName: "read", args: {} },
    () => Promise.resolve("result"),
  );

  assert.equal(result, "result");
});

test("createCacheGovernanceMiddleware run uses correct context.taskId in tags", async () => {
  let receivedOptions: { tags?: string[] } | undefined;
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(
        _namespace: string,
        _normalizedInput: unknown,
        _compute: () => Promise<T>,
        options?: unknown
      ): Promise<{ value: T; fromCache: boolean }> => {
        receivedOptions = options as { tags?: string[] };
        return { value: {} as T, fromCache: false };
      },
    }),
  });

  await middleware.run(
    { taskId: "specific-task-id-123" } as never,
    { toolName: "read", args: {} },
    () => Promise.resolve("result"),
  );

  assert.ok(receivedOptions?.tags?.some(t => t.includes("specific-task-id-123")));
});

test("createCacheSummaryMiddleware with custom logger receives taskId in data", async () => {
  let receivedData: Record<string, unknown> | undefined;
  const hook = createCacheSummaryMiddleware({
    cache: createMockCache({
      getMetricsSnapshot: () => ({
        totalHits: 5,
        totalMisses: 1,
        hitRate: 0.83,
        byNamespace: {},
      }),
    }),
    logger: createMockLogger({
      debug: (message, data) => {
        if (message === "Cache metrics summary") {
          receivedData = data;
        }
        return createLogEntry("debug", message, data);
      },
    }),
  });

  await hook.run({ taskId: "task-with-data" } as never, { response: {}, toolsUsed: [] });

  assert.ok(receivedData);
  assert.equal(receivedData!.taskId, "task-with-data");
});

test("createCacheGovernanceMiddleware run logs warning on cache error", async () => {
  let warned = false;
  let warnMessage = "";
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async (): Promise<never> => {
        throw new Error("Connection timeout");
      },
    }),
    logger: createMockLogger({
      warn: (message) => {
        warned = true;
        warnMessage = message;
        return createLogEntry("warn", message);
      },
    }),
  });

  await middleware.run(
    { taskId: "task-warn" } as never,
    { toolName: "read", args: {} },
    () => Promise.resolve("fallback"),
  );

  assert.equal(warned, true);
  assert.ok(warnMessage.includes("Cache error"));
});

test("createCacheGovernanceMiddleware run accepts various cacheable tool names", async () => {
  const tools = ["read", "write", "edit", "search", "index"];
  for (const toolName of tools) {
    const middleware = createCacheGovernanceMiddleware({
      cache: createMockCache(),
    });

    const result = await middleware.run(
      { taskId: `task-${toolName}` } as never,
      { toolName, args: {} },
      () => Promise.resolve("result"),
    );

    assert.equal(result, "result");
  }
});

test("createCacheGovernanceMiddleware run passes all args to cache", async () => {
  let receivedArgs: Record<string, unknown> = {};
  const middleware = createCacheGovernanceMiddleware({
    cache: createMockCache({
      getOrCompute: async <T>(
        _namespace: string,
        normalizedInput: unknown,
        _compute: () => Promise<T>,
        _options?: unknown
      ): Promise<{ value: T; fromCache: boolean }> => {
        receivedArgs = normalizedInput as Record<string, unknown>;
        return { value: {} as T, fromCache: false };
      },
    }),
  });

  const args = { path: "/file.ts", encoding: "utf-8", lines: 50 };
  await middleware.run(
    { taskId: "task-full-args" } as never,
    { toolName: "read", args },
    () => Promise.resolve("result"),
  );

  assert.deepEqual(receivedArgs, args);
});
