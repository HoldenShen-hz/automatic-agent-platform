import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import {
  BudgetGuard,
  type BudgetPolicy,
  type BudgetGuardResult,
} from "../../../../../src/platform/model-gateway/cost-tracker/index.js";

test("BudgetGuard can be instantiated", () => {
  const guard = new BudgetGuard();
  assert.ok(guard instanceof BudgetGuard);
});

test("BudgetPolicy structure is correct", () => {
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };
  assert.equal(policy.maxTaskCostUsd, 10);
  assert.equal(policy.maxDailyCostUsd, 100);
  assert.equal(policy.warnAtRatio, 0.8);
  assert.equal(policy.mode, "supervised");
});

test("BudgetPolicy mode accepts all valid values", () => {
  const modes: BudgetPolicy["mode"][] = ["supervised", "auto", "full-auto"];
  assert.equal(modes.length, 3);
});

test("BudgetGuardResult structure is correct", () => {
  const result: BudgetGuardResult = {
    allowed: true,
    requiresApproval: false,
    reasonCode: null,
    remainingBudgetUsd: 5,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 5);
});

test("BudgetGuardResult with blocked request", () => {
  const result: BudgetGuardResult = {
    allowed: false,
    requiresApproval: false,
    reasonCode: "budget.task_limit_exceeded",
    remainingBudgetUsd: 0,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuardResult with approval required", () => {
  const result: BudgetGuardResult = {
    allowed: true,
    requiresApproval: true,
    reasonCode: "budget.approaching_limit",
    remainingBudgetUsd: 1,
  };
  assert.equal(result.requiresApproval, true);
});
