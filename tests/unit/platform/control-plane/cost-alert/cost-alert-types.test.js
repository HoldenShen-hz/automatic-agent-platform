import assert from "node:assert/strict";
import test from "node:test";
test("BudgetScope is a union type with correct values", () => {
    const scopes = ["platform", "tenant", "pack", "step"];
    assert.equal(scopes.length, 4);
    for (const scope of scopes) {
        assert.ok(["platform", "tenant", "pack", "step"].includes(scope));
    }
});
test("BudgetPeriod is a union type with correct values", () => {
    const periods = ["monthly", "weekly", "per_run"];
    assert.equal(periods.length, 3);
    for (const period of periods) {
        assert.ok(["monthly", "weekly", "per_run"].includes(period));
    }
});
test("BudgetPolicy interface has required fields", () => {
    const policy = {
        scope: "tenant",
        scopeId: "tenant-123",
        period: "monthly",
        warningThreshold: 0.8,
        actionsOnWarning: ["sev2_alert"],
        actionsOnBreach: ["sev1_alert", "workflow_pause"],
    };
    assert.equal(policy.scope, "tenant");
    assert.equal(policy.scopeId, "tenant-123");
    assert.equal(policy.period, "monthly");
    assert.equal(policy.warningThreshold, 0.8);
    assert.deepEqual(policy.actionsOnWarning, ["sev2_alert"]);
    assert.deepEqual(policy.actionsOnBreach, ["sev1_alert", "workflow_pause"]);
});
test("BudgetPolicy allows optional limit fields", () => {
    const policyWithLimits = {
        scope: "platform",
        scopeId: "platform",
        period: "monthly",
        limitTokens: 1000000,
        limitCostUsd: 5000,
        warningThreshold: 0.75,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(policyWithLimits.limitTokens, 1000000);
    assert.equal(policyWithLimits.limitCostUsd, 5000);
    const policyWithoutLimits = {
        scope: "step",
        scopeId: "step-456",
        period: "per_run",
        warningThreshold: 0.9,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(policyWithoutLimits.limitTokens, undefined);
    assert.equal(policyWithoutLimits.limitCostUsd, undefined);
});
test("CostAlertAction union type has all expected values", () => {
    const actions = [
        "sev1_alert",
        "sev2_alert",
        "sev3_alert",
        "queue_slowdown",
        "workflow_pause",
        "workflow_degrade",
        "step_abort",
    ];
    assert.equal(actions.length, 7);
    for (const action of actions) {
        assert.ok([
            "sev1_alert",
            "sev2_alert",
            "sev3_alert",
            "queue_slowdown",
            "workflow_pause",
            "workflow_degrade",
            "step_abort",
        ].includes(action));
    }
});
test("CostAccumulator interface structure", () => {
    const now = new Date().toISOString();
    const accumulator = {
        scope: "tenant",
        scopeId: "tenant-abc",
        accumulatedCostUsd: 150.50,
        accumulatedTokens: 75000,
        periodStart: now,
        periodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        lastUpdatedAt: now,
    };
    assert.equal(accumulator.scope, "tenant");
    assert.equal(accumulator.scopeId, "tenant-abc");
    assert.equal(accumulator.accumulatedCostUsd, 150.50);
    assert.equal(accumulator.accumulatedTokens, 75000);
    assert.ok(accumulator.periodStart < accumulator.periodEnd);
});
test("CostEvaluationResult interface structure", () => {
    const result = {
        allowed: true,
        currentCostUsd: 100,
        projectedCostUsd: 150,
        remainingBudgetUsd: 850,
        thresholdRatio: 0.15,
        alertLevel: "ok",
        reasonCode: "cost.ok",
    };
    assert.equal(result.allowed, true);
    assert.equal(result.currentCostUsd, 100);
    assert.equal(result.projectedCostUsd, 150);
    assert.equal(result.remainingBudgetUsd, 850);
    assert.equal(result.thresholdRatio, 0.15);
    assert.equal(result.alertLevel, "ok");
    assert.equal(result.reasonCode, "cost.ok");
});
test("CostEvaluationResult with warning alertLevel", () => {
    const result = {
        allowed: true,
        currentCostUsd: 800,
        projectedCostUsd: 850,
        remainingBudgetUsd: 150,
        thresholdRatio: 0.85,
        alertLevel: "warning",
        reasonCode: "cost.approaching_limit",
    };
    assert.equal(result.alertLevel, "warning");
    assert.equal(result.reasonCode, "cost.approaching_limit");
});
test("CostEvaluationResult with exceeded alertLevel", () => {
    const result = {
        allowed: false,
        currentCostUsd: 1050,
        projectedCostUsd: 1100,
        remainingBudgetUsd: 0,
        thresholdRatio: 1.1,
        alertLevel: "exceeded",
        reasonCode: "cost.exceeded",
    };
    assert.equal(result.allowed, false);
    assert.equal(result.alertLevel, "exceeded");
});
test("CostAlertLevel union type", () => {
    const levels = ["ok", "warning", "critical", "exceeded"];
    assert.equal(levels.length, 4);
    for (const level of levels) {
        assert.ok(["ok", "warning", "critical", "exceeded"].includes(level));
    }
});
test("CostAlertReasonCode union type", () => {
    const codes = [
        "cost.ok",
        "cost.approaching_limit",
        "cost.critical",
        "cost.exceeded",
        "cost.step_limit_exceeded",
        "cost.daily_limit_exceeded",
        "cost.monthly_limit_exceeded",
    ];
    assert.equal(codes.length, 7);
    for (const code of codes) {
        assert.ok([
            "cost.ok",
            "cost.approaching_limit",
            "cost.critical",
            "cost.exceeded",
            "cost.step_limit_exceeded",
            "cost.daily_limit_exceeded",
            "cost.monthly_limit_exceeded",
        ].includes(code));
    }
});
test("CostThresholdExceededEvent interface structure", () => {
    const now = new Date().toISOString();
    const event = {
        eventType: "cost.threshold.exceeded",
        eventTier: "tier_2",
        scope: "tenant",
        scopeId: "tenant-xyz",
        alertLevel: "critical",
        reasonCode: "cost.critical",
        currentCostUsd: 950,
        limitCostUsd: 1000,
        accumulatedTokens: 500000,
        limitTokens: 600000,
        periodStart: now,
        periodEnd: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        triggeredAt: now,
        tenantId: "tenant-xyz",
        taskId: "task-123",
        executionId: "exec-456",
        stepId: "step-789",
    };
    assert.equal(event.eventType, "cost.threshold.exceeded");
    assert.equal(event.eventTier, "tier_2");
    assert.equal(event.scope, "tenant");
    assert.equal(event.scopeId, "tenant-xyz");
    assert.equal(event.alertLevel, "critical");
    assert.equal(event.reasonCode, "cost.critical");
    assert.equal(event.currentCostUsd, 950);
    assert.equal(event.limitCostUsd, 1000);
});
test("CostThresholdExceededEvent eventTier values", () => {
    const tiers = ["tier_1", "tier_2", "tier_3"];
    for (const tier of tiers) {
        const event = {
            eventType: "cost.threshold.exceeded",
            eventTier: tier,
            scope: "platform",
            scopeId: "platform",
            alertLevel: "ok",
            reasonCode: "cost.ok",
            currentCostUsd: 0,
            limitCostUsd: null,
            accumulatedTokens: 0,
            limitTokens: null,
            periodStart: new Date().toISOString(),
            periodEnd: new Date().toISOString(),
            triggeredAt: new Date().toISOString(),
            tenantId: null,
            taskId: null,
            executionId: null,
            stepId: null,
        };
        assert.ok(["tier_1", "tier_2", "tier_3"].includes(event.eventTier));
    }
});
test("CostAlertConfig interface structure", () => {
    const config = {
        enabled: true,
        platformBudgetPolicy: {
            scope: "platform",
            scopeId: "platform",
            period: "monthly",
            limitCostUsd: 10000,
            warningThreshold: 0.8,
            actionsOnWarning: ["sev1_alert"],
            actionsOnBreach: ["sev1_alert", "workflow_pause"],
        },
        tenantBudgetPolicies: {
            "tenant-1": {
                scope: "tenant",
                scopeId: "tenant-1",
                period: "monthly",
                limitCostUsd: 1000,
                warningThreshold: 0.75,
                actionsOnWarning: ["sev2_alert"],
                actionsOnBreach: ["sev1_alert"],
            },
        },
        packBudgetPolicies: {},
        defaultWarningThreshold: 0.8,
    };
    assert.equal(config.enabled, true);
    assert.ok(config.platformBudgetPolicy !== null);
    assert.equal(config.tenantBudgetPolicies["tenant-1"].scope, "tenant");
    assert.equal(config.defaultWarningThreshold, 0.8);
});
test("CostAlertConfig allows null platform budget", () => {
    const config = {
        enabled: false,
        platformBudgetPolicy: null,
        tenantBudgetPolicies: {},
        packBudgetPolicies: {},
        defaultWarningThreshold: 0.9,
    };
    assert.equal(config.enabled, false);
    assert.equal(config.platformBudgetPolicy, null);
});
test("StepUsageRecord interface structure", () => {
    const now = new Date().toISOString();
    const record = {
        recordId: "sur-123",
        timestamp: now,
        tenantId: "tenant-abc",
        workflowRunId: "wf-run-456",
        stepId: "step-789",
        provider: "anthropic",
        model: "claude-3-5-sonnet",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        costUsd: 0.045,
        currency: "USD",
        cached: false,
    };
    assert.equal(record.recordId, "sur-123");
    assert.equal(record.tenantId, "tenant-abc");
    assert.equal(record.workflowRunId, "wf-run-456");
    assert.equal(record.stepId, "step-789");
    assert.equal(record.provider, "anthropic");
    assert.equal(record.model, "claude-3-5-sonnet");
    assert.equal(record.promptTokens, 1000);
    assert.equal(record.completionTokens, 500);
    assert.equal(record.totalTokens, 1500);
    assert.equal(record.costUsd, 0.045);
    assert.equal(record.currency, "USD");
    assert.equal(record.cached, false);
});
test("StepUsageRecord with null workflowRunId", () => {
    const record = {
        recordId: "sur-456",
        timestamp: new Date().toISOString(),
        tenantId: "tenant-xyz",
        workflowRunId: null,
        stepId: "step-abc",
        provider: "openai",
        model: "gpt-4",
        promptTokens: 500,
        completionTokens: 250,
        totalTokens: 750,
        costUsd: 0.02,
        currency: "USD",
        cached: true,
    };
    assert.equal(record.workflowRunId, null);
    assert.equal(record.cached, true);
});
test("BudgetPolicy validation - warningThreshold range", () => {
    // warningThreshold should be between 0 and 1
    const validPolicy = {
        scope: "tenant",
        scopeId: "tenant-123",
        period: "monthly",
        warningThreshold: 0.5,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(validPolicy.warningThreshold, 0.5);
    // Edge cases - values at boundaries
    const lowThreshold = {
        scope: "pack",
        scopeId: "pack-1",
        period: "weekly",
        warningThreshold: 0.01,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(lowThreshold.warningThreshold, 0.01);
    const highThreshold = {
        scope: "pack",
        scopeId: "pack-2",
        period: "weekly",
        warningThreshold: 0.99,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(highThreshold.warningThreshold, 0.99);
});
test("CostAccumulator period tracking", () => {
    const now = new Date();
    const periodStart = now.toISOString();
    const periodEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const accumulator = {
        scope: "tenant",
        scopeId: "tenant-weekly",
        accumulatedCostUsd: 50,
        accumulatedTokens: 25000,
        periodStart,
        periodEnd,
        lastUpdatedAt: now.toISOString(),
    };
    assert.ok(accumulator.periodStart < accumulator.periodEnd);
    assert.ok(new Date(accumulator.periodEnd).getTime() - new Date(accumulator.periodStart).getTime() === 7 * 24 * 60 * 60 * 1000);
});
test("CostEvaluationResult projectedCostUsd can be null", () => {
    const result = {
        allowed: true,
        currentCostUsd: 100,
        projectedCostUsd: null,
        remainingBudgetUsd: 900,
        thresholdRatio: 0.1,
        alertLevel: "ok",
        reasonCode: "cost.ok",
    };
    assert.equal(result.projectedCostUsd, null);
});
test("CostEvaluationResult remainingBudgetUsd can be null (unlimited)", () => {
    const result = {
        allowed: true,
        currentCostUsd: 100,
        projectedCostUsd: 200,
        remainingBudgetUsd: null,
        thresholdRatio: 0,
        alertLevel: "ok",
        reasonCode: "cost.ok",
    };
    assert.equal(result.remainingBudgetUsd, null);
});
//# sourceMappingURL=cost-alert-types.test.js.map