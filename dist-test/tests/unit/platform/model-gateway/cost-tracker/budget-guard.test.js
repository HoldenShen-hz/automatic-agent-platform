import assert from "node:assert/strict";
import test from "node:test";
import { BudgetGuard } from "../../../../../src/platform/model-gateway/cost-tracker/budget-guard.js";
test("BudgetGuard evaluateTaskSpend allows when under budget", () => {
    const guard = new BudgetGuard();
    const policy = {
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
    const policy = {
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
    const policy = {
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
    const policy = {
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
    const policy = {
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
    const policy = {
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
    const policy = {
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
    const policy = {
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
//# sourceMappingURL=budget-guard.test.js.map