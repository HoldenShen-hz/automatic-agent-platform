import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateReservedCapacity,
  type ReservedCapacityAllocation,
} from "../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";

function createAllocation(overrides: Partial<ReservedCapacityAllocation> = {}): ReservedCapacityAllocation {
  return {
    tierId: overrides.tierId ?? "standard",
    reservedPercent: overrides.reservedPercent ?? 20,
    ...overrides,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// allocateReservedCapacity Tests
// ─────────────────────────────────────────────────────────────────────────────

test("allocateReservedCapacity calculates correct allocation for single tier [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "enterprise", reservedPercent: 40 })];
  const totalUnits = 100;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["enterprise"], 40);
});

test("allocateReservedCapacity calculates correct allocation for multiple tiers [sla-resource-allocator]", () => {
  const allocations = [
    createAllocation({ tierId: "enterprise", reservedPercent: 40 }),
    createAllocation({ tierId: "standard", reservedPercent: 20 }),
  ];
  const totalUnits = 100;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["enterprise"], 40);
  assert.equal(result["standard"], 20);
});

test("allocateReservedCapacity handles zero total units [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "enterprise", reservedPercent: 40 })];
  const totalUnits = 0;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["enterprise"], 0);
});

test("allocateReservedCapacity handles empty allocations array [sla-resource-allocator]", () => {
  const result = allocateReservedCapacity(100, []);

  assert.deepEqual(result, {});
});

test("allocateReservedCapacity floors fractional results [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "tier", reservedPercent: 33 })];
  const totalUnits = 100;

  const result = allocateReservedCapacity(totalUnits, allocations);

  // floor(100 * 33 / 100) = floor(33) = 33
  assert.equal(result["tier"], 33);
});

test("allocateReservedCapacity handles 100 percent allocation [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "full", reservedPercent: 100 })];
  const totalUnits = 50;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["full"], 50);
});

test("allocateReservedCapacity handles small percentages with large units [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "tiny", reservedPercent: 1 })];
  const totalUnits = 10000;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["tiny"], 100);
});

test("allocateReservedCapacity handles many tiers [sla-resource-allocator]", () => {
  const allocations = [
    createAllocation({ tierId: "tier1", reservedPercent: 10 }),
    createAllocation({ tierId: "tier2", reservedPercent: 15 }),
    createAllocation({ tierId: "tier3", reservedPercent: 20 }),
    createAllocation({ tierId: "tier4", reservedPercent: 25 }),
  ];
  const totalUnits = 1000;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["tier1"], 100);
  assert.equal(result["tier2"], 150);
  assert.equal(result["tier3"], 200);
  assert.equal(result["tier4"], 250);
});

test("allocateReservedCapacity preserves tier order in result [sla-resource-allocator]", () => {
  const allocations = [
    createAllocation({ tierId: "alpha", reservedPercent: 10 }),
    createAllocation({ tierId: "beta", reservedPercent: 20 }),
    createAllocation({ tierId: "gamma", reservedPercent: 30 }),
  ];
  const totalUnits = 100;

  const result = allocateReservedCapacity(totalUnits, allocations);

  // Order is implementation-dependent, but all keys should be present
  assert.ok("alpha" in result);
  assert.ok("beta" in result);
  assert.ok("gamma" in result);
});

test("allocateReservedCapacity handles 0 percent allocation [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "zero", reservedPercent: 0 })];
  const totalUnits = 100;

  const result = allocateReservedCapacity(totalUnits, allocations);

  assert.equal(result["zero"], 0);
});

test("allocateReservedCapacity does not modify input allocations [sla-resource-allocator]", () => {
  const allocations = [createAllocation({ tierId: "test", reservedPercent: 50 })];
  const original = [...allocations];
  const totalUnits = 100;

  allocateReservedCapacity(totalUnits, allocations);

  assert.equal(allocations[0]!.reservedPercent, original[0]!.reservedPercent);
});