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
