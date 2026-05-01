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
  assert.strictEqual(
    typeof sla.SlaOperationsService,
    "function",
    "SlaOperationsService should be a constructor"
  );
});

test("sla re-exports detectSlaBreach", () => {
  assert.ok(
    "detectSlaBreach" in sla,
    "should re-export detectSlaBreach from sla-engine/breach-detector"
  );
  assert.strictEqual(typeof sla.detectSlaBreach, "function", "should be a function");
});

test("sla re-exports allocateReservedCapacity", () => {
  assert.ok(
    "allocateReservedCapacity" in sla,
    "should re-export allocateReservedCapacity from sla-engine/resource-allocator"
  );
  assert.strictEqual(typeof sla.allocateReservedCapacity, "function", "should be a function");
});

test("sla re-exports resolveHighestPriorityTier", () => {
  assert.ok(
    "resolveHighestPriorityTier" in sla,
    "should re-export resolveHighestPriorityTier from sla-engine/tier-resolver"
  );
  assert.strictEqual(typeof sla.resolveHighestPriorityTier, "function", "should be a function");
});

test("sla re-exports SlaTierSchema", () => {
  assert.ok(
    "SlaTierSchema" in sla,
    "should re-export SlaTierSchema"
  );
});

test("sla re-exports calculateBurnRate", () => {
  assert.ok(
    "calculateBurnRate" in sla,
    "should re-export calculateBurnRate"
  );
  assert.strictEqual(typeof sla.calculateBurnRate, "function", "should be a function");
});

test("sla SlaOperationsService is instantiable", () => {
  const Service = sla.SlaOperationsService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.evaluate, "function", "should have evaluate method");
});
