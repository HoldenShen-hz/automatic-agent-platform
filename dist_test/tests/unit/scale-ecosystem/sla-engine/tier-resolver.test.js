import assert from "node:assert/strict";
import test from "node:test";
import { resolveHighestPriorityTier, SlaTierSchema } from "../../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";
test("resolveHighestPriorityTier returns highest priority tier", () => {
    const tiers = [
        { tierId: "tier-1", displayName: "Bronze", priority: 1, targetLatencyMs: 2000, targetSuccessRate: 0.95, maxQueueWaitMs: 5000, preemptionPriority: 0, reservedCapacityPercent: 0 },
        { tierId: "tier-2", displayName: "Silver", priority: 2, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 1, reservedCapacityPercent: 10 },
        { tierId: "tier-3", displayName: "Gold", priority: 3, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 1000, preemptionPriority: 2, reservedCapacityPercent: 20 },
    ];
    const result = resolveHighestPriorityTier(tiers);
    assert.equal(result?.tierId, "tier-3");
    assert.equal(result?.displayName, "Gold");
    assert.equal(result?.priority, 3);
});
test("resolveHighestPriorityTier returns null for empty array", () => {
    const result = resolveHighestPriorityTier([]);
    assert.equal(result, null);
});
test("resolveHighestPriorityTier handles single tier", () => {
    const tiers = [
        { tierId: "only", displayName: "Only", priority: 1, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 0, reservedCapacityPercent: 0 },
    ];
    const result = resolveHighestPriorityTier(tiers);
    assert.equal(result?.tierId, "only");
});
test("resolveHighestPriorityTier handles equal priorities (first wins)", () => {
    const tiers = [
        { tierId: "first", displayName: "First", priority: 5, targetLatencyMs: 1000, targetSuccessRate: 0.99, maxQueueWaitMs: 3000, preemptionPriority: 0, reservedCapacityPercent: 0 },
        { tierId: "second", displayName: "Second", priority: 5, targetLatencyMs: 500, targetSuccessRate: 0.999, maxQueueWaitMs: 1000, preemptionPriority: 1, reservedCapacityPercent: 20 },
    ];
    const result = resolveHighestPriorityTier(tiers);
    assert.equal(result?.tierId, "first");
});
test("SlaTierSchema parses valid tier", () => {
    const result = SlaTierSchema.safeParse({
        tierId: "gold",
        displayName: "Gold Tier",
        priority: 3,
        targetLatencyMs: 500,
        targetSuccessRate: 0.999,
        maxQueueWaitMs: 1000,
        preemptionPriority: 2,
        reservedCapacityPercent: 20,
    });
    assert.equal(result.success, true);
});
test("SlaTierSchema applies defaults", () => {
    const result = SlaTierSchema.safeParse({
        tierId: "basic",
        displayName: "Basic",
        priority: 0,
    });
    assert.equal(result.success, true);
    if (result.success) {
        assert.equal(result.data.targetLatencyMs, 1000);
        assert.equal(result.data.targetSuccessRate, 0.99);
        assert.equal(result.data.maxQueueWaitMs, 3000);
    }
});
test("SlaTierSchema rejects invalid tierId", () => {
    const result = SlaTierSchema.safeParse({
        tierId: "",
        displayName: "Invalid",
        priority: 0,
    });
    assert.equal(result.success, false);
});
test("SlaTierSchema rejects negative priority", () => {
    const result = SlaTierSchema.safeParse({
        tierId: "test",
        displayName: "Test",
        priority: -1,
    });
    assert.equal(result.success, false);
});
test("SlaTierSchema rejects success rate > 1", () => {
    const result = SlaTierSchema.safeParse({
        tierId: "test",
        displayName: "Test",
        priority: 0,
        targetSuccessRate: 1.5,
    });
    assert.equal(result.success, false);
});
//# sourceMappingURL=tier-resolver.test.js.map