import assert from "node:assert/strict";
import test from "node:test";

import {
  simulateCostOptimization,
  simulateScenarioSavings,
  type CostSimulationScenario,
} from "../../../../src/ops-maturity/cost-optimizer/simulator/index.js";

test("simulateScenarioSavings handles very small baseline costs", () => {
  // Edge case: tiny baseline costs that could cause floating-point issues
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "tiny_1", baselineCostUsd: 0.01, reductionPercent: 50 },
    { scenarioId: "tiny_2", baselineCostUsd: 0.001, reductionPercent: 10 },
  ];
  const result = simulateScenarioSavings(scenarios);
  // 0.01 * 0.5 = 0.005 -> simulateCostOptimization returns 0.01 (floored at 0.01 min?)
  // Actually: 0.01 * 0.5 = 0.005 -> toFixed(2) = "0.01" -> Number = 0.01
  // So savings = 0.01 - 0.01 = 0
  assert.equal(result["tiny_1"], 0);
});

test("simulateScenarioSavings handles large reduction percentages", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "high_cut", baselineCostUsd: 1000, reductionPercent: 99 },
    { scenarioId: "full_cut", baselineCostUsd: 1000, reductionPercent: 100 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["high_cut"], 990); // 1000 * 0.99 = 990
  assert.equal(result["full_cut"], 1000); // 1000 * 1.0 = 0, savings = 1000
});

test("simulateScenarioSavings handles floating-point precision in intermediate calculations", () => {
  // These values are known to cause floating-point issues in JavaScript
  const scenarios: CostSimulationScenario[] = [
    // 0.1 + 0.2 !== 0.3 in floating point
    { scenarioId: "fp_edge_1", baselineCostUsd: 0.1 + 0.2, reductionPercent: 33 },
    // 0.7 - 0.1 - 0.2 - 0.4 !== 0 in floating point
    { scenarioId: "fp_edge_2", baselineCostUsd: 0.7, reductionPercent: 14 },
  ];
  const result = simulateScenarioSavings(scenarios);
  // Just verify no NaN or Infinity appears
  assert.ok(Number.isFinite(result["fp_edge_1"]), "Result should be finite");
  assert.ok(Number.isFinite(result["fp_edge_2"]), "Result should be finite");
});

test("simulateScenarioSavings handles cost values that produce repeating decimals", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "thirds", baselineCostUsd: 100, reductionPercent: 33 },
    // 100 * (1 - 0.33) = 100 * 0.67 = 67, but 33% of 100 is actually 33
    // simulateCostOptimization(100, 33) = 67
    // savings = 100 - 67 = 33
    { scenarioId: "sevenths", baselineCostUsd: 100, reductionPercent: 14 },
    // 100 * (1 - 0.14) = 86, savings = 14
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["thirds"], 33);
  assert.equal(result["sevenths"], 14);
});

test("simulateScenarioSavings with many scenarios computes correctly", () => {
  const scenarios: CostSimulationScenario[] = Array.from({ length: 20 }, (_, i) => ({
    scenarioId: `scenario_${i}`,
    baselineCostUsd: (i + 1) * 10,
    reductionPercent: (i * 5) % 100,
  }));
  const result = simulateScenarioSavings(scenarios);
  assert.equal(Object.keys(result).length, 20);
  // Verify a few specific values
  assert.equal(result["scenario_0"], 0); // baseline 10, reduction 0%
  // baseline 20, reduction 5%: 20 * 0.95 = 19, savings = 20 - 19 = 1
  assert.equal(result["scenario_1"], 1);
  // baseline 30, reduction 10%: 30 * 0.90 = 27, savings = 30 - 27 = 3
  assert.equal(result["scenario_2"], 3);
});

test("simulateCostOptimization with exact boundary percentages", () => {
  assert.equal(simulateCostOptimization(100, 1), 99);
  assert.equal(simulateCostOptimization(100, 99), 1);
  assert.equal(simulateCostOptimization(1_000_000, 1), 990_000);
  assert.equal(simulateCostOptimization(1_000_000, 50), 500_000);
});

test("simulateCostOptimization handles very small resulting costs", () => {
  // Large baseline with small reduction: result should be large
  assert.equal(simulateCostOptimization(1_000_000, 1), 990_000);
  // Small baseline with large reduction: result should be small
  assert.equal(simulateCostOptimization(0.01, 99), 0);
});

test("simulateScenarioSavings returns 0 savings for 0% reduction regardless of baseline", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "zero_pct_1", baselineCostUsd: 0.01, reductionPercent: 0 },
    { scenarioId: "zero_pct_2", baselineCostUsd: 1_000_000, reductionPercent: 0 },
    { scenarioId: "zero_pct_3", baselineCostUsd: 999.99, reductionPercent: 0 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["zero_pct_1"], 0);
  assert.equal(result["zero_pct_2"], 0);
  assert.equal(result["zero_pct_3"], 0);
});

test("simulateScenarioSavings negative baseline should not occur but function handles it gracefully", () => {
  // Negative baseline is theoretically possible (refunds/credits)
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "negative", baselineCostUsd: -100, reductionPercent: 10 },
  ];
  const result = simulateScenarioSavings(scenarios);
  // -100 * 0.9 = -90, savings = -100 - (-90) = -10
  assert.equal(result["negative"], -10);
});

test("simulateScenarioSavings computes savings as difference, not just reduction amount", () => {
  // Savings = baseline - simulated_cost
  // This is NOT the same as baseline * (reductionPercent / 100) due to rounding
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "round_diff", baselineCostUsd: 33.33, reductionPercent: 33 },
  ];
  // simulateCostOptimization(33.33, 33) = 33.33 * 0.67 = 22.3311 -> toFixed(2) = "22.33"
  // savings = 33.33 - 22.33 = 11
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["round_diff"], 11);
});

test("simulateScenarioSavings multiple scenarios with same baseline different reductions", () => {
  const scenarios: CostSimulationScenario[] = [
    { scenarioId: "base_100_pct_10", baselineCostUsd: 100, reductionPercent: 10 },
    { scenarioId: "base_100_pct_20", baselineCostUsd: 100, reductionPercent: 20 },
    { scenarioId: "base_100_pct_50", baselineCostUsd: 100, reductionPercent: 50 },
    { scenarioId: "base_100_pct_90", baselineCostUsd: 100, reductionPercent: 90 },
  ];
  const result = simulateScenarioSavings(scenarios);
  assert.equal(result["base_100_pct_10"], 10);
  assert.equal(result["base_100_pct_20"], 20);
  assert.equal(result["base_100_pct_50"], 50);
  assert.equal(result["base_100_pct_90"], 90);
});
