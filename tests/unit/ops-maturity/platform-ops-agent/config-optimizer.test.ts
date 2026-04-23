import assert from "node:assert/strict";
import test from "node:test";

import {
  ConfigOptimizerService,
  buildConfigOptimizationSuggestion,
} from "../../../../src/ops-maturity/platform-ops-agent/config-optimizer/index.js";

test("buildConfigOptimizationSuggestion formats suggestion correctly", () => {
  const suggestion = buildConfigOptimizationSuggestion("max_connections", 100, 200);

  assert.equal(suggestion, "max_connections: 100 -> 200");
});

test("buildConfigOptimizationSuggestion handles string values", () => {
  const suggestion = buildConfigOptimizationSuggestion("timeout", 30, 60);

  assert.ok(suggestion.includes("timeout"));
  assert.ok(suggestion.includes("30"));
  assert.ok(suggestion.includes("60"));
});

test("buildConfigOptimizationSuggestion handles zero values", () => {
  const suggestion = buildConfigOptimizationSuggestion("retry_count", 0, 3);

  assert.equal(suggestion, "retry_count: 0 -> 3");
});

test("buildConfigOptimizationSuggestion handles large values", () => {
  const suggestion = buildConfigOptimizationSuggestion("pool_size", 10, 10000);

  assert.equal(suggestion, "pool_size: 10 -> 10000");
});

test("buildConfigOptimizationSuggestion handles negative to positive", () => {
  const suggestion = buildConfigOptimizationSuggestion("threshold", -50, 50);

  assert.equal(suggestion, "threshold: -50 -> 50");
});

test("ConfigOptimizerService computes savings and urgency", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "worker_pool",
    currentValue: 100,
    recommendedValue: 80,
    unitCostUsd: 2,
    currentLoad: 100,
    projectedLoad: 180,
  });

  assert.equal(result.summary, "worker_pool: 100 -> 80");
  assert.equal(result.estimatedSavings, 40);
  assert.equal(result.savingsPercent, 20);
  assert.equal(result.urgency, "high");
  assert.ok(result.reasonCodes.includes("config.optimization.cost_reduction"));
});

test("ConfigOptimizerService handles medium urgency without unit cost", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "queue_limit",
    currentValue: 40,
    recommendedValue: 35,
    currentLoad: 100,
    projectedLoad: 120,
  });

  assert.equal(result.estimatedSavings, 5);
  assert.equal(result.urgency, "medium");
});

test("ConfigOptimizerService handles low urgency capacity alignment", () => {
  const service = new ConfigOptimizerService();
  const result = service.optimize({
    key: "cache_size",
    currentValue: 20,
    recommendedValue: 25,
    currentLoad: 50,
    projectedLoad: 55,
  });

  assert.equal(result.savingsPercent, 0);
  assert.equal(result.urgency, "low");
  assert.ok(result.reasonCodes.includes("config.optimization.capacity_alignment"));
});
