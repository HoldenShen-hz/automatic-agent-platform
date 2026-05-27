import assert from "node:assert/strict";
import test from "node:test";

import {
  resolveHighestPriorityTier,
  SlaTierSchema,
  type SlaTier,
} from "../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

function createSlaTier(overrides: Partial<SlaTier> = {}): SlaTier {
  return {
    tierId: overrides.tierId ?? "standard",
    displayName: overrides.displayName ?? "Standard Tier",
    priority: overrides.priority ?? 1,
    targetLatencyMs: overrides.targetLatencyMs ?? 1000,
    targetSuccessRate: overrides.targetSuccessRate ?? 0.99,
    maxQueueWaitMs: overrides.maxQueueWaitMs ?? 3000,
    preemptionPriority: overrides.preemptionPriority ?? 0,
    reservedCapacityPercent: overrides.reservedCapacityPercent ?? 0,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// resolveHighestPriorityTier Tests
// ─────────────────────────────────────────────────────────────────────────────

test("resolveHighestPriorityTier returns tier with highest priority number [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "basic", priority: 0 }),
    createSlaTier({ tierId: "standard", priority: 2 }),
    createSlaTier({ tierId: "premium", priority: 5 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "premium");
});

test("resolveHighestPriorityTier returns null for empty array [sla-tier-resolver]", () => {
  const result = resolveHighestPriorityTier([]);

  assert.equal(result, null);
});

test("resolveHighestPriorityTier handles single tier [sla-tier-resolver]", () => {
  const tiers = [createSlaTier({ tierId: "only-tier" })];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "only-tier");
});

test("resolveHighestPriorityTier uses stable ordering for equal priority [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "first", priority: 5 }),
    createSlaTier({ tierId: "second", priority: 5 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  // Should return first matching tier (stable sort)
  assert.equal(result?.tierId, "first");
});

test("resolveHighestPriorityTier handles negative priorities [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "negative", priority: -1 }),
    createSlaTier({ tierId: "positive", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "positive");
});

test("resolveHighestPriorityTier handles zero priority [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "zero", priority: 0 }),
    createSlaTier({ tierId: "positive", priority: 1 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "positive");
});

test("resolveHighestPriorityTier handles very large priorities [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "medium", priority: 100 }),
    createSlaTier({ tierId: "huge", priority: 999999 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.equal(result?.tierId, "huge");
});

test("resolveHighestPriorityTier does not modify original array [sla-tier-resolver]", () => {
  const tiers = [
    createSlaTier({ tierId: "a", priority: 1 }),
    createSlaTier({ tierId: "b", priority: 2 }),
  ];
  const original = [...tiers];

  resolveHighestPriorityTier(tiers);

  assert.equal(tiers[0]!.tierId, original[0]!.tierId);
});

// ─────────────────────────────────────────────────────────────────────────────
// SlaTierSchema Tests
// ─────────────────────────────────────────────────────────────────────────────

test("SlaTierSchema parses valid minimal tier [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "gold",
    displayName: "Gold Tier",
    priority: 3,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.tierId, "gold");
    assert.equal(result.data.priority, 3);
    assert.equal(result.data.targetLatencyMs, 1000);
    assert.equal(result.data.targetSuccessRate, 0.99);
  }
});

test("SlaTierSchema parses full tier with all fields [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "platinum",
    displayName: "Platinum Tier",
    priority: 10,
    targetLatencyMs: 500,
    targetSuccessRate: 0.999,
    maxQueueWaitMs: 1000,
    preemptionPriority: 5,
    reservedCapacityPercent: 50,
  });

  assert.equal(result.success, true);
  if (result.success) {
    assert.equal(result.data.targetLatencyMs, 500);
    assert.equal(result.data.targetSuccessRate, 0.999);
    assert.equal(result.data.reservedCapacityPercent, 50);
  }
});

test("SlaTierSchema accepts valid priority values [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 0,
  });

  assert.equal(result.success, true);
});

test("SlaTierSchema rejects negative priority [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: -1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects empty tierId [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "",
    displayName: "Test",
    priority: 1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects empty displayName [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "",
    priority: 1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects targetSuccessRate below 0 [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetSuccessRate: -0.1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects targetSuccessRate above 1 [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetSuccessRate: 1.5,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema accepts targetSuccessRate at boundary 0 [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetSuccessRate: 0,
  });

  assert.equal(result.success, true);
});

test("SlaTierSchema accepts targetSuccessRate at boundary 1 [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    targetSuccessRate: 1,
  });

  assert.equal(result.success, true);
});

test("SlaTierSchema rejects negative maxQueueWaitMs [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    maxQueueWaitMs: -1,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects negative reservedCapacityPercent [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    reservedCapacityPercent: -10,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema rejects reservedCapacityPercent above 100 [sla-tier-resolver]", () => {
  const result = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    reservedCapacityPercent: 101,
  });

  assert.equal(result.success, false);
});

test("SlaTierSchema accepts reservedCapacityPercent at boundaries 0 and 100 [sla-tier-resolver]", () => {
  const result0 = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    reservedCapacityPercent: 0,
  });
  const result100 = SlaTierSchema.safeParse({
    tierId: "test",
    displayName: "Test",
    priority: 1,
    reservedCapacityPercent: 100,
  });

  assert.equal(result0.success, true);
  assert.equal(result100.success, true);
});