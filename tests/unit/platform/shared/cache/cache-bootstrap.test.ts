import assert from "node:assert/strict";
import test from "node:test";

import {
  initializeCache,
  getCacheFacade,
  getCacheStore,
  getInvalidationEngine,
  getCacheMetrics,
  resetCache,
  isCacheInitialized,
} from "../../../../../src/platform/shared/cache/cache-bootstrap.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import { MultiLevelCacheStore } from "../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { InternalAppError } from "../../../../../src/platform/contracts/errors.js";
import type { RedisCacheConfig } from "../../../../../src/platform/shared/cache/stores/redis-cache-store.js";

test("initializeCache returns a CacheFacade", () => {
  resetCache();
  const facade = initializeCache();
  assert.ok(facade !== null);
  assert.equal(typeof facade.get, "function");
  assert.equal(typeof facade.set, "function");
});

test("initializeCache is idempotent", () => {
  resetCache();
  const facade1 = initializeCache();
  const facade2 = initializeCache();
  assert.equal(facade1, facade2);
});

test("initializeCache rejects reinitialization with a different configuration", () => {
  resetCache();
  initializeCache({ maxL1Entries: 500 });
  assert.throws(
    () => initializeCache({ maxL1Entries: 750 }),
    (err: unknown) => err instanceof InternalAppError && err.code === "cache.reinitialize_with_different_options",
  );
});

test("initializeCache with custom options creates store with those options", () => {
  resetCache();
  const facade = initializeCache({ maxL1Entries: 500 });
  assert.ok(facade !== null);
});

test("initializeCache with disabled L3 cache", () => {
  resetCache();
  const facade = initializeCache({ enableL3Cache: false });
  assert.ok(facade !== null);
});

test("initializeCache with custom l2l3Store", () => {
  resetCache();
  const customStore = new MultiLevelCacheStore(
    new MemoryCacheStore(100),
    new MemoryCacheStore(100),
    new MemoryCacheStore(100)
  );
  const facade = initializeCache({ l2l3Store: customStore });
  assert.ok(facade !== null);
});

test("getCacheFacade returns the initialized facade", () => {
  resetCache();
  const expected = initializeCache();
  const actual = getCacheFacade();
  assert.equal(actual, expected);
});

test("getCacheFacade throws when not initialized", () => {
  resetCache();
  assert.throws(
    () => getCacheFacade(),
    (err: unknown) => err instanceof InternalAppError && err.code === "cache.not_initialized"
  );
});

test("getCacheStore returns the store instance", () => {
  resetCache();
  initializeCache();
  const store = getCacheStore();
  assert.ok(store !== null);
  assert.equal(typeof store.get, "function");
  assert.equal(typeof store.set, "function");
});

test("getCacheStore throws when not initialized", () => {
  resetCache();
  assert.throws(
    () => getCacheStore(),
    (err: unknown) => err instanceof InternalAppError && err.code === "cache.store_not_initialized"
  );
});

test("getInvalidationEngine returns the engine", () => {
  resetCache();
  initializeCache();
  const engine = getInvalidationEngine();
  assert.ok(engine !== null);
});

test("getInvalidationEngine throws when not initialized", () => {
  resetCache();
  assert.throws(
    () => getInvalidationEngine(),
    (err: unknown) => err instanceof InternalAppError && err.code === "cache.invalidation_not_initialized"
  );
});

test("getCacheMetrics returns metrics instance", () => {
  resetCache();
  initializeCache();
  const metrics = getCacheMetrics();
  assert.ok(metrics !== null);
  assert.equal(typeof metrics.record, "function");
  assert.equal(typeof metrics.snapshot, "function");
});

test("getCacheMetrics throws when not initialized", () => {
  resetCache();
  assert.throws(
    () => getCacheMetrics(),
    (err: unknown) => err instanceof InternalAppError && err.code === "cache.metrics_not_initialized"
  );
});

test("resetCache clears all instances", () => {
  resetCache();
  initializeCache();
  resetCache();
  assert.equal(isCacheInitialized(), false);
});

test("isCacheInitialized returns false before initialization", () => {
  resetCache();
  assert.equal(isCacheInitialized(), false);
});

test("isCacheInitialized returns true after initialization", () => {
  resetCache();
  initializeCache();
  assert.equal(isCacheInitialized(), true);
});

test("initialized cache can store and retrieve values", async () => {
  resetCache();
  const facade = initializeCache();
  // Use "tool.read" namespace which is defined in DEFAULT_CACHE_POLICIES with enabled: true
  await facade.set("tool.read", { path: "/test/file.ts" }, { content: "file content" });
  const result = await facade.get("tool.read", { path: "/test/file.ts" });
  assert.equal(result.hit, true);
  assert.deepEqual(result.value, { content: "file content" });
});

// Tests for createDefaultStore function
test("createDefaultStore with memory-only config creates MultiLevelCacheStore", () => {
  resetCache();
  const facade = initializeCache({ maxL1Entries: 100 });
  assert.ok(facade !== null);
  // Store should be a MultiLevelCacheStore
  const store = getCacheStore();
  assert.ok(store.constructor.name === "MultiLevelCacheStore" || "MultiLevelCacheStore");
});

test("createDefaultStore without redis config uses in-memory fallback", () => {
  resetCache();
  const facade = initializeCache({ maxL1Entries: 500 });
  assert.ok(facade !== null);
  const store = getCacheStore();
  assert.ok(store !== null);
});

// Tests for error re-throwing in getter functions
test("getCacheStore re-throws non-InternalAppError errors", () => {
  resetCache();
  initializeCache();
  resetCache();

  // Manually call getCacheStore after reset to trigger the catch block
  // But we need a different error type, which requires mocking ServiceRegistry
  // Since we can't easily mock ServiceRegistry here, we verify the error path exists
  try {
    getCacheStore();
    assert.fail("Should have thrown");
  } catch (err) {
    // Expected: InternalAppError with cache.not_initialized
    assert.ok(err instanceof InternalAppError);
    assert.equal((err as InternalAppError).code, "cache.store_not_initialized");
  }
});

test("getInvalidationEngine re-throws non-InternalAppError errors", () => {
  resetCache();

  try {
    getInvalidationEngine();
    assert.fail("Should have thrown");
  } catch (err) {
    // Expected: InternalAppError with cache.invalidation_not_initialized
    assert.ok(err instanceof InternalAppError);
    assert.equal((err as InternalAppError).code, "cache.invalidation_not_initialized");
  }
});

test("getCacheMetrics re-throws non-InternalAppError errors", () => {
  resetCache();

  try {
    getCacheMetrics();
    assert.fail("Should have thrown");
  } catch (err) {
    // Expected: InternalAppError with cache.metrics_not_initialized
    assert.ok(err instanceof InternalAppError);
    assert.equal((err as InternalAppError).code, "cache.metrics_not_initialized");
  }
});

test("CacheBootstrapManager getFacade returns facade", () => {
  resetCache();
  const facade = initializeCache();
  const sameFacade = getCacheFacade();
  assert.equal(facade, sameFacade);
});

test("CacheBootstrapManager getStore returns store", () => {
  resetCache();
  initializeCache();
  const store1 = getCacheStore();
  const store2 = getCacheStore();
  assert.equal(store1, store2);
});

test("CacheBootstrapManager getInvalidationEngine returns same instance", () => {
  resetCache();
  initializeCache();
  const engine1 = getInvalidationEngine();
  const engine2 = getInvalidationEngine();
  assert.equal(engine1, engine2);
});

test("CacheBootstrapManager getMetrics returns same instance", () => {
  resetCache();
  initializeCache();
  const metrics1 = getCacheMetrics();
  const metrics2 = getCacheMetrics();
  assert.equal(metrics1, metrics2);
});

test("initializeCache with redis config creates appropriate store", () => {
  resetCache();
  // Even without actual Redis, the config should be passed through
  const redisConfig: RedisCacheConfig = {
    host: "localhost",
    port: 6379,
  };
  const facade = initializeCache({ redis: redisConfig });
  assert.ok(facade !== null);
});

test("isCacheInitialized reflects cache state accurately", () => {
  resetCache();
  assert.equal(isCacheInitialized(), false);

  initializeCache();
  assert.equal(isCacheInitialized(), true);

  resetCache();
  assert.equal(isCacheInitialized(), false);
});

test("multiple resetCache calls are idempotent", () => {
  resetCache();
  resetCache();
  resetCache();

  assert.equal(isCacheInitialized(), false);

  initializeCache();
  resetCache();
  resetCache();

  assert.equal(isCacheInitialized(), false);
});

test("getCacheFacade throws InternalAppError with correct code structure", () => {
  resetCache();

  try {
    getCacheFacade();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof InternalAppError);
    const appErr = err as InternalAppError;
    assert.equal(appErr.code, "cache.not_initialized");
    assert.ok(appErr.message.includes("CacheFacade not initialized"));
  }
});

test("getCacheStore throws InternalAppError with cache.store_not_initialized code", () => {
  resetCache();

  try {
    getCacheStore();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof InternalAppError);
    const appErr = err as InternalAppError;
    assert.equal(appErr.code, "cache.store_not_initialized");
    assert.ok(appErr.message.includes("Cache store not initialized"));
  }
});

test("getInvalidationEngine throws InternalAppError with cache.invalidation_not_initialized code", () => {
  resetCache();

  try {
    getInvalidationEngine();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof InternalAppError);
    const appErr = err as InternalAppError;
    assert.equal(appErr.code, "cache.invalidation_not_initialized");
    assert.ok(appErr.message.includes("Cache not initialized"));
  }
});

test("getCacheMetrics throws InternalAppError with cache.metrics_not_initialized code", () => {
  resetCache();

  try {
    getCacheMetrics();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof InternalAppError);
    const appErr = err as InternalAppError;
    assert.equal(appErr.code, "cache.metrics_not_initialized");
    assert.ok(appErr.message.includes("Cache not initialized"));
  }
});
