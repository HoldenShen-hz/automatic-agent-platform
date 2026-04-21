import assert from "node:assert/strict";
import test from "node:test";
import { CacheMetrics } from "../../../../../src/platform/shared/cache/cache-metrics.js";
test("CacheMetrics records hits and misses", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "test", hit: true, layer: "L1" });
    metrics.record({ namespace: "test", hit: false, reason: "not_found" });
    metrics.record({ namespace: "test", hit: true, layer: "L2" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalHits, 2);
    assert.equal(snapshot.totalMisses, 1);
    assert.equal(snapshot.byNamespace["test"].hits, 2);
    assert.equal(snapshot.byNamespace["test"].misses, 1);
});
test("CacheMetrics calculates hit rate", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "test", hit: true });
    metrics.record({ namespace: "test", hit: true });
    metrics.record({ namespace: "test", hit: false, reason: "not_found" });
    metrics.record({ namespace: "test", hit: false, reason: "expired" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.hitRate, 0.5);
    assert.equal(snapshot.byNamespace["test"].hitRate, 0.5);
});
test("CacheMetrics tracks layer distribution", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "test", hit: true, layer: "L1" });
    metrics.record({ namespace: "test", hit: true, layer: "L1" });
    metrics.record({ namespace: "test", hit: true, layer: "L2" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.byNamespace["test"].byLayer?.["L1"], 2);
    assert.equal(snapshot.byNamespace["test"].byLayer?.["L2"], 1);
});
test("CacheMetrics tracks miss reasons", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "test", hit: false, reason: "not_found" });
    metrics.record({ namespace: "test", hit: false, reason: "not_found" });
    metrics.record({ namespace: "test", hit: false, reason: "expired" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.byNamespace["test"].byReason?.["not_found"], 2);
    assert.equal(snapshot.byNamespace["test"].byReason?.["expired"], 1);
});
test("CacheMetrics.reset clears all counters", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "test", hit: true });
    metrics.record({ namespace: "other", hit: true });
    metrics.reset();
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalHits, 0);
    assert.equal(snapshot.totalMisses, 0);
    assert.deepEqual(Object.keys(snapshot.byNamespace), []);
});
test("CacheMetrics handles unknown namespace", () => {
    const metrics = new CacheMetrics();
    metrics.record({ namespace: "unknown", hit: false, reason: "not_found" });
    const snapshot = metrics.snapshot();
    assert.equal(snapshot.totalMisses, 1);
    assert.equal(snapshot.byNamespace["unknown"].misses, 1);
});
//# sourceMappingURL=cache-metrics.test.js.map