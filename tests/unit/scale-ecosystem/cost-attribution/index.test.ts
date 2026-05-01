/**
 * Unit tests for scale-ecosystem/cost-attribution re-exports
 *
 * @see src/scale-ecosystem/cost-attribution/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as costAttribution from "../../../../src/scale-ecosystem/cost-attribution/index.js";

test("cost-attribution re-exports sla-engine module", () => {
  // sla-engine exports: breach-detector, resource-allocator, tier-resolver, SlaOperationsService
  assert.ok(
    "SlaOperationsService" in costAttribution,
    "should re-export SlaOperationsService from sla-engine"
  );
});

test("cost-attribution re-exports breach-detector types", () => {
  // breach-detector exports: detectSlaBreach, SlaCommitment, SlaObservation
  assert.ok(
    "detectSlaBreach" in costAttribution,
    "should re-export detectSlaBreach from sla-engine/breach-detector"
  );
});

test("cost-attribution re-exports resource-allocator types", () => {
  // resource-allocator exports: allocateReservedCapacity, ReservedCapacityAllocation
  assert.ok(
    "allocateReservedCapacity" in costAttribution,
    "should re-export allocateReservedCapacity from sla-engine/resource-allocator"
  );
});

test("cost-attribution re-exports tier-resolver types", () => {
  // tier-resolver exports: resolveHighestPriorityTier, SlaTier
  assert.ok(
    "resolveHighestPriorityTier" in costAttribution,
    "should re-export resolveHighestPriorityTier from sla-engine/tier-resolver"
  );
});

test("cost-attribution SlaOperationsService is instantiable", () => {
  const Service = costAttribution.SlaOperationsService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.evaluate, "function", "should have evaluate method");
});

test("cost-attribution detectSlaBreach is a function", () => {
  assert.strictEqual(typeof costAttribution.detectSlaBreach, "function", "should be a function");
});

test("cost-attribution allocateReservedCapacity is a function", () => {
  assert.strictEqual(typeof costAttribution.allocateReservedCapacity, "function", "should be a function");
});

test("cost-attribution resolveHighestPriorityTier is a function", () => {
  assert.strictEqual(typeof costAttribution.resolveHighestPriorityTier, "function", "should be a function");
});
