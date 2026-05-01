import assert from "node:assert/strict";
import test from "node:test";

import {
  BudgetGuard,
  ChargebackService,
  type BudgetPolicy,
  type BudgetGuardResult,
  type BudgetGuardCascadeResult,
  type BudgetGuardCascadeInput,
  type ChargebackReport,
  type ChargebackReportSource,
  type ChargebackAllocation,
} from "../../../../../src/platform/model-gateway/cost-tracker/index.js";

test("BudgetGuard is instantiable", () => {
  const guard = new BudgetGuard();
  assert.ok(guard instanceof BudgetGuard);
});

test("BudgetGuard evaluateTaskSpend allows request under budget", () => {
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
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.remainingBudgetUsd, 5);
});

test("BudgetGuard evaluateTaskSpend blocks request over budget", () => {
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
    currentTaskCostUsd: 8,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.remainingBudgetUsd, 0);
});

test("BudgetGuard evaluateTaskSpend requires approval when approaching limit", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // At 80% threshold (8), should require approval
  const result = guard.evaluateTaskSpend({
    policy,
    currentTaskCostUsd: 5,
    nextEstimatedCostUsd: 3,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuard evaluateTaskSpend no approval when far from limit", () => {
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
    nextEstimatedCostUsd: 3,
  });

  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
});

test("BudgetGuard evaluateExecutionChain allows request within all limits", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 3,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
  assert.ok(result.warningScopes.length === 0);
  assert.ok(result.projectedTaskCostUsd === 5);
  assert.ok(result.projectedDailyCostUsd === 53);
  assert.ok(result.projectedMonthlyCostUsd === 503);
});

test("BudgetGuard evaluateExecutionChain blocks on task limit exceeded", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 8,
      nextEstimatedCostUsd: 5,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
  assert.equal(result.violatedScope, "task");
});

test("BudgetGuard evaluateExecutionChain blocks on daily limit exceeded", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 8,
      currentDailyCostUsd: 93,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.daily_limit_exceeded");
  assert.equal(result.violatedScope, "daily");
});

test("BudgetGuard evaluateExecutionChain blocks on monthly limit exceeded", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 8,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 995,
    },
  });

  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.monthly_limit_exceeded");
  assert.equal(result.violatedScope, "monthly");
});

test("ChargebackService is instantiable with source", () => {
  const mockSource: ChargebackReportSource = {
    listReports: () => [],
  };
  const service = new ChargebackService(mockSource);
  assert.ok(service instanceof ChargebackService);
});

test("ChargebackService.buildReport returns empty report when no data", () => {
  const mockSource: ChargebackReportSource = {
    listReports: () => [],
  };
  const service = new ChargebackService(mockSource);
  const report = service.buildReport({});

  assert.equal(report.totalCostUsd, 0);
  assert.equal(report.reportCount, 0);
  assert.deepEqual(report.allocations, []);
  assert.equal(report.tenantId, null);
});

test("ChargebackService.buildReport aggregates costs correctly", () => {
  const mockSource: ChargebackReportSource = {
    listReports: (limit?: number, tenantId?: string | null) => [
      {
        periodStart: "2024-01-01",
        periodEnd: "2024-01-31",
        tenantId: "tenant-1",
        currency: "USD",
        totalCostUsd: 100,
        resourceCosts: [
          { resourceId: "res-1", resourceType: "token", currency: "USD", costUsd: 60 },
          { resourceId: "res-2", resourceType: "token", currency: "USD", costUsd: 40 },
        ],
      },
    ],
  };

  const service = new ChargebackService(mockSource);
  const report = service.buildReport({ tenantId: "tenant-1" });

  assert.equal(report.totalCostUsd, 100);
  assert.equal(report.reportCount, 1);
  assert.equal(report.tenantId, "tenant-1");
  assert.equal(report.currency, "USD");
});

test("ChargebackService.buildReport uses default limit of 500", () => {
  let capturedLimit = 0;
  const mockSource: ChargebackReportSource = {
    listReports: (limit?: number) => {
      capturedLimit = limit ?? 0;
      return [];
    },
  };

  const service = new ChargebackService(mockSource);
  service.buildReport({});

  assert.equal(capturedLimit, 500);
});

test("ChargebackService.buildReport respects custom limit", () => {
  let capturedLimit = 0;
  const mockSource: ChargebackReportSource = {
    listReports: (limit?: number) => {
      capturedLimit = limit ?? 0;
      return [];
    },
  };

  const service = new ChargebackService(mockSource);
  service.buildReport({ limit: 100 });

  assert.equal(capturedLimit, 100);
});

test("BudgetPolicy mode accepts supervised, auto, and full-auto", () => {
  const policySupervised: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };
  assert.equal(policySupervised.mode, "supervised");

  const policyAuto: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "auto",
  };
  assert.equal(policyAuto.mode, "auto");

  const policyFullAuto: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "full-auto",
  };
  assert.equal(policyFullAuto.mode, "full-auto");
});

test("BudgetGuardResult structure for allowed request", () => {
  const result: BudgetGuardResult = {
    allowed: true,
    requiresApproval: false,
    reasonCode: null,
    remainingBudgetUsd: 5,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, false);
  assert.equal(result.reasonCode, null);
  assert.equal(result.remainingBudgetUsd, 5);
});

test("BudgetGuardResult structure for blocked request", () => {
  const result: BudgetGuardResult = {
    allowed: false,
    requiresApproval: false,
    reasonCode: "budget.task_limit_exceeded",
    remainingBudgetUsd: 0,
  };
  assert.equal(result.allowed, false);
  assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});

test("BudgetGuardResult structure for approval required", () => {
  const result: BudgetGuardResult = {
    allowed: true,
    requiresApproval: true,
    reasonCode: "budget.approaching_limit",
    remainingBudgetUsd: 1,
  };
  assert.equal(result.allowed, true);
  assert.equal(result.requiresApproval, true);
  assert.equal(result.reasonCode, "budget.approaching_limit");
});

test("BudgetGuardCascadeResult structure", () => {
  const result: BudgetGuardCascadeResult = {
    allowed: true,
    requiresApproval: false,
    reasonCode: null,
    remainingBudgetUsd: 5,
    projectedTaskCostUsd: 5,
    projectedDailyCostUsd: 55,
    projectedMonthlyCostUsd: 505,
    violatedScope: null,
    warningScopes: [],
  };

  assert.equal(result.allowed, true);
  assert.equal(result.projectedTaskCostUsd, 5);
  assert.equal(result.violatedScope, null);
  assert.deepEqual(result.warningScopes, []);
});

test("ChargebackAllocation structure is correct", () => {
  const allocation: ChargebackAllocation = {
    allocationKey: "platform:token:res-1:USD",
    tenantId: null,
    resourceId: "res-1",
    resourceType: "token",
    currency: "USD",
    costUsd: 100,
    reportCount: 1,
    firstPeriodStart: "2024-01-01",
    latestPeriodEnd: "2024-01-31",
  };

  assert.equal(allocation.allocationKey, "platform:token:res-1:USD");
  assert.equal(allocation.costUsd, 100);
});

test("BudgetGuard remaining budget never negative when limit exceeded", () => {
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
    currentTaskCostUsd: 20,
    nextEstimatedCostUsd: 5,
  });

  assert.equal(result.allowed, false);
  assert.ok(result.remainingBudgetUsd >= 0);
});

test("BudgetGuard evaluateExecutionChain calculates correct remaining budget", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 2,
      nextEstimatedCostUsd: 3,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });

  // remainingBudgetUsd = min(10-5, 100-53, 1000-503) = min(5, 47, 497) = 5
  assert.ok(result.remainingBudgetUsd === 5);
});

test("BudgetGuard evaluateExecutionChain sets warning scopes at threshold", () => {
  const guard = new BudgetGuard();
  const policy: BudgetPolicy = {
    maxTaskCostUsd: 10,
    maxDailyCostUsd: 100,
    maxMonthlyCostUsd: 1000,
    warnAtRatio: 0.8,
    mode: "supervised",
  };

  // Projected task cost = 8 (exactly at 80% threshold)
  const result = guard.evaluateExecutionChain({
    policy,
    spend: {
      currentTaskCostUsd: 5,
      nextEstimatedCostUsd: 3,
      currentDailyCostUsd: 50,
      currentMonthlyCostUsd: 500,
    },
  });

  assert.equal(result.allowed, true);
  assert.equal(result.violatedScope, null);
  assert.ok(result.warningScopes.includes("task"));
});