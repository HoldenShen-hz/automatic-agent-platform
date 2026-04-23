/**
 * Integration Test: Budget Guard
 *
 * Verifies budget policy enforcement for task execution costs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard, type BudgetPolicy } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

test("BudgetGuard: task under budget is allowed", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 2,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
  assert.ok(result.remainingBudgetUsd >= 0);
});

test("BudgetGuard: task approaching limit triggers approval", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // 8 + 1 = 9, which is 90% of 10 (above 80% warn threshold)
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 8,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard: task exceeding limit is blocked", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // 9 + 2 = 11, which exceeds 10
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 9,
    nextEstimatedCostUsd: 2,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard: zero remaining budget when exactly at limit", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.9,
    mode: "auto",
  };

  // 8 + 2 = 10, exactly at limit
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 8,
    nextEstimatedCostUsd: 2,
  });

  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard: remaining budget calculated correctly", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 3,
    nextEstimatedCostUsd: 2,
  });

  // 10 - (3 + 2) = 5
  assert.equal(result.remainingBudgetUsd, 5);
});

test("BudgetGuard: negative projected cost not possible (remaining shows max)", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // Current already exceeds limit
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 15,
    nextEstimatedCostUsd: 1,
  });

  // Remaining should be 0, not negative
  assert.equal(result.remainingBudgetUsd, 0);
  assert.equal(result.allowed, false);
});

test("BudgetGuard: warnAtRatio 1.0 only warns when at limit", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 1.0,
    mode: "supervised",
  };

  // 9.5 + 0.5 = 10, exactly at limit, should trigger warning
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 9.5,
    nextEstimatedCostUsd: 0.5,
  });

  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard: warnAtRatio 0.5 triggers early warning", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.5,
    mode: "supervised",
  };

  // 5 + 1 = 6, which is 60% of 10 (above 50% warn threshold)
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard: mode 'auto' works same as supervised for evaluation", () => {
  const guard = new BudgetGuard();

  const policyAuto: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const policySupervised: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const resultAuto = guard.evaluateTaskSpend({
    policy: policyAuto,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 1,
  });

  const resultSupervised = guard.evaluateTaskSpend({
    policy: policySupervised,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 1,
  });

  // Both should have same evaluation logic
  assert.equal(resultAuto.allowed, resultSupervised.allowed);
  assert.equal(resultAuto.requiresApproval, resultSupervised.requiresApproval);
});

test("BudgetGuard: mode 'full-auto' works same as auto for evaluation", () => {
  const guard = new BudgetGuard();

  const policyAuto: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
  };

  const policyFullAuto: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "full-auto",
  };

  const resultAuto = guard.evaluateTaskSpend({
    policy: policyAuto,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 1,
  });

  const resultFullAuto = guard.evaluateTaskSpend({
    policy: policyFullAuto,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 1,
  });

  // Both should have same evaluation logic
  assert.equal(resultAuto.allowed, resultFullAuto.allowed);
  assert.equal(resultAuto.requiresApproval, resultFullAuto.requiresApproval);
});

test("BudgetGuard: small costs still calculate correctly", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 0.01,
    maxDailyCostUsd: 1,
    maxMonthlyCostUsd: 10,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 0.005,
    nextEstimatedCostUsd: 0.002,
  });

  assert.equal(result.allowed, true);
  // Remaining should be 0.01 - 0.007 = 0.003
  assert.ok(result.remainingBudgetUsd > 0);
});

test("BudgetGuard: zero next step cost uses current only", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 0,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 5);
});

test("BudgetGuard: zero current cost with small next step", () => {
  const guard = new BudgetGuard();

  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 0.5,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingBudgetUsd, 9.5);
});
