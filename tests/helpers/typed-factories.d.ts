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
export declare function unsafeCast<T>(value: unknown): T;
import type { CacheStore } from "../../src/platform/shared/cache/stores/cache-store.js";
/**
 * Creates a minimal mock CacheStore for testing.
 * All methods are no-ops that return sensible defaults.
 */
export declare function createMockCacheStore(): CacheStore;
/**
 * Typed wrapper for creating partial objects without `as any`.
 *
 * @example
 * ```typescript
 * // Instead of: ({ status: "idle" } as unknown as { status: string })
 * const snapshot = partial<{ status: string }>({ status: "idle" });
 * ```
 */
export declare function partial<T>(overrides?: Partial<T>): Partial<T>;
import type { CacheFacade } from "../../src/platform/shared/cache/cache-facade.js";
import type { CacheMetrics } from "../../src/platform/shared/cache/cache-metrics.js";
/**
 * Creates a mock CacheFacade for testing.
 * Uses `as unknown as` since CacheFacade has private state that can't be fully mocked.
 */
export declare function createMockCacheFacade(): CacheFacade & {
    cleanupExpired(): Promise<number>;
    getStats(): Promise<{
        totalHits: number;
        totalMisses: number;
        hitRate: number;
        byNamespace: Record<string, unknown>;
    }>;
    resetMetrics(): void;
};
/**
 * Creates a mock CacheMetrics for testing.
 */
export declare function createMockCacheMetrics(): CacheMetrics;
