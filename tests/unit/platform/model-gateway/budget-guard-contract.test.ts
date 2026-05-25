import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetGuard,
  actualizeCostEvent,
  type BudgetPolicy,
  type CostEvent,
  type StageBudgetPolicy,
  DEFAULT_COST_ESTIMATION_TEMPLATES,
} from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

function makePolicy(overrides: Partial<BudgetPolicy> = {}): BudgetPolicy {
  return {
    maxPlatformCostUsd: 100,
    maxPackCostUsd: 80,
    maxStepCostUsd: 20,
    stageBudgets: [{ stage: "execute", maxCostUsd: 10, warnAtRatio: 0.8 }],
    maxTaskCostUsd: 60,
    maxDailyCostUsd: 200,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.75,
    mode: "simulation",
    costEstimationTemplates: DEFAULT_COST_ESTIMATION_TEMPLATES,
    byokCostIsolation: {
      enabled: true,
      defaultChargeTarget: "split",
      platformGovernanceBudgetUsd: 20,
      userModelBudgetUsd: 80,
    },
    ...overrides,
  };
}

test("BudgetGuard honors canonical budget fields and eight-mode contract", () => {
  const guard = new BudgetGuard();
  const policy = makePolicy({ mode: "learning" });

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 5,
      currentDailyCostUsd: 20,
      currentMonthlyCostUsd: 40,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(policy.mode, "learning");
  assert.equal(policy.maxPlatformCostUsd, 100);
  assert.equal(policy.maxPackCostUsd, 80);
  assert.equal(policy.maxStepCostUsd, 20);
});

test("BudgetGuard enforces per-stage budgets for OAPEFLIR stages", () => {
  const guard = new BudgetGuard();
  const stagePolicy: StageBudgetPolicy = {
    stage: "execute",
    maxCostUsd: 10,
    warnAtRatio: 0.8,
    approvalThresholdUsd: 8,
  };
  const result = guard.evaluateExecutionChain({
    policy: makePolicy({ stageBudgets: [stagePolicy] }),
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 11,
      currentDailyCostUsd: 20,
      currentMonthlyCostUsd: 30,
      stage: "execute",
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "stage");
  assert.equal(result.reasonCode, "budget.stage_limit_exceeded");
});

test("cost event contracts support runtime attribution and BYOK isolation", () => {
  const policy = makePolicy({
    byokCostIsolation: {
      enabled: true,
      defaultChargeTarget: "split",
      platformGovernanceBudgetUsd: 10,
      userModelBudgetUsd: 50,
    },
  });
  const event: CostEvent = actualizeCostEvent({
    tenantId: "tenant-1",
    harnessRunId: "run-1",
    traceId: "trace-1",
    stage: "execute",
    scope: "step",
    observedCostUsd: 2.5,
    governanceOverheadUsd: 0.5,
    byok: true,
    templateId: "fast",
    stepId: "step-1",
    recordedAt: "2026-05-09T00:00:00.000Z",
    policy,
  });

  assert.equal(DEFAULT_COST_ESTIMATION_TEMPLATES.map((item) => item.templateId).join(","), "passthrough,fast,standard,full");
  assert.equal(event.templateId, "fast");
  assert.equal(event.totalCostUsd, 3);
  assert.equal(event.platformGovernanceCostUsd, 0.5);
  assert.equal(event.tenantModelCostUsd, 2.5);
});

test("actualizeCostEvent rejects unknown BYOK charge target", () => {
  assert.throws(
    () => actualizeCostEvent({
      tenantId: "tenant-1",
      harnessRunId: "run-1",
      traceId: "trace-1",
      stage: "execute",
      scope: "step",
      observedCostUsd: 2.5,
      governanceOverheadUsd: 0.5,
      byok: true,
      recordedAt: "2026-05-09T00:00:00.000Z",
      policy: {
        byokCostIsolation: {
          enabled: true,
          defaultChargeTarget: "unexpected" as "split",
        },
      },
    }),
    ValidationError,
  );
});
