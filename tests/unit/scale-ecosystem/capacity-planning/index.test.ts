/**
 * Unit tests for scale-ecosystem/capacity-planning re-exports
 *
 * @see src/scale-ecosystem/capacity-planning/index.ts
 *
 * Note: Type-only exports (CapacitySignal, CapacityForecast, etc.) are not
 * visible at runtime. Only runtime exports (classes, functions, values) can be tested.
 */

import assert from "node:assert/strict";
import test from "node:test";
import * as capacityPlanning from "../../../../src/scale-ecosystem/capacity-planning/index.js";

test("capacity-planning re-exports CapacityPlanningService", () => {
  assert.ok(
    "CapacityPlanningService" in capacityPlanning,
    "should export CapacityPlanningService"
  );
  assert.strictEqual(
    typeof capacityPlanning.CapacityPlanningService,
    "function",
    "CapacityPlanningService should be a constructor"
  );
});

test("capacity-planning CapacityPlanningService is instantiable", () => {
  const Service = capacityPlanning.CapacityPlanningService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.recordSignal, "function", "should have recordSignal method");
  assert.strictEqual(typeof instance.forecast, "function", "should have forecast method");
  assert.strictEqual(typeof instance.compareScenarios, "function", "should have compareScenarios method");
  assert.strictEqual(typeof instance.buildRecommendation, "function", "should have buildRecommendation method");
  assert.strictEqual(typeof instance.compareForecastToActual, "function", "should have compareForecastToActual method");
});

test("capacity-planning has only one runtime export", () => {
  // Type-only exports are not visible at runtime
  const keys = Object.keys(capacityPlanning);
  assert.deepEqual(keys, ["CapacityPlanningService"], "should only have CapacityPlanningService as runtime export");
});
