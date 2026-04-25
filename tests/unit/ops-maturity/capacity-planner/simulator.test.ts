import assert from "node:assert/strict";
import test from "node:test";

import {
  simulateCapacityScenario,
  CapacityScenarioSimulatorService,
  type CapacityScenarioInput,
  type SimulatedScenarioResult,
} from "../../../../src/ops-maturity/capacity-planner/simulator/index.js";

test("simulateCapacityScenario calculates projected units with growth and optimization", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 10,
  });

  // (100 * 1.20) * 0.90 = 108
  assert.equal(result, 108);
});

test("simulateCapacityScenario returns baseline when growth is 0", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 0,
    optimizationPercent: 20,
  });

  // 100 * 1.0 * 0.8 = 80
  assert.equal(result, 80);
});

test("simulateCapacityScenario returns 0 when optimization is 100%", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 50,
    optimizationPercent: 100,
  });

  assert.equal(result, 0);
});

test("simulateCapacityScenario rounds to 2 decimal places", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 33.33,
    growthPercent: 15,
    optimizationPercent: 7.5,
  });

  // 33.33 * 1.15 = 38.3295, 38.3295 * 0.925 = 35.4547875 -> 35.45
  assert.equal(result, 35.45);
});

test("simulateCapacityScenario handles negative growth (shrinkage)", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: -10,
    optimizationPercent: 0,
  });

  // 100 * 0.9 * 1.0 = 90
  assert.equal(result, 90);
});

test("CapacityScenarioSimulatorService.simulate returns projectedUnits and savingsPercent", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 25,
  });

  assert.equal(result.projectedUnits, 90);
  assert.equal(result.savingsPercent, 10);
});

test("CapacityScenarioSimulatorService.simulate calculates correct savings for no optimization", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 0,
  });

  // baseline 100, after growth 120, no optimization
  // savingsPercent = (100 - 120) / 100 * 100 = -20%
  assert.equal(result.projectedUnits, 120);
  assert.equal(result.savingsPercent, -20);
});

test("CapacityScenarioSimulatorService.simulate handles small baseline", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 1,
    growthPercent: 100,
    optimizationPercent: 50,
  });

  // (1 * 2.0) * 0.5 = 1
  assert.equal(result.projectedUnits, 1);
  assert.equal(result.savingsPercent, 0);
});

test("CapacityScenarioSimulatorService.simulate calculates negative savings when growth exceeds optimization", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: 50,
    optimizationPercent: 20,
  });

  // (100 * 1.5) * 0.8 = 120
  assert.equal(result.projectedUnits, 120);
  // (100 - 120) / 100 * 100 = -20%
  assert.equal(result.savingsPercent, -20);
});

test("CapacityScenarioSimulatorService.simulate with extreme optimization", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 1000,
    growthPercent: 10,
    optimizationPercent: 95,
  });

  // (1000 * 1.10) * 0.05 = 55
  assert.equal(result.projectedUnits, 55);
  // (1000 - 55) / 1000 * 100 = 94.5
  assert.equal(result.savingsPercent, 94.5);
});

// Additional tests for edge cases and fuller coverage

test("simulateCapacityScenario with fractional baseline", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 10.5,
    growthPercent: 10,
    optimizationPercent: 10,
  });
  // 10.5 * 1.10 * 0.90 = 10.395 -> 10.40
  assert.equal(result, 10.4);
});

test("simulateCapacityScenario with zero baseline", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 0,
    growthPercent: 100,
    optimizationPercent: 50,
  });
  assert.equal(result, 0);
});

test("simulateCapacityScenario with high growth and no optimization", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 200,
    optimizationPercent: 0,
  });
  // 100 * 3.0 * 1.0 = 300
  assert.equal(result, 300);
});

test("simulateCapacityScenario with fractional optimization", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 0,
    optimizationPercent: 0.5,
  });
  // 100 * 1.0 * 0.995 = 99.50
  assert.equal(result, 99.5);
});

test("simulateCapacityScenario with both growth and optimization at 100%", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 100,
    optimizationPercent: 100,
  });
  // (100 * 2.0) * 0.0 = 0
  assert.equal(result, 0);
});

test("simulateCapacityScenario returns result as number primitive", () => {
  const result = simulateCapacityScenario({
    baselineUnits: 100,
    growthPercent: 10,
    optimizationPercent: 10,
  });
  assert.equal(typeof result, "number");
  assert.ok(!isNaN(result));
  assert.ok(isFinite(result));
});

test("CapacityScenarioSimulatorService.simulate returns readonly result values", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: 20,
    optimizationPercent: 10,
  });
  assert.equal(typeof result.projectedUnits, "number");
  assert.equal(typeof result.savingsPercent, "number");
});

test("CapacityScenarioSimulatorService.simulate zero optimization offsets negative growth", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: -20,
    optimizationPercent: 0,
  });
  // (100 * 0.8) * 1.0 = 80
  assert.equal(result.projectedUnits, 80);
  // (100 - 80) / 100 * 100 = 20%
  assert.equal(result.savingsPercent, 20);
});

test("CapacityScenarioSimulatorService.simulate negative growth with positive optimization", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: -20,
    optimizationPercent: 50,
  });
  // (100 * 0.8) * 0.5 = 40
  assert.equal(result.projectedUnits, 40);
  // (100 - 40) / 100 * 100 = 60%
  assert.equal(result.savingsPercent, 60);
});

test("CapacityScenarioSimulatorService.simulate savings never exceeds 100%", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 100,
    growthPercent: -99,
    optimizationPercent: 99,
  });
  // (100 * 0.01) * 0.01 = 0.01 -> 0.01
  assert.equal(result.projectedUnits, 0.01);
  // (100 - 0.01) / 100 * 100 = 99.99%
  assert.equal(result.savingsPercent, 99.99);
});

test("CapacityScenarioSimulatorService instance is reusable", () => {
  const service = new CapacityScenarioSimulatorService();
  const result1 = service.simulate({ baselineUnits: 100, growthPercent: 10, optimizationPercent: 10 });
  const result2 = service.simulate({ baselineUnits: 200, growthPercent: 20, optimizationPercent: 0 });
  assert.equal(result1.projectedUnits, 99);
  assert.equal(result2.projectedUnits, 240);
});

test("CapacityScenarioSimulatorService.simulate type correctness", () => {
  const service = new CapacityScenarioSimulatorService();
  const result = service.simulate({
    baselineUnits: 50,
    growthPercent: 10,
    optimizationPercent: 10,
  });
  const keys = Object.keys(result as object);
  assert.ok(keys.includes("projectedUnits"));
  assert.ok(keys.includes("savingsPercent"));
  assert.equal(keys.length, 2);
});
