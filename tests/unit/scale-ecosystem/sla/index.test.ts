/**
 * Unit tests for scale-ecosystem/sla re-exports
 *
 * @see src/scale-ecosystem/sla/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as sla from "../../../../src/scale-ecosystem/sla/index.js";

test("sla re-exports SlaOperationsService", () => {
  assert.ok(
    "SlaOperationsService" in sla,
    "should re-export SlaOperationsService from sla-engine"
  );
});

test("sla re-exports breach-detector types", () => {
  // breach-detector exports: detectSlaBreach, SlaCommitment, SlaObservation
  assert.ok(
    "detectSlaBreach" in sla,
    "should re-export detectSlaBreach from sla-engine/breach-detector"
  );
});

test("sla re-exports resource-allocator types", () => {
  // resource-allocator exports: allocateReservedCapacity, ReservedCapacityAllocation
  assert.ok(
    "allocateReservedCapacity" in sla,
    "should re-export allocateReservedCapacity from sla-engine/resource-allocator"
  );
});

test("sla re-exports tier-resolver types", () => {
  // tier-resolver exports: resolveHighestPriorityTier, SlaTier
  assert.ok(
    "resolveHighestPriorityTier" in sla,
    "should re-export resolveHighestPriorityTier from sla-engine/tier-resolver"
  );
});

test("sla SlaOperationsService is instantiable", () => {
  const Service = sla.SlaOperationsService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.evaluate, "function", "should have evaluate method");
});

test("sla detectSlaBreach is a function", () => {
  assert.strictEqual(typeof sla.detectSlaBreach, "function", "should be a function");
});

test("sla allocateReservedCapacity is a function", () => {
  assert.strictEqual(typeof sla.allocateReservedCapacity, "function", "should be a function");
});

test("sla resolveHighestPriorityTier is a function", () => {
  assert.strictEqual(typeof sla.resolveHighestPriorityTier, "function", "should be a function");
});
