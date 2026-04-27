/**
 * Unit tests for config-optimizer utilities
 *
 * @see src/ops-maturity/platform-ops-agent/config-optimizer/index.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  buildConfigOptimizationSuggestion,
  estimateConfigOptimizationSavings,
  ConfigOptimizerService,
  type ConfigOptimizationInput,
} from "../../../../../src/ops-maturity/platform-ops-agent/config-optimizer/index.js";

// ─────────────────────────────────────────────────────────────────────────────
// buildConfigOptimizationSuggestion
// ─────────────────────────────────────────────────────────────────────────────

test("buildConfigOptimizationSuggestion formats suggestion correctly", () => {
  const result = buildConfigOptimizationSuggestion("memory_limit", 1024, 2048);
  assert.equal(result, "memory_limit: 1024 -> 2048");
});

test("buildConfigOptimizationSuggestion handles string values", () => {
  const result = buildConfigOptimizationSuggestion("timeout", 30, 60);
  assert.equal(result, "timeout: 30 -> 60");
});

test("buildConfigOptimizationSuggestion handles zero currentValue", () => {
  const result = buildConfigOptimizationSuggestion("retry_count", 0, 3);
  assert.equal(result, "retry_count: 0 -> 3");
});

test("buildConfigOptimizationSuggestion handles decimal values", () => {
  const result = buildConfigOptimizationSuggestion("threshold", 0.5, 0.75);
  assert.equal(result, "threshold: 0.5 -> 0.75");
});

// ─────────────────────────────────────────────────────────────────────────────
// estimateConfigOptimizationSavings
// ─────────────────────────────────────────────────────────────────────────────

test("estimateConfigOptimizationSavings returns positive savings when reduced", () => {
  const result = estimateConfigOptimizationSavings(100, 80);
  assert.equal(result, 20);
});

test("estimateConfigOptimizationSavings returns zero when increased", () => {
  const result = estimateConfigOptimizationSavings(80, 100);
  assert.equal(result, 0);
});

test("estimateConfigOptimizationSavings returns zero when equal", () => {
  const result = estimateConfigOptimizationSavings(100, 100);
  assert.equal(result, 0);
});

test("estimateConfigOptimizationSavings handles negative result (returns 0)", () => {
  const result = estimateConfigOptimizationSavings(50, 150);
  assert.equal(result, 0);
});

test("estimateConfigOptimizationSavings rounds to 2 decimal places", () => {
  const result = estimateConfigOptimizationSavings(100, 33.333);
  assert.equal(result, 66.67);
});

test("estimateConfigOptimizationSavings handles large values", () => {
  const result = estimateConfigOptimizationSavings(1000000, 800000);
  assert.equal(result, 200000);
});

// ─────────────────────────────────────────────────────────────────────────────
// ConfigOptimizerService
// ─────────────────────────────────────────────────────────────────────────────

test("ConfigOptimizerService.optimize returns correct structure", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "max_connections",
    currentValue: 100,
    recommendedValue: 200,
  });

  assert.equal(typeof result.summary, "string");
  assert.equal(typeof result.estimatedSavings, "number");
  assert.equal(typeof result.savingsPercent, "number");
  assert.ok(["low", "medium", "high"].includes(result.urgency));
  assert.ok(Array.isArray(result.reasonCodes));
});

test("ConfigOptimizerService.optimize calculates estimatedSavings correctly", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "pool_size",
    currentValue: 50,
    recommendedValue: 25,
  });

  assert.equal(result.estimatedSavings, 25);
});

test("ConfigOptimizerService.optimize calculates savingsPercent correctly", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "cache_size",
    currentValue: 100,
    recommendedValue: 50,
  });

  assert.equal(result.savingsPercent, 50);
});

test("ConfigOptimizerService.optimize returns 0 savingsPercent when currentValue is 0", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "timeout",
    currentValue: 0,
    recommendedValue: 30,
  });

  assert.equal(result.savingsPercent, 0);
});

test("ConfigOptimizerService.optimize returns high urgency when delta > 50", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "workers",
    currentValue: 100,
    recommendedValue: 40,
    projectedLoad: 150,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "high");
});

test("ConfigOptimizerService.optimize returns medium urgency when delta > 10 and <= 50", () => {
  const service = new ConfigOptimizerService();
  // delta = 15 (> 10 and <= 50)
  const result = service.optimize({
    key: "workers",
    currentValue: 100,
    recommendedValue: 40,
    projectedLoad: 65,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "medium");
});

test("ConfigOptimizerService.optimize returns low urgency when delta <= 10", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "workers",
    currentValue: 100,
    recommendedValue: 40,
    projectedLoad: 55,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "low");
});

test("ConfigOptimizerService.optimize uses unitCostUsd to calculate savings", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "memory",
    currentValue: 100,
    recommendedValue: 80,
    unitCostUsd: 0.05,
  });

  assert.equal(result.estimatedSavings, 1); // (100-80) * 0.05 = 1
});

test("ConfigOptimizerService.optimize applies reason codes for cost reduction", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "cpu",
    currentValue: 100,
    recommendedValue: 80,
  });

  assert.ok(result.reasonCodes.includes("config.optimization.cost_reduction"));
  assert.ok(result.reasonCodes.some(r => r.includes("urgency")));
});

test("ConfigOptimizerService.optimize applies reason codes for capacity alignment", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "cpu",
    currentValue: 80, // recommended > current = no savings
    recommendedValue: 100,
  });

  assert.ok(result.reasonCodes.includes("config.optimization.capacity_alignment"));
});

test("ConfigOptimizerService.optimize handles missing optional fields", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "timeout",
    currentValue: 30,
    recommendedValue: 60,
  });

  assert.equal(result.estimatedSavings, 0); // 30-60 = negative, capped at 0
  assert.equal(result.urgency, "low"); // no delta
});

test("ConfigOptimizerService.optimize handles undefined projectedLoad", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "pool",
    currentValue: 100,
    recommendedValue: 50,
    projectedLoad: undefined,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "low"); // delta = 0
});

test("ConfigOptimizerService.optimize handles undefined currentLoad", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "pool",
    currentValue: 100,
    recommendedValue: 50,
    projectedLoad: 60,
    currentLoad: undefined,
  });

  assert.equal(result.urgency, "low"); // delta = 0
});

test("ConfigOptimizerService.optimize handles both loads undefined", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "pool",
    currentValue: 100,
    recommendedValue: 50,
  });

  assert.equal(result.urgency, "low"); // delta = 0
});

// ─────────────────────────────────────────────────────────────────────────────
// ConfigOptimizationInput interface
// ─────────────────────────────────────────────────────────────────────────────

test("ConfigOptimizationInput accepts minimal input", () => {
  const input: ConfigOptimizationInput = {
    key: "test",
    currentValue: 100,
    recommendedValue: 50,
  };
  assert.equal(input.key, "test");
  assert.equal(input.currentValue, 100);
  assert.equal(input.recommendedValue, 50);
  assert.equal(input.unitCostUsd, undefined);
  assert.equal(input.currentLoad, undefined);
  assert.equal(input.projectedLoad, undefined);
});

test("ConfigOptimizationInput accepts full input", () => {
  const input: ConfigOptimizationInput = {
    key: "test",
    currentValue: 100,
    recommendedValue: 50,
    unitCostUsd: 0.01,
    currentLoad: 80,
    projectedLoad: 120,
  };
  assert.equal(input.unitCostUsd, 0.01);
  assert.equal(input.currentLoad, 80);
  assert.equal(input.projectedLoad, 120);
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge cases
// ─────────────────────────────────────────────────────────────────────────────

test("estimateConfigOptimizationSavings handles very small differences", () => {
  const result = estimateConfigOptimizationSavings(100, 99);
  assert.equal(result, 1);
});

test("ConfigOptimizerService.optimize handles negative recommendedValue", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "timeout",
    currentValue: 30,
    recommendedValue: -10,
  });

  // current - recommended = 30 - (-10) = 40 savings
  assert.equal(result.estimatedSavings, 40);
});

test("ConfigOptimizerService.optimize urgency boundary at exactly 10", () => {
  const service = new ConfigOptimizerService();
  // delta = 11 (> 10, not >=)
  const result = service.optimize({
    key: "workers",
    currentValue: 100,
    recommendedValue: 50,
    projectedLoad: 61,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "medium"); // delta = 11, not > 10
});

test("ConfigOptimizerService.optimize urgency boundary at exactly 50", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "workers",
    currentValue: 100,
    recommendedValue: 50,
    projectedLoad: 100,
    currentLoad: 50,
  });

  assert.equal(result.urgency, "medium"); // delta = 50, not > 50
});
