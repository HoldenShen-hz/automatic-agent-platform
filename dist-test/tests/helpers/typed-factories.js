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
export function unsafeCast(value) {
    return value;
}
/**
 * Creates a minimal mock CacheStore for testing.
 * All methods are no-ops that return sensible defaults.
 */
export function createMockCacheStore() {
    return {
        async get(_namespace, _key) {
            return { hit: false, value: null, reason: "not_found" };
        },
        async set(_namespace, _key, _value, _meta) {
            // no-op
        },
        async delete(_namespace, _key) {
            // no-op
        },
        async invalidateByTag(_tag) {
            return 0;
        },
        async invalidateNamespace(_namespace) {
            return 0;
        },
        async cleanupExpired() {
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
export function partial(overrides = {}) {
    return overrides;
}
/**
 * Creates a mock CacheFacade for testing.
 * Uses `as unknown as` since CacheFacade has private state that can't be fully mocked.
 */
export function createMockCacheFacade() {
    return {
        get: async (_namespace, _normalizedInput) => ({ hit: false, value: null, reason: "not_found" }),
        set: async (_namespace, _normalizedInput, _value, _options) => {
            // no-op
        },
        invalidateByTag: async (_tag) => 0,
        invalidateNamespace: async (_namespace) => 0,
        cleanupExpired: async () => 0,
        getStats: async () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
        resetMetrics: () => {
            // no-op
        },
    };
}
/**
 * Creates a mock CacheMetrics for testing.
 */
export function createMockCacheMetrics() {
    return {
        record: () => {
            // no-op
        },
        snapshot: () => ({ totalHits: 0, totalMisses: 0, hitRate: 0, byNamespace: {} }),
        reset: () => {
            // no-op
        },
    };
}
//# sourceMappingURL=typed-factories.js.map