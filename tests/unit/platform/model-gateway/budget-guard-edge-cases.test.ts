/**
 * Additional BudgetGuard edge case tests for increased coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetGuard,
  type BudgetPolicy,
  type BudgetGuardResult,
  type ExecutionChainBudgetSpend,
  type BudgetGuardCascadeResult,
} from "../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

test("BudgetGuard instance methods are callable", () => {
  const guard = new BudgetGuard();
  assert.equal(typeof guard.evaluateTaskSpend, "function");
  assert.equal(typeof guard.evaluateExecutionChain, "function");
});

test("BudgetGuard evaluateTaskSpend with maximum values", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: Number.MAX_SAFE_INTEGER,
    maxDailyCostUsd: Number.MAX_SAFE_INTEGER,
    maxMonthlyCostUsd: Number.MAX_SAFE_INTEGER,
    warnAtRatio: 0.9,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: Number.MAX_SAFE_INTEGER - 1,
  });

  assert.equal(result.allowed, true);
  assert.ok(result.remainingBudgetUsd > 0);
});

test("BudgetGuard evaluateTaskSpend with very small warnAtRatio", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.01,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 1,
    nextEstimatedCostUsd: 0,
  });

  // Even 1% of budget triggers warning
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard evaluateTaskSpend with very large warnAtRatio", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.99,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 98,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard evaluateTaskSpend reasonCode is null when not approaching", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.reasonCode, null);
  assert.equal(result.requiresApproval, false);
});

test("BudgetGuard evaluateExecutionChain returns correct violatedScope for task", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 50,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 40,
      nextEstimatedCostUsd: 20,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 1000,
    },
  });

  assert.equal(result.violatedScope, "task");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain returns correct violatedScope for daily", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 1000,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 101,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 1000,
    },
  });

  assert.equal(result.violatedScope, "daily");
  assert.equal(result.reasonCode, "budget.daily_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain returns correct violatedScope for monthly", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 1000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 100,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 11,
      currentDailyCostUsd: 10,
      currentMonthlyCostUsd: 90,
    },
  });

  assert.equal(result.violatedScope, "monthly");
  assert.equal(result.reasonCode, "budget.monthly_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain warningScopes can be empty array", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 1.0, // Never warn
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 50,
      nextEstimatedCostUsd: 49,
      currentDailyCostUsd: 500,
      currentMonthlyCostUsd: 5000,
    },
  });

  assert.deepEqual(result.warningScopes, []);
});

test("BudgetGuard evaluateExecutionChain remainingBudgetUsd is zero when exceeded", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 50,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 60,
      nextEstimatedCostUsd: 10,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 1000,
    },
  });

  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateExecutionChain projected values are positive when allowed", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 200,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 5,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 100,
    },
  });

  assert.ok(result.projectedTaskCostUsd >= 0);
  assert.ok(result.projectedDailyCostUsd >= 0);
  assert.ok(result.projectedMonthlyCostUsd >= 0);
});

test("BudgetGuard evaluateExecutionChain requiresApproval when any warning scope exists", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 85,
      nextEstimatedCostUsd: 5,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 100,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.ok(result.warningScopes.length > 0);
});

test("BudgetPolicy type accepts all mode values", () => {
  const modes: BudgetPolicy["mode"][] = ["supervised", "auto", "full-auto"];

  for (const mode of modes) {
    const guard = new BudgetGuard();
    const policy: BudgetPolicy = {
      maxTaskCostUsd: 100,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode,
    };

    const result = guard.evaluateTaskSpend({
      policy,
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 5,
    });

    assert.equal(result.allowed, true);
  }
});

test("BudgetGuard handles fractional remaining budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 33.33,
    nextEstimatedCostUsd: 33.33,
  });

  // 33.33 + 33.33 = 66.66, remaining = 100 - 66.66 = 33.34
  assert.ok(Math.abs(result.remainingBudgetUsd - 33.34) < 0.01);
});

test("BudgetGuard evaluateExecutionChain with fractional values", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100.5,
    maxDailyCostUsd: 200.5,
    maxMonthlyCostUsd: 1000.5,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10.25,
      nextEstimatedCostUsd: 5.25,
      currentDailyCostUsd: 50.5,
      currentMonthlyCostUsd: 100.5,
    },
  });

  assert.equal(result.allowed, true);
  assert.ok(result.projectedTaskCostUsd > 0);
});

test("BudgetGuard evaluateTaskSpend blocks when exactly at limit with next step", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 95,
    nextEstimatedCostUsd: 10,
  });

  // 95 + 10 = 105 > 100, so blocked
  assert.equal(result.allowed, false);
});

test("BudgetGuard evaluateTaskSpend allows when exactly at limit with next step", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 90,
    nextEstimatedCostUsd: 10,
  });

  // 90 + 10 = 100, exactly at limit, so the guard allows but flags approval at the boundary.
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard evaluateExecutionChain handles equal violation in all scopes", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 100,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 95,
      nextEstimatedCostUsd: 10,
      currentDailyCostUsd: 95,
      currentMonthlyCostUsd: 95,
    },
  });

  // All scopes are exceeded, task is checked first
  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
});

test("BudgetGuard evaluateExecutionChain allows with zero warnAtRatio", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 0,
      nextEstimatedCostUsd: 1,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.ok(result.warningScopes.length > 0);
});

test("BudgetGuard evaluateExecutionChain reasonCode is cascade_approaching_limit when allowed but warning", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 85,
      nextEstimatedCostUsd: 5,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.cascade_approaching_limit");
});

test("BudgetGuard evaluateExecutionChain reasonCode is null when allowed and no warnings", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 1.0,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 50,
      nextEstimatedCostUsd: 10,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
});

test("BudgetGuard evaluateTaskSpend with negative nextEstimatedCostUsd", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 50,
    nextEstimatedCostUsd: -10, // Negative - should still work
  });

  // -10 effectively adds budget
  assert.equal(result.allowed, true);
  assert.equal(result.remainingBudgetUsd, 60);
});

test("BudgetGuard evaluateExecutionChain with negative nextEstimatedCostUsd", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 50,
      nextEstimatedCostUsd: -20,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });

  // -20 effectively adds budget
  assert.equal(result.allowed, true);
});
