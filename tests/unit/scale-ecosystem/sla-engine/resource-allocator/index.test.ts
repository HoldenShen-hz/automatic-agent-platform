import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateReservedCapacity,
  type ReservedCapacityAllocation,
} from "../../../../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";

test("allocateReservedCapacity calculates correct allocations", () => {
  const allocations: readonly ReservedCapacityAllocation[] = [
    { tierId: "tier1", reservedPercent: 50 },
    { tierId: "tier2", reservedPercent: 30 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  assert.equal(result["tier1"], 50);
  assert.equal(result["tier2"], 30);
});

test("allocateReservedCapacity handles zero totalUnits", () => {
  const allocations: readonly ReservedCapacityAllocation[] = [
    { tierId: "tier1", reservedPercent: 50 },
  ];

  const result = allocateReservedCapacity(0, allocations);

  assert.equal(result["tier1"], 0);
});

test("allocateReservedCapacity handles empty allocations", () => {
  const result = allocateReservedCapacity(100, []);

  assert.deepEqual(result, {});
});

test("allocateReservedCapacity floors fractional results", () => {
  const allocations: readonly ReservedCapacityAllocation[] = [
    { tierId: "tier1", reservedPercent: 33 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  // Math.floor(100 * 0.33) = Math.floor(33) = 33
  assert.equal(result["tier1"], 33);
});

test("allocateReservedCapacity handles 100 percent", () => {
  const allocations: readonly ReservedCapacityAllocation[] = [
    { tierId: "tier1", reservedPercent: 100 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  assert.equal(result["tier1"], 100);
});

test("allocateReservedCapacity handles multiple tiers", () => {
  const allocations: readonly ReservedCapacityAllocation[] = [
    { tierId: "gold", reservedPercent: 60 },
    { tierId: "silver", reservedPercent: 30 },
    { tierId: "bronze", reservedPercent: 10 },
  ];

  const result = allocateReservedCapacity(1000, allocations);

  assert.equal(result["gold"], 600);
  assert.equal(result["silver"], 300);
  assert.equal(result["bronze"], 100);
});
