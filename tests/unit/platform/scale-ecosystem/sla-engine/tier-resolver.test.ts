import test from "node:test";
import { strict as assert } from "node:assert/strict";
import {
  resolveHighestPriorityTier,
  type SlaTier,
} from "../../../../../src/scale-ecosystem/sla-engine/tier-resolver/index.js";

function mockTier(overrides: Partial<SlaTier> = {}): SlaTier {
  return {
    tierId: "tier-1",
    displayName: "Standard",
    priority: 5,
    targetLatencyMs: 1000,
    targetSuccessRate: 0.99,
    maxQueueWaitMs: 3000,
    preemptionPriority: 0,
    reservedCapacityPercent: 0,
    ...overrides,
  };
}

test("resolveHighestPriorityTier returns highest priority tier [tier-resolver]", () => {
  const tiers = [
    mockTier({ tierId: "low", priority: 1 }),
    mockTier({ tierId: "medium", priority: 5 }),
    mockTier({ tierId: "high", priority: 10 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "high");
});

test("resolveHighestPriorityTier returns null for empty array [tier-resolver]", () => {
  const result = resolveHighestPriorityTier([]);

  assert.strictEqual(result, null);
});

test("resolveHighestPriorityTier handles single tier [tier-resolver]", () => {
  const tiers = [mockTier({ tierId: "only" })];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "only");
});

test("resolveHighestPriorityTier first highest when multiple have same priority [tier-resolver]", () => {
  const tiers = [
    mockTier({ tierId: "first", priority: 10 }),
    mockTier({ tierId: "second", priority: 10 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "first");
});

test("resolveHighestPriorityTier returns tier with highest numeric priority [tier-resolver]", () => {
  const tiers = [
    mockTier({ tierId: "zero", priority: 0 }),
    mockTier({ tierId: "five", priority: 5 }),
    mockTier({ tierId: "ten", priority: 10 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "ten");
});

test("resolveHighestPriorityTier negative priority is lowest [tier-resolver]", () => {
  const tiers = [
    mockTier({ tierId: "negative", priority: -5 }),
    mockTier({ tierId: "zero", priority: 0 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "zero");
});

test("resolveHighestPriorityTier priority of 100 is highest [tier-resolver]", () => {
  const tiers = [
    mockTier({ tierId: "hundred", priority: 100 }),
    mockTier({ tierId: "fifty", priority: 50 }),
  ];

  const result = resolveHighestPriorityTier(tiers);

  assert.strictEqual(result?.tierId, "hundred");
});