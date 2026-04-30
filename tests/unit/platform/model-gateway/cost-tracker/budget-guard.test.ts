/**
 * Budget Guard Unit Tests - Comprehensive coverage
 */

import assert from "node:assert/strict";
import test from "node:test";

import { BudgetGuard, type BudgetPolicy, type ExecutionChainBudgetSpend } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";

function createDefaultPolicy(overrides?: Partial<BudgetPolicy>): BudgetPolicy {
  return {
    maxTaskCostUsd: 100,
    maxPackCostUsd: 500,
    maxPlatformCostUsd: 5000,
    maxDailyCostUsd: 1000,
    maxMonthlyCostUsd: 10000,
    warnAtRatio: 0.8,
    mode: "supervised",
    maxModelTokens: 100000,
    maxSteps: 50,
    maxDurationMs: 600000,
    ...overrides,
  };
}

function createDefaultSpend(overrides?: Partial<ExecutionChainBudgetSpend>): ExecutionChainBudgetSpend {
  return {
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 10,
    currentPackCostUsd: 0,
    currentPlatformCostUsd: 0,
    currentDailyCostUsd: 0,
    currentMonthlyCostUsd: 0,
    ...overrides,
  };
}

// ============================================================================
// evaluateTaskSpend Tests
// ============================================================================

test("BudgetGuard evaluateTaskSpend allows when under budget", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 85);
});

test("BudgetGuard evaluateTaskSpend blocks when over budget", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: 90,
    nextEstimatedCostUsd: 20,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend requires approval at warn ratio threshold", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100, warnAtRatio: 0.8 }),
    currentTaskCostUsd: 70,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard evaluateTaskSpend at exactly 100% allows with approval", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: 90,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

test("BudgetGuard evaluateTaskSpend zero current and next costs", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 0,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 100);
});

test("BudgetGuard evaluateTaskSpend rounds remaining to zero", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: 100,
    nextEstimatedCostUsd: 10,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend handles maxTaskCostUsd=0", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 0 }),
    currentTaskCostUsd: 0,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend warnAtRatio 1.0 disables warnings", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100, warnAtRatio: 1.0 }),
    currentTaskCostUsd: 95,
    nextEstimatedCostUsd: 3,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
});

test("BudgetGuard evaluateTaskSpend warnAtRatio 0 triggers warning immediately", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100, warnAtRatio: 0 }),
    currentTaskCostUsd: 1,
    nextEstimatedCostUsd: 1,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
});

// ============================================================================
// evaluateExecutionChain Tests
// ============================================================================

test("BudgetGuard evaluateExecutionChain allows when all scopes under limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: 10,
      currentPackCostUsd: 100,
      currentPlatformCostUsd: 500,
      currentDailyCostUsd: 100,
      currentMonthlyCostUsd: 1000,
      nextEstimatedCostUsd: 10,
    }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.violatedScope, null);
});

test("BudgetGuard evaluateExecutionChain blocks task scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ maxTaskCostUsd: 50 }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 40,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks pack scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ maxPackCostUsd: 100 }),
    spend: createDefaultSpend({
      currentPackCostUsd: 90,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "pack");
  assert.equal(result.reasonCode, "budget.pack_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks platform scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ maxPlatformCostUsd: 200 }),
    spend: createDefaultSpend({
      currentPlatformCostUsd: 190,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "platform");
  assert.equal(result.reasonCode, "budget.platform_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks daily scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ maxDailyCostUsd: 100 }),
    spend: createDefaultSpend({
      currentDailyCostUsd: 90,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "daily");
  assert.equal(result.reasonCode, "budget.daily_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain blocks monthly scope violation", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ maxMonthlyCostUsd: 500 }),
    spend: createDefaultSpend({
      currentMonthlyCostUsd: 490,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "monthly");
  assert.equal(result.reasonCode, "budget.monthly_limit_exceeded");
});

test("BudgetGuard evaluateExecutionChain warns on multiple scopes approaching limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ warnAtRatio: 0.5 }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 55,
      currentDailyCostUsd: 110,
      currentMonthlyCostUsd: 510,
      nextEstimatedCostUsd: 10,
    }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.ok(result.warningScopes.includes("task"));
  assert.ok(result.warningScopes.includes("daily"));
  assert.ok(result.warningScopes.includes("monthly"));
});

test("BudgetGuard evaluateExecutionChain returns correct remaining budget (minimum of all scopes)", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({
      maxTaskCostUsd: 100,
      maxPackCostUsd: 50,
      maxPlatformCostUsd: 200,
      maxDailyCostUsd: 100,
      maxMonthlyCostUsd: 500,
    }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 10,
      currentPackCostUsd: 10,
      currentPlatformCostUsd: 10,
      currentDailyCostUsd: 10,
      currentMonthlyCostUsd: 10,
      nextEstimatedCostUsd: 5,
    }),
  });

  // Pack is most constrained: 50 - 15 = 35
  assert.equal(result.remainingBudgetUsd, 35);
});

test("BudgetGuard evaluateExecutionChain projected values are correct", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: 30,
      currentPackCostUsd: 100,
      currentPlatformCostUsd: 500,
      currentDailyCostUsd: 200,
      currentMonthlyCostUsd: 1000,
      nextEstimatedCostUsd: 15,
    }),
  });

  assert.equal(result.projectedTaskCostUsd, 45);
  assert.equal(result.projectedPackCostUsd, 115);
  assert.equal(result.projectedPlatformCostUsd, 515);
  assert.equal(result.projectedDailyCostUsd, 215);
  assert.equal(result.projectedMonthlyCostUsd, 1015);
});

// ============================================================================
// Edge Cases
// ============================================================================

test("BudgetGuard evaluateExecutionChain handles Infinity values gracefully", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({
      maxPackCostUsd: Infinity,
      maxPlatformCostUsd: Infinity,
    }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 10,
      currentPackCostUsd: Infinity,
      currentPlatformCostUsd: Infinity,
      nextEstimatedCostUsd: 10,
    }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
});

test("BudgetGuard evaluateExecutionChain handles NaN gracefully", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: NaN,
      nextEstimatedCostUsd: 10,
    }) as ExecutionChainBudgetSpend,
  });

  // NaN comparison results in false, so should be allowed
  assert.equal(result.allowed, false); // Actually NaN > anything is false
});

test("BudgetGuard evaluateExecutionChain handles negative spend values", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: -10,
      nextEstimatedCostUsd: 10,
    }),
  });

  // Negative current + positive next = positive projected
  // But the negative is treated as 0 due to normalizeSpend
  assert.equal(result.projectedTaskCostUsd, 10);
});

test("BudgetGuard evaluateTaskSpend very large cost values", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 1_000_000 }),
    currentTaskCostUsd: 500_000,
    nextEstimatedCostUsd: 300_000,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.remainingBudgetUsd, 200_000);
});

test("BudgetGuard evaluateTaskSpend overflow protection", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ maxTaskCostUsd: 100 }),
    currentTaskCostUsd: Number.MAX_VALUE,
    nextEstimatedCostUsd: 10,
  });

  // Should handle gracefully without throwing
  assert.equal(result.allowed, false);
});

test("BudgetGuard evaluateExecutionChain nextEstimatedCostUsd of 0", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy(),
    spend: createDefaultSpend({
      currentTaskCostUsd: 50,
      nextEstimatedCostUsd: 0,
    }),
  });

  assert.equal(result.allowed, true);
  assert.equal(result.projectedTaskCostUsd, 50);
});

test("BudgetGuard evaluateExecutionChain all scopes at exactly limit", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({ warnAtRatio: 0.8 }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 80,
      currentPackCostUsd: 400,
      currentPlatformCostUsd: 4000,
      currentDailyCostUsd: 800,
      currentMonthlyCostUsd: 8000,
      nextEstimatedCostUsd: 20,
    }),
  });

  assert.equal(result.allowed, false); // 100 > 100 task limit
  assert.equal(result.violatedScope, "task");
});

test("BudgetGuard evaluateExecutionChain multiple violations picks first", () => {
  const guard = new BudgetGuard();
  // Task is over but pack is also over - task should be reported as violated
  const result = guard.evaluateExecutionChain({
    policy: createDefaultPolicy({
      maxTaskCostUsd: 50,
      maxPackCostUsd: 100,
    }),
    spend: createDefaultSpend({
      currentTaskCostUsd: 45,
      currentPackCostUsd: 95,
      nextEstimatedCostUsd: 10,
    }),
  });

  assert.equal(result.allowed, false);
  assert.equal(result.violatedScope, "task");
});

// ============================================================================
// Mode-specific behavior
// ============================================================================

test("BudgetGuard works with supervised mode", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ mode: "supervised" }),
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, true);
});

test("BudgetGuard works with auto mode", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ mode: "auto" }),
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, true);
});

test("BudgetGuard works with full-auto mode", () => {
  const guard = new BudgetGuard();
  const result = guard.evaluateTaskSpend({
    policy: createDefaultPolicy({ mode: "full-auto" }),
    currentTaskCostUsd: 10,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, true);
});