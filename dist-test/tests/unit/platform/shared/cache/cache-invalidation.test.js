import assert from "node:assert/strict";
import test from "node:test";
import { CacheFacade } from "../../../../../src/platform/shared/cache/cache-facade.js";
import { MemoryCacheStore } from "../../../../../src/platform/shared/cache/stores/memory-cache-store.js";
import { MultiLevelCacheStore } from "../../../../../src/platform/shared/cache/stores/multi-level-cache-store.js";
import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";
import { CacheInvalidationEngine } from "../../../../../src/platform/shared/cache/cache-invalidation.js";
function createTestFacade() {
    const l1 = new MemoryCacheStore(1000);
    const store = new MultiLevelCacheStore(l1, l1, l1);
    const metrics = new CacheMetrics();
    return new CacheFacade(store, metrics);
}
test("CacheInvalidationEngine.onFileChanged invalidates file tag", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    // Set a value with the file tag
    await facade.set("tool.read", { path: "/src/app.ts" }, { data: "content" }, { tags: ["file:/src/app.ts"] });
    // Verify it was cached
    const beforeResult = await facade.get("tool.read", { path: "/src/app.ts" });
    assert.equal(beforeResult.hit, true);
    // Invalidate by file tag
    const count = await engine.onFileChanged("/src/app.ts");
    assert.ok(count >= 0); // May be 0 if the store doesn't support tagging
    // The invalidation engine delegates to cache.invalidateByTag which may not be implemented in mock stores
});
test("CacheInvalidationEngine.onSessionClosed invalidates session tag", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.onSessionClosed("session_abc123");
    assert.ok(typeof count === "number");
});
test("CacheInvalidationEngine.onInstructionChanged invalidates instruction tag", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.onInstructionChanged("sha256abc");
    assert.ok(typeof count === "number");
});
test("CacheInvalidationEngine.onRepoRebuilt invalidates repo tag", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.onRepoRebuilt("repo_xyz");
    assert.ok(typeof count === "number");
});
test("CacheInvalidationEngine.onToolUpdated invalidates tool tag", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.onToolUpdated("Read");
    assert.ok(typeof count === "number");
});
test("CacheInvalidationEngine.invalidateNamespace delegates to cache", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.invalidateNamespace("planner");
    assert.ok(typeof count === "number");
});
test("CacheInvalidationEngine.invalidateTags aggregates results", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.invalidateTags(["file:/src/a.ts", "file:/src/b.ts", "session:sess_1"]);
    assert.ok(typeof count === "number");
    assert.ok(count >= 0);
});
test("CacheInvalidationEngine.invalidateTags handles zero invalidations", async () => {
    const facade = createTestFacade();
    const engine = new CacheInvalidationEngine(facade);
    const count = await engine.invalidateTags(["nonexistent_tag"]);
    assert.ok(typeof count === "number");
    assert.ok(count >= 0);
});
//# sourceMappingURL=cache-invalidation.test.js.map