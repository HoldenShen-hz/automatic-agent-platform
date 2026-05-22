/**
 * Unit Tests: Cost Alert
 */

import assert from "node:assert/strict";
import test from "node:test";

import { CostAlertConfigLoader } from "../../../../src/platform/five-plane-control-plane/cost-alert/cost-alert-config-loader.js";
import {
  CostAlertLevel,
  CostAlertService,
  type BudgetPolicy,
  type CostAlertConfig,
  type CostThresholdExceededEvent,
} from "../../../../src/platform/five-plane-control-plane/cost-alert/index.js";
import type { AuthoritativeSqlDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

function createNoopStore(): AuthoritativeTaskStore {
  return {
    event: {
      insertEvent(): void {},
    },
    artifact: {
      insertArtifact(): void {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createService(config: Partial<CostAlertConfig> = {}): CostAlertService {
  return new CostAlertService(
    {} as unknown as AuthoritativeSqlDatabase,
    createNoopStore(),
    config,
  );
}

function createPlatformBudgetPolicy(limitCostUsd: number): BudgetPolicy {
  return {
    scope: "platform",
    scopeId: "platform-root",
    period: "monthly",
    limitCostUsd,
    warningThreshold: 0.8,
    actionsOnWarning: ["sev3_alert"],
    actionsOnBreach: ["workflow_pause"],
  };
}

// ============================================================================
// Cost Alert Service Tests
// ============================================================================

test("CostAlertService evaluates cost under budget", () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(1000),
  });

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "platform-root",
    projectedCostUsd: 100,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, CostAlertLevel.OK);
  assert.equal(result.remainingBudgetUsd, 900);
});

test("CostAlertService triggers warning at 80% threshold", () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(1000),
  });

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "platform-root",
    projectedCostUsd: 850,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, CostAlertLevel.WARNING);
  assert.ok((result.remainingBudgetUsd ?? 0) < 200);
});

test("CostAlertService triggers critical at 95% threshold", () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(1000),
  });

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "platform-root",
    projectedCostUsd: 960,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.alertLevel, CostAlertLevel.CRITICAL);
});

test("CostAlertService blocks when budget exceeded", () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(1000),
  });

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "platform-root",
    projectedCostUsd: 1100,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.alertLevel, CostAlertLevel.EXCEEDED);
});

test("CostAlertService records cost into accumulator", () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(1000),
  });

  service.recordCost({
    scope: "platform",
    scopeId: "platform-root",
    actualCostUsd: 50,
    tokens: 1500,
    tenantId: "tenant-1",
    stepId: "step_005",
    provider: "anthropic",
    model: "claude-3-5-sonnet",
    promptTokens: 1000,
    completionTokens: 500,
  });

  const accumulator = service.getAccumulator("platform", "platform-root");

  assert.ok(accumulator !== null);
  assert.equal(accumulator.accumulatedCostUsd, 50);
  assert.equal(accumulator.accumulatedTokens, 1500);
});

test("CostAlertService emits critical threshold event on recordCost", async () => {
  const service = createService({
    enabled: true,
    platformBudgetPolicy: createPlatformBudgetPolicy(100),
  });

  const event = await new Promise<CostThresholdExceededEvent>((resolve) => {
    service.once("cost:limit_reached", resolve);
    service.recordCost({
      scope: "platform",
      scopeId: "platform-root",
      actualCostUsd: 96,
      tokens: 2000,
      tenantId: "tenant-1",
      stepId: "step_006",
    });
  });

  assert.equal(event.scope, "platform");
  assert.equal(event.alertLevel, CostAlertLevel.CRITICAL);
  assert.equal(event.eventTier, "tier_2");
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

test("CostAlertConfigLoader rejects zero warning threshold", () => {
  const loader = new CostAlertConfigLoader();

  const isValid = loader.validateBudgetPolicy({
    scope: "platform",
    budgetLimitUsd: 1000,
    warningThreshold: 0,
    criticalThreshold: 0.8,
  });

  assert.equal(isValid, false);
});
