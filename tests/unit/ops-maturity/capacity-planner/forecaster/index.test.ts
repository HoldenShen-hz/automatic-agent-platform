import assert from "node:assert/strict";
import test from "node:test";

import {
  forecastCapacityUsage,
  forecastCapacityPeak,
  CapacityForecasterService,
} from "../../../../src/ops-maturity/capacity-planner/forecaster/index.js";

test("forecastCapacityUsage projects usage over periods", () => {
  const result = forecastCapacityUsage(100, 10, 3);

  assert.equal(result.length, 3);
  assert.equal(result[0], 110);
  assert.equal(result[1], 121);
  assert.equal(result[2], 133.1);
});

test("forecastCapacityUsage handles zero growth rate", () => {
  const result = forecastCapacityUsage(100, 0, 5);

  assert.equal(result.length, 5);
  assert.ok(result.every((v) => v === 100));
});

test("forecastCapacityUsage handles zero periods", () => {
  const result = forecastCapacityUsage(100, 10, 0);
  assert.equal(result.length, 0);
});

test("forecastCapacityUsage handles negative growth rate", () => {
  const result = forecastCapacityUsage(100, -10, 2);

  assert.equal(result[0], 90);
  assert.equal(result[1], 81);
});

test("forecastCapacityPeak returns highest value", () => {
  const result = forecastCapacityPeak(100, 10, 5);

  assert.ok(result >= 100);
  assert.equal(result, forecastCapacityUsage(100, 10, 5).at(-1));
});

test("CapacityForecasterService.forecast returns projection series", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(100, 10, 3);

  assert.ok(Array.isArray(result.projectedUsage));
  assert.equal(result.projectedUsage.length, 3);
  assert.ok(result.peak > 0);
});
