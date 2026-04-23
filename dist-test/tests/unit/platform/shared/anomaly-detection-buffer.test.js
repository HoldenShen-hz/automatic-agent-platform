import test from "node:test";
import assert from "node:assert/strict";
import { AnomalyDetectionService } from "../../../../src/platform/shared/observability/anomaly-detection-service.js";
import { BoundedCache } from "../../../../src/platform/shared/utils/bounded-cache.js";
test("[SYS-PERF-3.4] AnomalyDetectionService uses BoundedCache for history (not unbounded Map)", () => {
    const service = new AnomalyDetectionService();
    const history = service.history;
    assert.ok(history instanceof BoundedCache, "History should use BoundedCache");
    assert.ok(history.size <= 100, "History BoundedCache should have max 100 entries");
});
test("[SYS-PERF-3.4] BoundedCache evicts oldest when at capacity", () => {
    const cache = new BoundedCache(3);
    cache.set("a", 1);
    cache.set("b", 2);
    cache.set("c", 3);
    assert.equal(cache.size, 3, "Cache should have 3 entries");
    cache.set("d", 4);
    assert.equal(cache.size, 3, "Cache should still have 3 entries after eviction");
    assert.equal(cache.get("a"), undefined, "Oldest entry 'a' should be evicted");
    assert.equal(cache.get("d"), 4, "New entry 'd' should be present");
    assert.equal(cache.get("b"), 2, "Entry 'b' should still be present");
    assert.equal(cache.get("c"), 3, "Entry 'c' should still be present");
});
test("[SYS-PERF-3.4] BoundedCache prevents unbounded memory growth", () => {
    const cache = new BoundedCache(100);
    for (let i = 0; i < 100_000; i++) {
        cache.set(`key-${i}`, i);
    }
    assert.equal(cache.size, 100, "Cache should be bounded to max entries");
    assert.ok(cache.get("key-0") === undefined, "Oldest entries should be evicted");
    assert.ok(cache.get("key-99999") !== undefined, "Newest entries should be present");
});
//# sourceMappingURL=anomaly-detection-buffer.test.js.map