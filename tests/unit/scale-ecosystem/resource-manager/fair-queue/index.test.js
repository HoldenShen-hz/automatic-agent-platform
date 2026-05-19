import assert from "node:assert/strict";
import test from "node:test";
import { orderFairQueue } from "../../../../../src/scale-ecosystem/resource-manager/fair-queue/index.js";
test("orderFairQueue sorts by priority and age score", () => {
    const items = [
        { itemId: "a", tenantId: "t1", priority: 1, ageMs: 0 },
        { itemId: "b", tenantId: "t1", priority: 3, ageMs: 0 },
        { itemId: "c", tenantId: "t2", priority: 2, ageMs: 120_000 },
    ];
    const sorted = orderFairQueue(items);
    // Priority 3 with 0 age score = 30, Priority 2 with age score 1 = 21, Priority 1 with 0 = 10
    assert.equal(sorted[0]?.itemId, "b");
    assert.equal(sorted[1]?.itemId, "c");
    assert.equal(sorted[2]?.itemId, "a");
});
test("orderFairQueue respects age scoring capped at 9", () => {
    const items = [
        { itemId: "old", tenantId: "t1", priority: 1, ageMs: 600_000 }, // 10 + 9 = 19
        { itemId: "new", tenantId: "t1", priority: 2, ageMs: 0 }, // 20 + 0 = 20
    ];
    const sorted = orderFairQueue(items);
    assert.equal(sorted[0]?.itemId, "new"); // 20 > 19
});
test("orderFairQueue handles empty array", () => {
    const sorted = orderFairQueue([]);
    assert.deepEqual(sorted, []);
});
test("orderFairQueue handles single item", () => {
    const items = [
        { itemId: "only", tenantId: "t1", priority: 5, ageMs: 1000 },
    ];
    const sorted = orderFairQueue(items);
    assert.equal(sorted.length, 1);
    assert.equal(sorted[0]?.itemId, "only");
});
test("orderFairQueue does not mutate original array", () => {
    const items = [
        { itemId: "a", tenantId: "t1", priority: 1, ageMs: 0 },
    ];
    orderFairQueue(items);
    assert.equal(items[0]?.itemId, "a");
});
//# sourceMappingURL=index.test.js.map