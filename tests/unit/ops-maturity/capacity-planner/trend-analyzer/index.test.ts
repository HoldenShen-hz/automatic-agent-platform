import assert from "node:assert/strict";
import test from "node:test";

import {
  analyzeCapacityTrend,
  estimateCapacityVolatility,
  CapacityTrendAnalyzerService,
} from "../../../../../src/ops-maturity/capacity-planner/trend-analyzer/index.js";

test("analyzeCapacityTrend returns flat for empty samples", () => {
  const result = analyzeCapacityTrend([]);
  assert.equal(result.average, 0);
  assert.equal(result.direction, "flat");
});

test("analyzeCapacityTrend calculates average and direction up", () => {
  const result = analyzeCapacityTrend([10, 20, 30]);
  assert.equal(result.average, 20);
  assert.equal(result.direction, "up");
});

test("analyzeCapacityTrend calculates direction down", () => {
  const result = analyzeCapacityTrend([30, 20, 10]);
  assert.equal(result.average, 20);
  assert.equal(result.direction, "down");
});

test("analyzeCapacityTrend calculates direction flat", () => {
  const result = analyzeCapacityTrend([10, 10, 10]);
  assert.equal(result.average, 10);
  assert.equal(result.direction, "flat");
});

test("estimateCapacityVolatility returns 0 for empty samples", () => {
  const result = estimateCapacityVolatility([]);
  assert.equal(result, 0);
});

test("estimateCapacityVolatility returns 0 for single sample", () => {
  const result = estimateCapacityVolatility([100]);
  assert.equal(result, 0);
});

test("estimateCapacityVolatility calculates average absolute delta", () => {
  const result = estimateCapacityVolatility([100, 110, 90]);
  // deltas: 10, 20 -> avg = 15
  assert.equal(result, 15);
});

test("CapacityTrendAnalyzerService.analyze returns full analysis", () => {
  const service = new CapacityTrendAnalyzerService();
  const result = service.analyze([100, 110, 90, 120, 130]);
  assert.equal(result.average, 110);
  assert.equal(result.direction, "up");
  assert.ok(result.volatility >= 0);
  assert.ok(result.confidencePercent >= 55);
});

test("CapacityTrendAnalyzerService.analyze confidence increases with sample size", () => {
  const service = new CapacityTrendAnalyzerService();
  const smallResult = service.analyze([100, 110]);
  const largeResult = service.analyze([100, 110, 120, 130, 140, 150, 160, 170]);
  assert.ok(largeResult.confidencePercent > smallResult.confidencePercent);
});

test("CapacityTrendAnalyzerService.analyze handles flat trend", () => {
  const service = new CapacityTrendAnalyzerService();
  const result = service.analyze([100, 100, 100, 100]);
  assert.equal(result.direction, "flat");
  assert.equal(result.average, 100);
});
