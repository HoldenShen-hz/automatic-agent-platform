import assert from "node:assert/strict";
import test from "node:test";

import { allocateReservedCapacity, type ReservedCapacityAllocation } from "../../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";

test("allocateReservedCapacity calculates tier allocations [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 10 },
    { tierId: "tier-2", reservedPercent: 20 },
  ];
  const result = allocateReservedCapacity(100, allocations);
  assert.equal(result["tier-1"], 10);
  assert.equal(result["tier-2"], 20);
});

test("allocateReservedCapacity handles zero total units [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 50 },
  ];
  const result = allocateReservedCapacity(0, allocations);
  assert.equal(result["tier-1"], 0);
});

test("allocateReservedCapacity handles empty allocations [resource-allocator]", () => {
  const result = allocateReservedCapacity(100, []);
  assert.deepStrictEqual(result, {});
});

test("allocateReservedCapacity floors partial units [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 33 },
  ];
  const result = allocateReservedCapacity(100, allocations);
  // 33% of 100 = 33, floored
  assert.equal(result["tier-1"], 33);
});

test("allocateReservedCapacity handles 100 percent allocation [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 100 },
  ];
  const result = allocateReservedCapacity(250, allocations);
  assert.equal(result["tier-1"], 250);
});

test("allocateReservedCapacity handles multiple tiers [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "gold", reservedPercent: 25 },
    { tierId: "silver", reservedPercent: 15 },
    { tierId: "bronze", reservedPercent: 10 },
  ];
  const result = allocateReservedCapacity(200, allocations);
  assert.equal(result["gold"], 50);
  assert.equal(result["silver"], 30);
  assert.equal(result["bronze"], 20);
});

test("allocateReservedCapacity handles zero percent [resource-allocator]", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 0 },
  ];
  const result = allocateReservedCapacity(100, allocations);
  assert.equal(result["tier-1"], 0);
});
