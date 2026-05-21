import assert from "node:assert/strict";
import test from "node:test";

import {
  simulateCostOptimization,
  simulateScenarioSavings,
  type CostSimulationScenario,
} from "../../../../src/ops-maturity/cost-optimizer/simulator/index.js";

test("cost-management: simulateCostOptimization applies reduction percentage", () => {
  const result = simulateCostOptimization(100, 10);

  assert.strictEqual(result, 90);
});

test("cost-management: simulateCostOptimization handles zero reduction", () => {
  const result = simulateCostOptimization(100, 0);

  assert.strictEqual(result, 100);
});

test("cost-management: simulateCostOptimization handles 100 percent reduction", () => {
  const result = simulateCostOptimization(100, 100);

  assert.strictEqual(result, 0);
});

test("cost-management: simulateCostOptimization rounds to 2 decimal places", () => {
  const result = simulateCostOptimization(99.999, 15);

  // 99.999 * 0.85 = 84.99915, which rounds to 85.00
  assert.strictEqual(result, 85);
});

test("cost-management: simulateCostOptimization handles fractional costs", () => {
  const result = simulateCostOptimization(33.33, 10);

  // 33.33 * 0.90 = 29.997, rounds to 30
  assert.strictEqual(result, 30);
});

test("cost-management: simulateCostOptimization handles zero cost", () => {
  const result = simulateCostOptimization(0, 50);

  assert.strictEqual(result, 0);
});

test("cost-management: simulateCostOptimization handles large costs", () => {
  const result = simulateCostOptimization(1_000_000, 20);

  assert.strictEqual(result, 800_000);
});

test("cost-management: simulateCostOptimization handles small costs", () => {
  const result = simulateCostOptimization(0.01, 50);

  assert.strictEqual(result, 0.01);
});

test("cost-management: simulateScenarioSavings calculates savings for multiple scenarios", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "scenario_a", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "scenario_b", baselineCostUsd: 200, reductionPercent: 20 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["scenario_a"], 10);
  assert.strictEqual(result["scenario_b"], 40);
});

test("cost-management: simulateScenarioSavings handles empty array", () => {
  const result = simulateScenarioSavings([]);

  assert.deepStrictEqual(result, {});
});

test("cost-management: simulateScenarioSavings handles fractional savings", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "frac", baselineCostUsd: 33.33, reductionPercent: 10 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["frac"], 3.33);
});

test("cost-management: simulateScenarioSavings handles single scenario", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "single", baselineCostUsd: 500, reductionPercent: 15 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["single"], 75);
});

test("cost-management: simulateScenarioSavings preserves scenarioId in output keys", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "cost-reduction-20pct", baselineCostUsd: 100, reductionPercent: 20 },
    { scenarioId: "cost-reduction-50pct", baselineCostUsd: 100, reductionPercent: 50 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.ok("cost-reduction-20pct" in result);
  assert.ok("cost-reduction-50pct" in result);
  assert.strictEqual(result["cost-reduction-20pct"], 20);
  assert.strictEqual(result["cost-reduction-50pct"], 50);
});

test("cost-management: simulateScenarioSavings calculates correct delta", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "delta-check", baselineCostUsd: 150, reductionPercent: 30 },
  ];

  const result = simulateScenarioSavings(scenarios);

  // 150 * 0.70 = 105, savings = 150 - 105 = 45
  assert.strictEqual(result["delta-check"], 45);
});

test("cost-management: simulateScenarioSavings handles edge case 100% reduction", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "full-reduction", baselineCostUsd: 100, reductionPercent: 100 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["full-reduction"], 100);
});

test("cost-management: simulateScenarioSavings handles zero reduction", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "no-reduction", baselineCostUsd: 100, reductionPercent: 0 },
  ];

  const result = simulateScenarioSavings(scenarios);

  assert.strictEqual(result["no-reduction"], 0);
});