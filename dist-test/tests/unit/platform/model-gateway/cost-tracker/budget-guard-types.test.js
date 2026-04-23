import assert from "node:assert/strict";
import test from "node:test";
test("BudgetPolicy structure is correct", () => {
    const policy = {
        maxTaskCostUsd: 1.0,
        maxDailyCostUsd: 10.0,
        maxMonthlyCostUsd: 100.0,
        warnAtRatio: 0.8,
        mode: "supervised",
    };
    assert.equal(policy.maxTaskCostUsd, 1.0);
    assert.equal(policy.warnAtRatio, 0.8);
});
test("BudgetPolicy mode accepts all valid values", () => {
    const modes = ["supervised", "auto", "full-auto"];
    assert.equal(modes.length, 3);
});
test("BudgetPolicy allows different mode values", () => {
    const supervisedPolicy = {
        maxTaskCostUsd: 0.5,
        maxDailyCostUsd: 5.0,
        maxMonthlyCostUsd: 50.0,
        warnAtRatio: 0.9,
        mode: "supervised",
    };
    assert.equal(supervisedPolicy.mode, "supervised");
    const autoPolicy = {
        maxTaskCostUsd: 0.5,
        maxDailyCostUsd: 5.0,
        maxMonthlyCostUsd: 50.0,
        warnAtRatio: 0.9,
        mode: "auto",
    };
    assert.equal(autoPolicy.mode, "auto");
    const fullAutoPolicy = {
        maxTaskCostUsd: 0.5,
        maxDailyCostUsd: 5.0,
        maxMonthlyCostUsd: 50.0,
        warnAtRatio: 0.9,
        mode: "full-auto",
    };
    assert.equal(fullAutoPolicy.mode, "full-auto");
});
test("BudgetGuardResult structure for allowed request", () => {
    const result = {
        allowed: true,
        requiresApproval: false,
        reasonCode: null,
        remainingBudgetUsd: 0.5,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.reasonCode, null);
});
test("BudgetGuardResult structure for request requiring approval", () => {
    const result = {
        allowed: true,
        requiresApproval: true,
        reasonCode: "budget.approaching_limit",
        remainingBudgetUsd: 0.1,
    };
    assert.equal(result.allowed, true);
    assert.equal(result.requiresApproval, true);
    assert.equal(result.reasonCode, "budget.approaching_limit");
});
test("BudgetGuardResult structure for blocked request", () => {
    const result = {
        allowed: false,
        requiresApproval: false,
        reasonCode: "budget.task_limit_exceeded",
        remainingBudgetUsd: 0,
    };
    assert.equal(result.allowed, false);
    assert.equal(result.requiresApproval, false);
    assert.equal(result.reasonCode, "budget.task_limit_exceeded");
});
test("BudgetGuardResult remainingBudgetUsd can be zero", () => {
    const result = {
        allowed: false,
        requiresApproval: false,
        reasonCode: "budget.task_limit_exceeded",
        remainingBudgetUsd: 0,
    };
    assert.equal(result.remainingBudgetUsd, 0);
});
//# sourceMappingURL=budget-guard-types.test.js.map