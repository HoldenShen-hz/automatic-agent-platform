/**
 * Unit tests for scale-ecosystem/capacity-planning re-exports
 *
 * @see src/scale-ecosystem/capacity-planning/index.ts
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

test("capacity-planning re-exports CostOptimizationService", () => {
  assert.ok(
    "CostOptimizationService" in capacityPlanning,
    "should export CostOptimizationService"
  );
  assert.strictEqual(
    typeof capacityPlanning.CostOptimizationService,
    "function",
    "CostOptimizationService should be a constructor"
  );
});

test("capacity-planning re-exports CapacitySignal type", () => {
  assert.ok(
    "CapacitySignal" in capacityPlanning,
    "should export CapacitySignal type"
  );
});

test("capacity-planning re-exports CapacityForecast type", () => {
  assert.ok(
    "CapacityForecast" in capacityPlanning,
    "should export CapacityForecast type"
  );
});

test("capacity-planning re-exports CapacityScenario type", () => {
  assert.ok(
    "CapacityScenario" in capacityPlanning,
    "should export CapacityScenario type"
  );
});

test("capacity-planning re-exports CapacityRecommendation type", () => {
  assert.ok(
    "CapacityRecommendation" in capacityPlanning,
    "should export CapacityRecommendation type"
  );
});

test("capacity-planning re-exports CapacityForecastActualComparison type", () => {
  assert.ok(
    "CapacityForecastActualComparison" in capacityPlanning,
    "should export CapacityForecastActualComparison type"
  );
});

test("capacity-planning re-exports CostAttributionRecord type", () => {
  assert.ok(
    "CostAttributionRecord" in capacityPlanning,
    "should export CostAttributionRecord type"
  );
});

test("capacity-planning re-exports CostSimulationScenarioInput type", () => {
  assert.ok(
    "CostSimulationScenarioInput" in capacityPlanning,
    "should export CostSimulationScenarioInput type"
  );
});

test("capacity-planning re-exports CostDashboardSlice type", () => {
  assert.ok(
    "CostDashboardSlice" in capacityPlanning,
    "should export CostDashboardSlice type"
  );
});

test("capacity-planning re-exports CostSimulationResult type", () => {
  assert.ok(
    "CostSimulationResult" in capacityPlanning,
    "should export CostSimulationResult type"
  );
});

test("capacity-planning re-exports sla-engine module members", () => {
  // sla-engine exports: breach-detector, resource-allocator, tier-resolver, SlaOperationsService
  assert.ok(
    "SlaOperationsService" in capacityPlanning,
    "should re-export SlaOperationsService from sla-engine"
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
});

test("capacity-planning CostOptimizationService is instantiable", () => {
  const Service = capacityPlanning.CostOptimizationService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.recordCost, "function", "should have recordCost method");
  assert.strictEqual(typeof instance.aggregate, "function", "should have aggregate method");
  assert.strictEqual(typeof instance.buildRecommendations, "function", "should have buildRecommendations method");
  assert.strictEqual(typeof instance.simulate, "function", "should have simulate method");
  assert.strictEqual(typeof instance.buildDashboardSlice, "function", "should have buildDashboardSlice method");
});

test("capacity-planning SlaOperationsService is instantiable", () => {
  const Service = capacityPlanning.SlaOperationsService;
  const instance = new Service();
  assert.ok(instance != null, "should create instance");
  assert.strictEqual(typeof instance.evaluate, "function", "should have evaluate method");
});
