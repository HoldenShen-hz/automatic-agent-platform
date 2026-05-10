/**
 * Integration Tests: Cost Alert
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  CostAlertService,
  type CostThresholdExceededEvent,
} from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-service.js";

import {
  CostAlertConfigLoader,
} from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-config-loader.js";

import type {
  CostAlertConfig,
  StepUsageRecord,
  CostAlertLevel,
  BudgetScope,
} from "../../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-types.js";

// ============================================================================
// Cost Alert End-to-End Integration Tests
// ============================================================================

test("integration: cost escalation through warning to critical to exceeded", (t, done) => {
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

  const events: CostThresholdExceededEvent[] = [];

  service.on("cost.threshold.exceeded", (event: CostThresholdExceededEvent) => {
    events.push(event);
  });

  service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_warning",
    costUsd: 850,
    timestamp: new Date().toISOString(),
  });

  service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_critical",
    costUsd: 960,
    timestamp: new Date().toISOString(),
  });

  service.evaluateCost({
    scope: "platform",
    scopeId: null,
    stepId: "step_exceeded",
    costUsd: 1100,
    timestamp: new Date().toISOString(),
  });

  setTimeout(() => {
    assert.ok(events.length >= 2);
    assert.ok(events.some((e) => e.level === CostAlertLevel.CRITICAL));
    done();
  }, 10);
});

test("integration: tenant-level budget enforcement", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      tenant_001: {
        scope: "tenant" as BudgetScope,
        scopeId: "tenant_001",
        budgetLimitUsd: 500,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
      },
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const withinBudget = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_001",
    stepId: "step_tenant_ok",
    costUsd: 300,
    timestamp: new Date().toISOString(),
  });

  const exceeded = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_001",
    stepId: "step_tenant_over",
    costUsd: 600,
    timestamp: new Date().toISOString(),
  });

  assert.equal(withinBudget.withinBudget, true);
  assert.equal(exceeded.withinBudget, false);
  assert.equal(exceeded.level, CostAlertLevel.EXCEEDED);
});

test("integration: step usage recording and accumulation", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
  };

  const service = new CostAlertService(config as CostAlertConfig);

  service.recordStepUsage({
    stepId: "step_accum_001",
    costUsd: 10,
    modelId: "claude-3-5-sonnet",
    inputTokens: 1000,
    outputTokens: 500,
    timestamp: new Date().toISOString(),
  });

  service.recordStepUsage({
    stepId: "step_accum_001",
    costUsd: 15,
    modelId: "claude-3-5-sonnet",
    inputTokens: 2000,
    outputTokens: 1000,
    timestamp: new Date().toISOString(),
  });

  const accumulator = service.getAccumulator("step", "step_accum_001");

  assert.ok(accumulator !== null);
  assert.equal(accumulator.totalCostUsd, 25);
  assert.equal(accumulator.totalInputTokens, 3000);
  assert.equal(accumulator.totalOutputTokens, 1500);
});

test("integration: cost alert config loader validates and loads", () => {
  const loader = new CostAlertConfigLoader();

  const defaultConfig = loader.loadDefault();

  assert.ok(defaultConfig !== null);
  assert.equal(defaultConfig.enabled, true);
  assert.ok(typeof defaultConfig.platformBudgetPolicy?.budgetLimitUsd === "number");
});

test("integration: multiple tenants with separate budgets", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      tenant_a: {
        scope: "tenant" as BudgetScope,
        scopeId: "tenant_a",
        budgetLimitUsd: 100,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
      },
      tenant_b: {
        scope: "tenant" as BudgetScope,
        scopeId: "tenant_b",
        budgetLimitUsd: 500,
        warningThreshold: 0.8,
        criticalThreshold: 0.95,
      },
    },
  };

  const service = new CostAlertService(config as CostAlertConfig);

  const tenantAExceeds = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_a",
    stepId: "step_a",
    costUsd: 150,
    timestamp: new Date().toISOString(),
  });

  const tenantBWithin = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant_b",
    stepId: "step_b",
    costUsd: 200,
    timestamp: new Date().toISOString(),
  });

  assert.equal(tenantAExceeds.withinBudget, false);
  assert.equal(tenantBWithin.withinBudget, true);
});
