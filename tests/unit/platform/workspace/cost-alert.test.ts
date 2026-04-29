/**
 * Unit Tests: Cost Alert
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CostAlertService,
  type CostAccumulator,
  type CostEvaluationResult,
  type CostThresholdExceededEvent,
  type BudgetPolicy,
  type BudgetScope,
  CostAlertLevel,
} from "../../../../src/platform/five-plane-control-plane/cost-alert/index.js";

import {
  CostAlertConfigLoader,
} from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-config-loader.js";

import type {
  CostAlertConfig,
  StepUsageRecord,
} from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-types.js";

// ============================================================================
// Cost Alert Service Tests
// ============================================================================

test("CostAlertService evaluates cost under budget", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform" as BudgetScope,
      budgetLimitUsd: 1000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_001",
    costUsd: 100,
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.withinBudget, true);
  assert.equal(result.level, CostAlertLevel.OK);
  assert.equal(result.budgetRemainingUsd, 900);
});

test("CostAlertService triggers warning at 80% threshold", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform" as BudgetScope,
      budgetLimitUsd: 1000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_002",
    costUsd: 850,
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.withinBudget, true);
  assert.equal(result.level, CostAlertLevel.WARNING);
  assert.ok(result.budgetRemainingUsd < 200);
});

test("CostAlertService triggers critical at 95% threshold", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform" as BudgetScope,
      budgetLimitUsd: 1000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_003",
    costUsd: 960,
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.withinBudget, true);
  assert.equal(result.level, CostAlertLevel.CRITICAL);
});

test("CostAlertService blocks when budget exceeded", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform" as BudgetScope,
      budgetLimitUsd: 1000,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_004",
    costUsd: 1100,
    timestamp: new Date().toISOString(),
  });

  assert.equal(result.withinBudget, false);
  assert.equal(result.level, CostAlertLevel.EXCEEDED);
});

test("CostAlertService records step usage", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
  };

  const service = new CostAlertService(config as CostAlertConfig);

  service.recordStepUsage({
    stepId: "step_005",
    costUsd: 50,
    modelId: "claude-3-5-sonnet",
    inputTokens: 1000,
    outputTokens: 500,
    timestamp: new Date().toISOString(),
  });

  const accumulator = service.getAccumulator("step", "step_005");

  assert.ok(accumulator !== null);
  assert.equal(accumulator.totalCostUsd, 50);
});

test("CostAlertService calculates tier 1 cost", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const tier1Cost = service.calculateTier1Cost({
    inputTokens: 10000,
    outputTokens: 5000,
    modelId: "claude-3-5-sonnet",
  });

  assert.ok(tier1Cost > 0);
});

test("CostAlertService emits threshold exceeded event", (t, done) => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: {
      scope: "platform" as BudgetScope,
      budgetLimitUsd: 100,
      warningThreshold: 0.8,
      criticalThreshold: 0.95,
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  service.on("cost.threshold.exceeded", (event: CostThresholdExceededEvent) => {
    assert.equal(event.scope, "platform");
    assert.equal(event.level, CostAlertLevel.CRITICAL);
    done();
  });

  service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_006",
    costUsd: 100,
    timestamp: new Date().toISOString(),
  });
});

// ============================================================================
// Cost Alert Config Loader Tests
// ============================================================================

test("CostAlertConfigLoader loads default config", () => {
  const loader = new CostAlertConfigLoader();

  const config = loader.loadDefault();

  assert.ok(config !== null);
  assert.equal(config.enabled, true);
});

test("CostAlertConfigLoader validates platform budget policy", () => {
  const loader = new CostAlertConfigLoader();

  const isValid = loader.validateBudgetPolicy({
    scope: "platform",
    budgetLimitUsd: 1000,
    warningThreshold: 0.8,
    criticalThreshold: 0.95,
  });

  assert.equal(isValid, true);
});

test("CostAlertConfigLoader rejects invalid thresholds", () => {
  const loader = new CostAlertConfigLoader();

  const isValid = loader.validateBudgetPolicy({
    scope: "platform",
    budgetLimitUsd: 1000,
    warningThreshold: 1.5,
    criticalThreshold: 0.95,
  });

  assert.equal(isValid, false);
});

test("CostAlertConfigLoader rejects warning >= critical", () => {
  const loader = new CostAlertConfigLoader();

  const isValid = loader.validateBudgetPolicy({
    scope: "platform",
    budgetLimitUsd: 1000,
    warningThreshold: 0.95,
    criticalThreshold: 0.8,
  });

  assert.equal(isValid, false);
});
