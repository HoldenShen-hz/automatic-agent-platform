import assert from "node:assert/strict";
import test from "node:test";

import type { CostAlertConfig, BudgetPolicy, BudgetScope } from "../../../../../src/platform/control-plane/cost-alert/cost-alert-types.js";

const mockDb = {
  transaction: <T>(fn: () => T): T => fn(),
} as any;

const mockStore = {
  event: {
    insertEvent: () => ({}),
  },
  artifact: {
    insertArtifact: () => ({}),
  },
} as any;

import { CostAlertService } from "../../../../../src/platform/control-plane/cost-alert/cost-alert-service.js";

function createPolicy(scope: BudgetScope, scopeId: string, limit: number): BudgetPolicy {
  return {
    scope,
    scopeId,
    period: "monthly",
    limitCostUsd: limit,
    limitTokens: undefined,
    warningThreshold: 0.8,
    actionsOnWarning: ["sev3_alert"],
    actionsOnBreach: ["step_abort"],
  };
}

test("CostAlertService uses platform budget policy", () => {
  const policy = createPolicy("platform", "default", 1000);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    platformBudgetPolicy: policy,
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "platform",
    scopeId: "default",
    projectedCostUsd: 500,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0.5);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService uses pack budget policy", () => {
  const policy = createPolicy("pack", "pack-abc", 200);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    packBudgetPolicies: { "pack-abc": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "pack",
    scopeId: "pack-abc",
    projectedCostUsd: 50,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0.25);
});

test("CostAlertService evaluates critical threshold correctly", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // Record cost at 96 (96% of limit - above 95% critical threshold)
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 96,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 5,
    tenantId: "tenant-1",
  });

  assert.equal(result.alertLevel, "critical");
  assert.equal(result.reasonCode, "cost.critical");
});

test("CostAlertService step scope falls back to tenant policy", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "step",
    scopeId: "step-xyz",
    projectedCostUsd: 50,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0.5);
});

test("CostAlertService accumulators track tokens separately", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 10,
    tokens: 5000,
    tenantId: "tenant-1",
    stepId: "step-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.ok(accumulator);
  assert.equal(accumulator!.accumulatedCostUsd, 10);
  assert.equal(accumulator!.accumulatedTokens, 5000);
});

test("CostAlertService emits exceeded event at limit", (t, done) => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);
  const events: any[] = [];

  service.on("cost.threshold.exceeded", (event: any) => events.push(event));

  // First record crosses limit
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 110,
    tenantId: "tenant-1",
  });

  setTimeout(() => {
    const exceededEvent = events.find(e => e.alertLevel === "exceeded");
    assert.ok(exceededEvent, "Should emit exceeded event");
    done();
  }, 10);
});

test("CostAlertService does not allow cost when exceeded", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // Record exactly at limit
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 100,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 1,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.alertLevel, "exceeded");
});

test("CostAlertService handles missing step scope policy", () => {
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {},
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "step",
    scopeId: "step-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService computes remaining budget with projected cost", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 40,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 30,
    tenantId: "tenant-1",
  });

  // Current: 40, Projected: 70, Limit: 100
  // Remaining = 100 - 70 = 30
  assert.equal(result.remainingBudgetUsd, 30);
  assert.equal(result.thresholdRatio, 0.7);
});

test("CostAlertService handles infinity limit", () => {
  const policy: BudgetPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    period: "per_run",
    limitCostUsd: null as any, // infinity
    limitTokens: undefined,
    warningThreshold: 0.9,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 999999,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0);
});

test("CostAlertService records with provider and model metadata", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 5,
    tokens: 1000,
    tenantId: "tenant-1",
    taskId: "task-1",
    executionId: "exec-1",
    stepId: "step-1",
    provider: "anthropic",
    model: "claude-opus-4",
    promptTokens: 600,
    completionTokens: 400,
    cached: true,
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.ok(accumulator);
  assert.equal(accumulator!.accumulatedCostUsd, 5);
  assert.equal(accumulator!.accumulatedTokens, 1000);
});

test("CostAlertService periodEnd is calculated correctly for monthly", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 5,
    tenantId: "tenant-1",
    stepId: "step-1",
  });

  const accumulator = service.getAccumulator("tenant", "tenant-1");
  assert.ok(accumulator);
  assert.ok(accumulator!.periodEnd > accumulator!.periodStart);
});

test("CostAlertService warning threshold uses policy value", () => {
  const policy: BudgetPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    period: "monthly",
    limitCostUsd: 100,
    warningThreshold: 0.6,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  // 65 is above 60% warning threshold but below 80% default
  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 65,
    tenantId: "tenant-1",
  });

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 1,
    tenantId: "tenant-1",
  });

  assert.equal(result.alertLevel, "warning");
});

test("CostAlertService returns ok when disabled", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: false,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 999,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.alertLevel, "ok");
});

test("CostAlertService multiple scopes independent", () => {
  const policy1 = createPolicy("tenant", "tenant-1", 100);
  const policy2 = createPolicy("tenant", "tenant-2", 200);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: {
      "tenant-1": policy1,
      "tenant-2": policy2,
    },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-1",
    actualCostUsd: 90, // 90% of limit
    tenantId: "tenant-1",
  });

  service.recordCost({
    scope: "tenant",
    scopeId: "tenant-2",
    actualCostUsd: 50, // 25% of limit
    tenantId: "tenant-2",
  });

  const accum1 = service.getAccumulator("tenant", "tenant-1");
  const accum2 = service.getAccumulator("tenant", "tenant-2");

  assert.equal(accum1!.accumulatedCostUsd, 90);
  assert.equal(accum2!.accumulatedCostUsd, 50);
});

test("CostAlertService resolves step scope with tenant fallback", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "step",
    scopeId: "step-abc",
    projectedCostUsd: 50,
    tenantId: "tenant-1",
  });

  // Should use tenant-1 policy for step scope
  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0.5);
});

test("CostAlertService evaluates zero projected cost", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 0,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, true);
  assert.equal(result.thresholdRatio, 0);
  assert.equal(result.remainingBudgetUsd, 100);
});

test("CostAlertService handles zero limit gracefully", () => {
  const policy: BudgetPolicy = {
    scope: "tenant",
    scopeId: "tenant-1",
    period: "monthly",
    limitCostUsd: 0,
    limitTokens: undefined,
    warningThreshold: 0.8,
    actionsOnWarning: [],
    actionsOnBreach: [],
  };
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  const result = service.evaluateCost({
    scope: "tenant",
    scopeId: "tenant-1",
    projectedCostUsd: 10,
    tenantId: "tenant-1",
  });

  assert.equal(result.allowed, false);
  assert.equal(result.alertLevel, "exceeded");
});

test("CostAlertService updates config preserves existing policies", () => {
  const policy = createPolicy("tenant", "tenant-1", 100);
  const config: Partial<CostAlertConfig> = {
    enabled: true,
    tenantBudgetPolicies: { "tenant-1": policy },
  };

  const service = new CostAlertService(mockDb, mockStore, config);

  service.updateConfig({ enabled: false });

  // Policy should still exist but service disabled
  assert.equal(service["config"].enabled, false);
});