import assert from "node:assert/strict";
import test from "node:test";

import {
  forecastCapacityUsage,
  forecastCapacityPeak,
  CapacityForecasterService,
  type ForecastSeries,
} from new URL("../../../../../src/ops-maturity/capacity-planner/forecaster/index.js", import.meta.url).href;

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

// Additional tests for edge cases and fuller coverage

test("forecastCapacityUsage with fractional initial usage", () => {
  const result = forecastCapacityUsage(33.33, 10, 2);
  // 33.33 * 1.10 = 36.663 -> 36.66
  assert.equal(result[0], 36.66);
  // 36.66 * 1.10 = 40.326 -> 40.33
  assert.equal(result[1], 40.33);
});

test("forecastCapacityUsage with high growth rate", () => {
  const result = forecastCapacityUsage(100, 100, 2);
  assert.equal(result[0], 200);
  assert.equal(result[1], 400);
});

test("forecastCapacityUsage with fractional growth rate", () => {
  const result = forecastCapacityUsage(100, 0.5, 3);
  // 100 * 1.005 = 100.50
  assert.equal(result[0], 100.5);
  // 100.50 * 1.005 = 101.0025 -> 101.00
  assert.equal(result[1], 101);
  // 101.00 * 1.005 = 101.505 -> 101.50
  assert.equal(result[2], 101.5);
});

test("forecastCapacityUsage returns new array each call", () => {
  const result1 = forecastCapacityUsage(100, 10, 3);
  const result2 = forecastCapacityUsage(100, 10, 3);
  result1.push(999);
  assert.notEqual(result1.length, result2.length);
});

test("forecastCapacityPeak returns currentUsage when periods is 0", () => {
  const result = forecastCapacityPeak(100, 10, 0);
  assert.equal(result, 100);
});

test("forecastCapacityPeak returns currentUsage when growth is negative and declines", () => {
  const result = forecastCapacityPeak(100, -20, 3);
  // forecastCapacityUsage: [80, 64, 51.2], peak is 100 (currentUsage)
  assert.equal(result, 100);
});

test("forecastCapacityPeak returns projected peak when it exceeds currentUsage", () => {
  const result = forecastCapacityPeak(100, 50, 1);
  // forecastCapacityUsage: [150], max(150, 100) = 150
  assert.equal(result, 150);
});

test("CapacityForecasterService.forecast with zero periods", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(100, 10, 0);
  assert.equal(result.projectedUsage.length, 0);
  assert.equal(result.peak, 100);
});

test("CapacityForecasterService.forecast with negative growth rate", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(500, -10, 3);
  assert.equal(result.projectedUsage[0], 450);
  assert.equal(result.projectedUsage[1], 405);
  assert.equal(result.projectedUsage[2], 364.5);
  // peak is currentUsage since growth is negative
  assert.equal(result.peak, 500);
});

test("CapacityForecasterService.forecast returns readonly projectedUsage", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(100, 10, 3);
  const projected = result.projectedUsage;
  assert.ok(Array.isArray(projected));
  // Verify it is readonly-like (length cannot be set directly)
  assert.equal((projected as unknown[]).length, 3);
});

test("CapacityForecasterService.forecast peak is a number primitive", () => {
  const service = new CapacityForecasterService();
  const result = service.forecast(100, 10, 3);
  assert.equal(typeof result.peak, "number");
  assert.ok(!isNaN(result.peak));
  assert.ok(isFinite(result.peak));
});
