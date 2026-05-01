import assert from "node:assert/strict";
import test from "node:test";
import {
  simulateCostOptimization,
  simulateScenarioSavings,
  type CostSimulationScenario,
} from "../../../src/ops-maturity/cost-optimizer/simulator/index.js";

test("simulateCostOptimization applies reduction percentage", () => {
  const result = simulateCostOptimization(100, 10);
  assert.strictEqual(result, 90);
});

test("simulateCostOptimization handles zero reduction", () => {
  const result = simulateCostOptimization(100, 0);
  assert.strictEqual(result, 100);
});

test("simulateCostOptimization handles 100 percent reduction", () => {
  const result = simulateCostOptimization(100, 100);
  assert.strictEqual(result, 0);
});

test("simulateCostOptimization rounds to 2 decimal places", () => {
  const result = simulateCostOptimization(99.999, 15);
  // 99.999 * 0.85 = 84.99915, which rounds to 85.00
  assert.strictEqual(result, 85);
});

test("simulateScenarioSavings calculates savings for multiple scenarios", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "scenario_a", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "scenario_b", baselineCostUsd: 200, reductionPercent: 20 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["scenario_a"], 10);
  assert.strictEqual(result["scenario_b"], 40);
});

test("simulateScenarioSavings handles empty array", () => {
  const result = simulateScenarioSavings([]);
  assert.deepStrictEqual(result, {});
});

test("simulateScenarioSavings handles fractional savings", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "frac", baselineCostUsd: 33.33, reductionPercent: 10 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["frac"], 3.33);
});