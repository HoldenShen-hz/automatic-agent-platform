import assert from "node:assert/strict";
import test from "node:test";

import {
  simulateCostOptimization,
  simulateScenarioSavings,
  type CostSimulationScenario,
} from "../../../../../src/ops-maturity/cost-optimizer/simulator/index.js";

test("simulateCostOptimization applies reduction percentage correctly", () => {
  assert.equal(simulateCostOptimization(100, 10), 90);
  assert.equal(simulateCostOptimization(100, 20), 80);
  assert.equal(simulateCostOptimization(200, 50), 100);
  assert.equal(simulateCostOptimization(150.5, 25), 112.88);
});

test("simulateCostOptimization handles 0% reduction", () => {
  assert.equal(simulateCostOptimization(100, 0), 100);
});

test("simulateCostOptimization handles 100% reduction", () => {
  assert.equal(simulateCostOptimization(100, 100), 0);
});

test("simulateCostOptimization rounds to 2 decimal places", () => {
  assert.equal(simulateCostOptimization(33.333, 10), 30);
  assert.equal(simulateCostOptimization(99.999, 33), 67);
});

test("simulateCostOptimization handles fractional costs", () => {
  // 0.01 * 0.5 = 0.005 -> toFixed(2) = "0.01" -> Number = 0.01
  assert.equal(simulateCostOptimization(0.01, 50), 0.01);
  assert.equal(simulateCostOptimization(99.99, 1), 98.99);
});

test("simulateCostOptimization handles large costs", () => {
  assert.equal(simulateCostOptimization(1_000_000, 15), 850_000);
  assert.equal(simulateCostOptimization(999_999.99, 25), 749_999.99);
});

test("simulateScenarioSavings computes per-scenario savings", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "a", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "b", baselineCostUsd: 200, reductionPercent: 20 },
    { scenarioId: "c", baselineCostUsd: 150, reductionPercent: 50 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["a"], 10);
  assert.equal(result["b"], 40);
  assert.equal(result["c"], 75);
});

test("simulateScenarioSavings handles empty scenarios", () => {
  const result = simulateScenarioSavings([]);
  assert.deepEqual(result, {});
});

test("simulateScenarioSavings returns baseline cost for 100% reduction", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "full_cut", baselineCostUsd: 100, reductionPercent: 100 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["full_cut"], 100);
});

test("simulateScenarioSavings handles single scenario", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "solo", baselineCostUsd: 42.50, reductionPercent: 15 },
  ];
  const result = simulateScenarioSavings(scenarios);
  // 42.50 - (42.50 * 0.85) = 42.50 - 36.125 = 6.375 -> toFixed(2) = 6.38
  assert.equal(result["solo"], 6.38);
});

test("simulateScenarioSavings returns 0 savings for 0% reduction", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "no_reduction", baselineCostUsd: 500, reductionPercent: 0 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["no_reduction"], 0);
});

test("simulateScenarioSavings handles mixed reduction percentages", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "low", baselineCostUsd: 100, reductionPercent: 5 },
    { scenarioId: "med", baselineCostUsd: 100, reductionPercent: 50 },
    { scenarioId: "high", baselineCostUsd: 100, reductionPercent: 99 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["low"], 5);
  assert.equal(result["med"], 50);
  assert.equal(result["high"], 99);
});