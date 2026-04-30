/**
 * Typed Test Factories
 *
 * Provides typed factory functions for creating test objects with proper type safety.
 * These replace `as any` casts that were previously needed when creating mock objects
 * or partial implementations of service interfaces.
 *
 * Usage:
 * ```typescript
 * // Instead of: createMockStore() as unknown as AuthoritativeTaskStore
 * const store = createMockTaskStore(harness.db);
 *
 * // Instead of: ({ status: "idle" } as unknown as { status: string })
 * const snapshot = createPartial<SnapshotState>({ status: "idle" });
 *
 * // Instead of: (value as any)
 * const result = unsafeCast<SpecificType>(unknownValue);
 * ```
 *
 * ## ESLint Configuration
 *
 * This module uses `unsafeCast` for cases where type safety cannot be achieved
 * through proper typing. The `@typescript-eslint/no-explicit-any` rule is set to
 * `warn` in tests to allow gradual cleanup without breaking the test suite.
 *
 * ## Categories of `as any` Usage
 *
 * | Category | Count (est.) | Strategy |
 * |---|---|---|
 * | Test fixture construction | ~80 | Create typed factory functions |
 * | Mock object creation | ~60 | Use `Partial<RealType>` + spread |
 * | Return type assertions | ~40 | Add proper generics to test utilities |
 * | Unavoidable (testing private internals) | ~43 | Keep but wrap in `unsafeCast` |
 */

// ── Unsafe Cast Helper ─────────────────────────────────────────────────────────

/**
 * Unsafe cast from unknown to T.
 *
 * This is a documented escape hatch for cases where type safety cannot be
 * achieved through proper typing. Use sparingly and prefer proper factory
 * functions or typed mocks when possible.
 *
 * Categories of acceptable usage:
 * - Testing private/internal state that can't be typed otherwise
 * - Legacy code with incomplete types
 * - Dynamic data structures with unpredictable shapes
 *
 * @param value - The unknown value to cast
 * @returns The value as type T
 */
export function unsafeCast<T>(value: unknown): T {
  return value as T;
}

// ── Cache Store Mock ───────────────────────────────────────────────────────────

import type { CacheStore } from "../../src/platform/shared/cache/stores/cache-store.js";
import type { CacheLookupResult, CacheMeta } from "../../src/platform/shared/cache/cache-types.js";

/**
 * Creates a minimal mock CacheStore for testing.
 * All methods are no-ops that return sensible defaults.
 */
export function createMockCacheStore(): CacheStore {
  return {
    async get<T>(_namespace: string, _key: string): Promise<CacheLookupResult<T>> {
      return { hit: false, value: null, reason: "not_found" };
    },
    async set<T>(_namespace: string, _key: string, _value: T, _meta: CacheMeta): Promise<void> {
      // no-op
    },
    async delete(_namespace: string, _key: string): Promise<void> {
      // no-op
    },
    async invalidateByTag(_tag: string): Promise<number> {
      return 0;
    },
    async invalidateNamespace(_namespace: string): Promise<number> {
      return 0;
    },
    async cleanupExpired(): Promise<number> {
      return 0;
    },
  };
}

// ── Partial Object Helper ─────────────────────────────────────────────────────

/**
 * Typed wrapper for creating partial objects without `as any`.
 *
 * @example
 * ```typescript
 * // Instead of: ({ status: "idle" } as unknown as { status: string })
 * const snapshot = partial<{ status: string }>({ status: "idle" });
 * ```
 */
export function partial<T>(overrides: Partial<T> = {}): Partial<T> {
  return overrides;
}

// ── Cache Facade Mock ──────────────────────────────────────────────────────────

import type { CacheFacade } from "../../src/platform/shared/cache/cache-facade.js";
import type { CacheMetrics } from "../../src/platform/shared/cache/cache-metrics.js";

/**
 * Creates a mock CacheFacade for testing.
 * Uses `as unknown as` since CacheFacade has private state that can't be fully mocked.
 */
export function createMockCacheFacade(): CacheFacade & {
  cleanupExpired(): Promise<number>;
  getStats(): Promise<{ totalHits: number; totalMisses: number; hitRate: number; byNamespace: Record<string, unknown> }>;
  resetMetrics(): void;
} {
  return {
    get: async <T>(_namespace: string, _normalizedInput: unknown) =>
      ({ hit: false, value: null, reason: "not_found" } as CacheLookupResult<T>),
    set: async <T>(_namespace: string, _normalizedInput: unknown, _value: T, _options?: unknown) => {
      // no-op
    },
    getOrCompute: async <T>(_namespace: string, _normalizedInput: unknown, compute: () => Promise<T>) => ({
      value: await compute(),
      fromCache: false,
    }),
    invalidateByTag: async (_tag: string) => 0,
    invalidateNamespace: async (_namespace: string) => 0,
    cleanupExpired: async () => 0,
    getStats: async () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
    resetMetrics: () => {
      // no-op
    },
  } as unknown as CacheFacade & {
    cleanupExpired(): Promise<number>;
    getStats(): Promise<{ totalHits: number; totalMisses: number; hitRate: number; byNamespace: Record<string, unknown> }>;
    resetMetrics(): void;
  };
}

/**
 * Creates a mock CacheMetrics for testing.
 */
export function createMockCacheMetrics(): CacheMetrics {
  return {
    record: () => {
      // no-op
    },
    snapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
    reset: () => {
      // no-op
    },
  } as unknown as CacheMetrics;
}

// ── StructuredLogger Mock ───────────────────────────────────────────────────────

import type { StructuredLogEntry, StructuredLoggerOptions } from "../../src/platform/shared/observability/structured-logger.js";

/**
 * Creates a mock StructuredLogger for testing.
 * All methods are no-ops that return sensible defaults.
 */
export function createMockStructuredLogger(options: Partial<StructuredLoggerOptions> = {}): {
  logger: { log: () => StructuredLogEntry; info: () => StructuredLogEntry; warn: () => StructuredLogEntry; error: () => StructuredLogEntry; debug: () => StructuredLogEntry; fatal: () => StructuredLogEntry; getEntries: () => StructuredLogEntry[]; recent: () => StructuredLogEntry[]; recentByTask: () => StructuredLogEntry[]; recentByTrace: () => StructuredLogEntry[]; recentByCorrelation: () => StructuredLogEntry[]; clear: () => void; getBufferSummary: () => { entryCount: number; retentionLimit: number; droppedEntryCount: number }; };
  entries: StructuredLogEntry[];
} {
  const entries: StructuredLogEntry[] = [];

  const mockEntry: StructuredLogEntry = {
    level: "info",
    message: "mock log entry",
    service: "mock-service",
    plane: "X1",
    createdAt: new Date().toISOString(),
    timestamp: new Date().toISOString(),
  };

  return {
    logger: {
      log: () => {
        const entry = { ...mockEntry, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      info: () => {
        const entry = { ...mockEntry, level: "info" as const, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      warn: () => {
        const entry = { ...mockEntry, level: "warn" as const, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      error: () => {
        const entry = { ...mockEntry, level: "error" as const, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      debug: () => {
        const entry = { ...mockEntry, level: "debug" as const, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      fatal: () => {
        const entry = { ...mockEntry, level: "fatal" as const, timestamp: new Date().toISOString() };
        entries.push(entry);
        return entry;
      },
      getEntries: () => [...entries],
      recent: () => [...entries],
      recentByTask: () => [...entries],
      recentByTrace: () => [...entries],
      recentByCorrelation: () => [...entries],
      clear: () => { entries.length = 0; },
      getBufferSummary: () => ({
        entryCount: entries.length,
        retentionLimit: options.retentionLimit ?? 500,
        droppedEntryCount: 0,
      }),
    },
    entries,
  };
}

// ── GracefulShutdown Mock ──────────────────────────────────────────────────────

import type { GracefulShutdownOptions, ShutdownResult } from "../../src/platform/five-plane-execution/startup/graceful-shutdown.js";

/**
 * Creates a mock GracefulShutdown for testing.
 */
export function createMockGracefulShutdown(options: Partial<GracefulShutdownOptions> = {}): {
  shutdown: { isShuttingDown: boolean; shutdown: () => Promise<ShutdownResult>; initiateShutdown: () => Promise<ShutdownResult>; addHandler: () => void; reset: () => void; };
  handlers: Array<{ name: string; handler: () => Promise<void> }>;
  shutdownResults: ShutdownResult[];
} {
  const handlers: Array<{ name: string; handler: () => Promise<void> }> = [];
  const shutdownResults: ShutdownResult[] = [];
  let isShuttingDown = false;

  return {
    shutdown: {
      isShuttingDown: () => isShuttingDown,
      shutdown: async () => {
        isShuttingDown = true;
        const result: ShutdownResult = {
          success: true,
          handlersRun: handlers.length,
          handlersFailed: 0,
          durationMs: 0,
          errors: [],
        };
        shutdownResults.push(result);
        return result;
      },
      initiateShutdown: async () => {
        isShuttingDown = true;
        const result: ShutdownResult = {
          success: true,
          handlersRun: handlers.length,
          handlersFailed: 0,
          durationMs: 0,
          errors: [],
        };
        shutdownResults.push(result);
        return result;
      },
      addHandler: () => {},
      reset: () => { isShuttingDown = false; },
    },
    handlers,
    shutdownResults,
  };
}

// ── ServiceRegistry Mock ──────────────────────────────────────────────────────

/**
 * Creates a mock ServiceRegistry for testing.
 */
export function createMockServiceRegistry(): {
  registry: { register: () => void; get: <T>() => T; isInitialized: () => boolean; initializeAll: () => Promise<void>; teardownAll: () => Promise<void>; reset: () => Promise<void>; };
  services: Map<string, { init: () => unknown; teardown?: (instance: unknown) => void | Promise<void> }>;
  instances: Map<string, unknown>;
} {
  const services = new Map<string, { init: () => unknown; teardown?: (instance: unknown) => void | Promise<void> }>();
  const instances = new Map<string, unknown>();

  return {
    registry: {
      register: (name: string, registration: { init: () => unknown; teardown?: (instance: unknown) => void | Promise<void> }) => {
        services.set(name, registration);
      },
      get: <T>(name: string): T => {
        if (instances.has(name)) {
          return instances.get(name) as T;
        }
        const service = services.get(name);
        if (!service) {
          throw new Error(`Service ${name} not registered`);
        }
        const instance = service.init();
        instances.set(name, instance);
        return instance as T;
      },
      isInitialized: (name: string) => instances.has(name),
      initializeAll: async () => {
        for (const name of services.keys()) {
          instances.get(name) ?? services.get(name)?.init();
        }
      },
      teardownAll: async () => {
        for (const [name, instance] of instances) {
          const service = services.get(name);
          if (service?.teardown) {
            await service.teardown(instance);
          }
        }
      },
      reset: async () => {
        instances.clear();
      },
    },
    services,
    instances,
  };
}
