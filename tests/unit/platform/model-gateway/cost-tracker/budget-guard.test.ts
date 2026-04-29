import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard, type BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

test("BudgetGuard evaluateTaskSpend allows when under budget", () => {
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

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
  assert.equal(result.remainingBudgetUsd, 85);
});

test("BudgetGuard evaluateTaskSpend blocks when over budget", () => {
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
    nextEstimatedCostUsd: 20,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend requires approval at warn ratio", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // At exactly 80% (80 USD), should require approval
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 70,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard evaluateTaskSpend handles zero current cost", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 50,
    maxDailyCostUsd: 500,
    maxMonthlyCostUsd: 5000,
    warnAtRatio: 0.9,
    mode: "auto",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 40);
});

test("BudgetGuard evaluateTaskSpend handles zero next cost", () => {
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
    nextEstimatedCostUsd: 0,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 50);
});

test("BudgetGuard evaluateTaskSpend rounds remaining budget to zero at limit", () => {
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
    currentTaskCostUsd: 100,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend handles exact budget match", () => {
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

  // At exactly 100 (100% of budget), allowed but requires approval
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard evaluateTaskSpend different modes", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "full-auto",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  // Mode doesn't affect evaluation logic in this simple implementation
  assert.equal(result.allowed, true);
});

test("BudgetGuard evaluateExecutionChain blocks monthly cascade violations", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 500,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 20,
      currentDailyCostUsd: 200,
      currentMonthlyCostUsd: 990,
      nextEstimatedCostUsd: 15,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "monthly");
  assert.equal(result.reasonCode, "budget.monthly_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain reports warning scopes across task daily monthly budgets", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 200,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.75,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 70,
      currentDailyCostUsd: 140,
      currentMonthlyCostUsd: 600,
      nextEstimatedCostUsd: 10,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.deepEqual(result.warningScopes, ["task", "daily"]);
  assert.equal(result.projectedMonthlyCostUsd, 610);
});

test("BudgetGuard evaluateExecutionChain blocks task violation", () => {
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
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 500,
      nextEstimatedCostUsd: 20,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateExecutionChain blocks daily violation", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 200,
    maxMonthlyCostUsd: 5000,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      currentDailyCostUsd: 180,
      currentMonthlyCostUsd: 1000,
      nextEstimatedCostUsd: 30,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "daily");
  assert.equal(result.reasonCode, "budget.daily_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain allows when all under budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 500,
    maxMonthlyCostUsd: 5000,
    warnAtRatio: 0.9,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 1000,
      nextEstimatedCostUsd: 5,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
  assert.equal(result.violatedScope, null);
  assert.deepEqual(result.warningScopes, []);
});

test("BudgetGuard evaluateExecutionChain handles zero spend", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "full-auto",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 0,
      currentDailyCostUsd: 0,
      currentMonthlyCostUsd: 0,
      nextEstimatedCostUsd: 0,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 100);
  assert.equal(result.projectedTaskCostUsd, 0);
  assert.equal(result.projectedDailyCostUsd, 0);
  assert.equal(result.projectedMonthlyCostUsd, 0);
});

test("BudgetGuard evaluateExecutionChain remainingBudgetUsd is minimum of all scopes", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 50,
    maxMonthlyCostUsd: 500,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      currentDailyCostUsd: 10,
      currentMonthlyCostUsd: 10,
      nextEstimatedCostUsd: 5,
    },
  });

  // Daily is most constrained: 50 - 15 = 35
  assert.equal(result.remainingBudgetUsd, 35);
});

test("BudgetGuard evaluateExecutionChain with warnAtRatio of 1.0 (no warnings)", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 500,
    maxMonthlyCostUsd: 5000,
    warnAtRatio: 1.0,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 80,
      currentDailyCostUsd: 400,
      currentMonthlyCostUsd: 4000,
      nextEstimatedCostUsd: 10,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.deepEqual(result.warningScopes, []);
});

test("BudgetGuard evaluateExecutionChain with warnAtRatio of 0 (always warn when allowed)", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 500,
    maxMonthlyCostUsd: 5000,
    warnAtRatio: 0,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 10,
      currentDailyCostUsd: 10,
      currentMonthlyCostUsd: 10,
      nextEstimatedCostUsd: 5,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.deepEqual(result.warningScopes, ["task", "daily", "monthly"]);
});

test("BudgetGuard evaluateExecutionChain projected values are correct", () => {
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
      currentTaskCostUsd: 30,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 500,
      nextEstimatedCostUsd: 15,
    },
  });

  assert.equal(result.projectedTaskCostUsd, 45);
  assert.equal(result.projectedDailyCostUsd, 115);
  assert.equal(result.projectedMonthlyCostUsd, 515);
});

test("BudgetGuard evaluateExecutionChain all three warning scopes", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 200,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.5,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 55,
      currentDailyCostUsd: 110,
      currentMonthlyCostUsd: 510,
      nextEstimatedCostUsd: 10,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.deepEqual(result.warningScopes, ["task", "daily", "monthly"]);
});

test("BudgetGuard evaluateExecutionChain reports pack and platform warning scopes", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: {
      maxTaskCostUsd: 100,
      maxPackCostUsd: 100,
      maxPlatformCostUsd: 100,
      maxDailyCostUsd: 1000,
      maxMonthlyCostUsd: 10000,
      warnAtRatio: 0.8,
      mode: "auto",
    },
    spend: {
      currentTaskCostUsd: 10,
      nextEstimatedCostUsd: 5,
      currentPackCostUsd: 78,
      currentPlatformCostUsd: 79,
      currentDailyCostUsd: 10,
      currentMonthlyCostUsd: 10,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
  assert.deepEqual(result.warningScopes, ["pack", "platform"]);
  assert.equal(result.projectedPackCostUsd, 83);
  assert.equal(result.projectedPlatformCostUsd, 84);
});

test("BudgetGuard evaluateTaskSpend with warnAtRatio 1.0", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 1.0,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 90,
    nextEstimatedCostUsd: 5,
  });

  // At 95 USD (95% of limit), no warning when warnAtRatio is 1.0
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("BudgetGuard evaluateTaskSpend with warnAtRatio 0", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 100,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 1,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});
