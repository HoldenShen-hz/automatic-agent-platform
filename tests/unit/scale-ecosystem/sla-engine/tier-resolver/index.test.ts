import assert from "node:assert/strict";
import test from "node:test";
import { resolveHighestPriorityTier, SlaTierSchema, type SlaTier } from "../../../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

test("resolveHighestPriorityTier returns highest priority tier [index]", () => {
  const tiers: SlaTier[] = [
    { tierId: "basic", displayName: "Basic", priority: 1 },
    { tierId: "standard", displayName: "Standard", priority: 2 },
    { tierId: "premium", displayName: "Premium", priority: 3 },
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "premium");
});

test("resolveHighestPriorityTier handles equal priorities [index]", () => {
  const tiers: SlaTier[] = [
    { tierId: "tier-a", displayName: "Tier A", priority: 5 },
    { tierId: "tier-b", displayName: "Tier B", priority: 5 },
  ];

  const result = resolveHighestPriorityTier(tiers);

  // Returns the first one encountered in sorted order
  assert.ok(result?.tierId === "tier-a" || result?.tierId === "tier-b");
});

test("resolveHighestPriorityTier returns null for empty array [index]", () => {
  const result = resolveHighestPriorityTier([]);

  assert.equal(result, null);
});

test("resolveHighestPriorityTier handles single tier [index]", () => {
  const tiers: SlaTier[] = [
    { tierId: "only", displayName: "Only", priority: 1 },
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "only");
});

test("resolveHighestPriorityTier does not mutate input [index]", () => {
  const tiers: SlaTier[] = [
    { tierId: "t1", displayName: "T1", priority: 1 },
  ];

  resolveHighestPriorityTier(tiers);

  assert.equal(tiers[0]?.priority, 1);
});

test("SlaTierSchema applies defaults [index]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "basic",
    displayName: "Basic",
    priority: 1,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.targetLatencyMs, 1000);
    assert.equal(result.data.targetSuccessRate, 0.99);
    assert.equal(result.data.maxQueueWaitMs, 3000);
    assert.equal(result.data.preemptionPriority, 0);
    assert.equal(result.data.reservedCapacityPercent, 0);
  }
});

test("SlaTierSchema enforces constraints [index]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "invalid",
    displayName: "",
    priority: -1,
  });

  assert.equal(result.success, false);
});