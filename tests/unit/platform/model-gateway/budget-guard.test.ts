import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard, type BudgetPolicy, type ExecutionChainBudgetSpend } from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
import { createBudgetLedger } from "../../../../src/platform/contracts/executable-contracts/index.js";

function createDefaultPolicy(): BudgetPolicy {
  return {
    maxTaskCostUsd: 10.0,
    maxPackCostUsd: 100.0,
    maxPlatformCostUsd: 1000.0,
    maxDailyCostUsd: 500.0,
    maxMonthlyCostUsd: 5000.0,
    warnAtRatio: 0.8,
    mode: "supervised",
  };
}

function createDefaultSpend(overrides?: Partial<ExecutionChainBudgetSpend>): ExecutionChainBudgetSpend {
  return {
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 1.0,
    currentPackCostUsd: 0,
    currentPlatformCostUsd: 0,
    currentDailyCostUsd: 0,
    currentMonthlyCostUsd: 0,
    ...overrides,
  };
}

test("BudgetGuard evaluateTaskSpend allows when under limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy(),
    currentTaskCostUsd: 5.0,
    nextEstimatedCostUsd: 1.0,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
});

test("BudgetGuard evaluateTaskSpend blocks when over limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy(),
    currentTaskCostUsd: 9.0,
    nextEstimatedCostUsd: 2.0,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuard evaluateTaskSpend blocks when projected cost equals task limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy(),
    currentTaskCostUsd: 8.0,
    nextEstimatedCostUsd: 2.0,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend requires approval when approaching limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy(),
    currentTaskCostUsd: 7.5,
    nextEstimatedCostUsd: 1.0,
  });

  // 7.5 + 1.0 = 8.5 which is 85% of 10 (exceeds 80% warnAtRatio)
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard evaluateTaskSpend calculates remaining budget", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy(),
    currentTaskCostUsd: 3.0,
    nextEstimatedCostUsd: 2.0,
  });

  // 3.0 + 2.0 = 5.0, remaining = 10 - 5 = 5.0
  assert.equal(result.remainingBudgetUsd, 5.0);
});

test("BudgetGuard evaluateExecutionChain allows when under all limits", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentTaskCostUsd: 5.0, currentPackCostUsd: 50.0 }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
});

test("BudgetGuard evaluateExecutionChain blocks task scope", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentTaskCostUsd: 9.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks pack scope", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentPackCostUsd: 99.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "pack");
  assert.equal(result.reasonCode, "budget.pack_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks platform scope", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentPlatformCostUsd: 999.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "platform");
});

test("BudgetGuard evaluateExecutionChain blocks daily scope", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentDailyCostUsd: 499.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "daily");
  assert.equal(result.reasonCode, "budget.daily_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks monthly scope", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentMonthlyCostUsd: 4999.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "monthly");
  assert.equal(result.reasonCode, "budget.monthly_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain warns on multiple scopes", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: 8.0,
      currentPackCostUsd: 80.0,
      currentDailyCostUsd: 400.0,
    }),
  });

  // 8.0 + 1.0 = 9.0 (90% of task limit)
  // 80.0 + 1.0 = 81.0 (81% of pack limit)
  // 400.0 + 1.0 = 401.0 (80.2% of daily limit)
  assert.equal(result.allowed, true);
  assert.ok(result.warningScopes.length > 0);
  assert.ok(result.warningScopes.includes("task"));
});

test("BudgetGuard evaluateExecutionChain calculates projected costs correctly", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: 5.0,
      currentPackCostUsd: 50.0,
      currentPlatformCostUsd: 500.0,
      currentDailyCostUsd: 250.0,
      currentMonthlyCostUsd: 2500.0,
    }),
  });

  assert.equal(result.projectedTaskCostUsd, 6.0);
  assert.equal(result.projectedDailyCostUsd, 251.0);
  assert.equal(result.projectedMonthlyCostUsd, 2501.0);
});

test("BudgetGuard evaluateExecutionChain correctly identifies task scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({ currentTaskCostUsd: 9.0, nextEstimatedCostUsd: 2.0 }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});
