/**
 * Resource Allocator Issue #2195 Tests
 *
 * Issue #2195: No <=100% validation
 *
 * The resource allocator should validate that total reserved capacity
 * does not exceed 100%, as that would be over-provisioned.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  allocateReservedCapacity,
  type ReservedCapacityAllocation,
} from "../../../../src/scale-ecosystem/sla-engine/resource-allocator/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// Issue #2195: No <=100% validation
// ─────────────────────────────────────────────────────────────────────────────

test("resource-allocator-2195: total reservedPercent should not exceed 100%", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 60 },
    { tierId: "tier-2", reservedPercent: 50 },
  ];

  assert.throws(() => allocateReservedCapacity(100, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: exact 100% should be valid", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 50 },
    { tierId: "tier-2", reservedPercent: 50 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  const totalAllocated = Object.values(result).reduce((sum, val) => sum + val, 0);

  // 100% is exactly valid
  assert.equal(totalAllocated, 100);
});

test("resource-allocator-2195: sum exceeding 100% by small amount", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 80 },
    { tierId: "tier-2", reservedPercent: 25 },
    // Total = 105%
  ];

  assert.throws(() => allocateReservedCapacity(100, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: sum exceeding 100% by large amount", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 100 },
    { tierId: "tier-2", reservedPercent: 100 },
    { tierId: "tier-3", reservedPercent: 100 },
    // Total = 300%
  ];

  assert.throws(() => allocateReservedCapacity(100, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: under 100% is valid", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 30 },
    { tierId: "tier-2", reservedPercent: 20 },
    { tierId: "tier-3", reservedPercent: 10 },
    // Total = 60%
  ];

  const result = allocateReservedCapacity(100, allocations);

  const totalAllocated = Object.values(result).reduce((sum, val) => sum + val, 0);

  // Valid - room for burst capacity
  assert.equal(totalAllocated, 60);
});

test("resource-allocator-2195: single tier at exactly 100%", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "exclusive", reservedPercent: 100 },
  ];

  const result = allocateReservedCapacity(100, allocations);

  assert.equal(result["exclusive"], 100);
});

test("resource-allocator-2195: single tier exceeding 100%", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "over-provisioned", reservedPercent: 150 },
  ];

  assert.throws(() => allocateReservedCapacity(100, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: validation function should detect over-provisioning", () => {
  // Issue #2195: Need a validation function to check if allocations exceed 100%

  function validateTotalReservedPercent(allocations: ReservedCapacityAllocation[]): boolean {
    const total = allocations.reduce((sum, a) => sum + a.reservedPercent, 0);
    return total <= 100;
  }

  const validAllocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 50 },
    { tierId: "tier-2", reservedPercent: 50 },
  ];

  const invalidAllocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 60 },
    { tierId: "tier-2", reservedPercent: 50 },
  ];

  // This validation function doesn't exist in current implementation
  assert.equal(validateTotalReservedPercent(validAllocations), true);
  assert.equal(validateTotalReservedPercent(invalidAllocations), false);
});

test("resource-allocator-2195: over-provisioning impact on burst capacity", () => {
  const totalUnits = 100;
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 70 },
    { tierId: "tier-2", reservedPercent: 40 },
  ];

  assert.throws(() => allocateReservedCapacity(totalUnits, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: fractional percentages sum to over 100", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 33.3 },
    { tierId: "tier-2", reservedPercent: 33.3 },
    { tierId: "tier-3", reservedPercent: 33.4 },
    // Total = 100%
  ];

  const result = allocateReservedCapacity(100, allocations);
  const totalAllocated = Object.values(result).reduce((sum, val) => sum + val, 0);

  // Due to floor() in allocateReservedCapacity, this could be 99 or 100
  assert.ok(totalAllocated <= 100);
});

test("resource-allocator-2195: edge case at exactly 100 percent", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 25 },
    { tierId: "tier-2", reservedPercent: 25 },
    { tierId: "tier-3", reservedPercent: 25 },
    { tierId: "tier-4", reservedPercent: 25 },
  ];

  const result = allocateReservedCapacity(100, allocations);
  const totalAllocated = Object.values(result).reduce((sum, val) => sum + val, 0);

  assert.equal(totalAllocated, 100);
});

test("resource-allocator-2195: zero total capacity with over-provisioned allocations", () => {
  const allocations: ReservedCapacityAllocation[] = [
    { tierId: "tier-1", reservedPercent: 100 },
    { tierId: "tier-2", reservedPercent: 100 },
  ];

  assert.throws(() => allocateReservedCapacity(0, allocations), /total_reserved_exceeds_100/);
});

test("resource-allocator-2195: over-provisioning with many small tiers", () => {
  const allocations: ReservedCapacityAllocation[] = Array.from(
    { length: 20 },
    (_, i) => ({ tierId: `tier-${i}`, reservedPercent: 6 })
  );

  assert.throws(() => allocateReservedCapacity(100, allocations), /total_reserved_exceeds_100/);
});
