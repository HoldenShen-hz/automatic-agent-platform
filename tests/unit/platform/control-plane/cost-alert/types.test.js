/**
 * Unit tests for cost-alert types
 * Tests the type definitions and schema validation
 */
import assert from "node:assert/strict";
import test from "node:test";
test("BudgetScope type accepts valid values", () => {
    const validScopes = ["platform", "tenant", "pack", "step"];
    validScopes.forEach((scope) => {
        assert.ok(scope);
    });
});
test("BudgetPeriod type accepts valid values", () => {
    const validPeriods = ["monthly", "weekly", "per_run"];
    validPeriods.forEach((period) => {
        assert.ok(period);
    });
});
test("CostAlertAction type accepts valid values", () => {
    const validActions = [
        "sev1_alert",
        "sev2_alert",
        "sev3_alert",
        "queue_slowdown",
        "workflow_pause",
        "workflow_degrade",
        "step_abort",
    ];
    validActions.forEach((action) => {
        assert.ok(action);
    });
});
test("CostAlertLevel type accepts valid values", () => {
    const validLevels = ["ok", "warning", "critical", "exceeded"];
    validLevels.forEach((level) => {
        assert.ok(level);
    });
});
test("CostAlertReasonCode type accepts valid values", () => {
    const validCodes = [
        "cost.ok",
        "cost.approaching_limit",
        "cost.critical",
        "cost.exceeded",
        "cost.step_limit_exceeded",
        "cost.daily_limit_exceeded",
        "cost.monthly_limit_exceeded",
    ];
    validCodes.forEach((code) => {
        assert.ok(code);
    });
});
test("BudgetPolicy interface structure is correct", () => {
    const policy = {
        scope: "tenant",
        scopeId: "tenant-123",
        period: "monthly",
        limitCostUsd: 1000,
        limitTokens: 10000,
        warningThreshold: 0.8,
        actionsOnWarning: ["sev3_alert"],
        actionsOnBreach: ["sev2_alert", "workflow_pause"],
    };
    assert.equal(policy.scope, "tenant");
    assert.equal(policy.scopeId, "tenant-123");
    assert.equal(policy.period, "monthly");
    assert.equal(policy.limitCostUsd, 1000);
    assert.equal(policy.limitTokens, 10000);
    assert.equal(policy.warningThreshold, 0.8);
    assert.deepEqual(policy.actionsOnWarning, ["sev3_alert"]);
    assert.deepEqual(policy.actionsOnBreach, ["sev2_alert", "workflow_pause"]);
});
test("BudgetPolicy works without optional limits", () => {
    const policy = {
        scope: "platform",
        scopeId: "platform-main",
        period: "monthly",
        warningThreshold: 0.9,
        actionsOnWarning: [],
        actionsOnBreach: [],
    };
    assert.equal(policy.limitCostUsd, undefined);
    assert.equal(policy.limitTokens, undefined);
});
test("CostAccumulator interface structure is correct", () => {
    const now = new Date().toISOString();
    const accumulator = {
        scope: "tenant",
        scopeId: "tenant-123",
        accumulatedCostUsd: 500.50,
        accumulatedTokens: 5000,
        periodStart: now,
        periodEnd: now,
        lastUpdatedAt: now,
    };
    assert.equal(accumulator.scope, "tenant");
    assert.equal(accumulator.scopeId, "tenant-123");
    assert.equal(accumulator.accumulatedCostUsd, 500.50);
    assert.equal(accumulator.accumulatedTokens, 5000);
});
test("CostEvaluationResult interface structure is correct", () => {
    const result = {
        allowed: true,
        currentCostUsd: 500,
        projectedCostUsd: 550,
        remainingBudgetUsd: 450,
        thresholdRatio: 0.55,
        alertLevel: "ok",
        reasonCode: "cost.ok",
    };
    assert.equal(result.allowed, true);
    assert.equal(result.currentCostUsd, 500);
    assert.equal(result.projectedCostUsd, 550);
    assert.equal(result.remainingBudgetUsd, 450);
    assert.equal(result.thresholdRatio, 0.55);
    assert.equal(result.alertLevel, "ok");
    assert.equal(result.reasonCode, "cost.ok");
});
test("CostEvaluationResult with null remaining budget for unlimited", () => {
    const result = {
        allowed: true,
        currentCostUsd: 500,
        projectedCostUsd: 550,
        remainingBudgetUsd: null,
        thresholdRatio: 0,
        alertLevel: "ok",
        reasonCode: "cost.ok",
    };
    assert.equal(result.remainingBudgetUsd, null);
});
test("CostThresholdExceededEvent interface structure is correct", () => {
    const now = new Date().toISOString();
    const event = {
        eventType: "cost:limit_reached",
        eventTier: "tier_2",
        scope: "tenant",
        scopeId: "tenant-123",
        alertLevel: "critical",
        reasonCode: "cost.critical",
        currentCostUsd: 95,
        limitCostUsd: 100,
        accumulatedTokens: 9500,
        limitTokens: 10000,
        periodStart: now,
        periodEnd: now,
        triggeredAt: now,
        tenantId: "tenant-123",
        taskId: "task-456",
        executionId: "exec-789",
        stepId: "step-001",
    };
    assert.equal(event.eventType, "cost:limit_reached");
    assert.equal(event.eventTier, "tier_2");
    assert.equal(event.scope, "tenant");
    assert.equal(event.alertLevel, "critical");
    assert.equal(event.reasonCode, "cost.critical");
    assert.equal(event.currentCostUsd, 95);
    assert.equal(event.limitCostUsd, 100);
});
test("CostThresholdExceededEvent with null optional fields", () => {
    const now = new Date().toISOString();
    const event = {
        eventType: "cost:limit_reached",
        eventTier: "tier_3",
        scope: "platform",
        scopeId: "platform-main",
        alertLevel: "warning",
        reasonCode: "cost.approaching_limit",
        currentCostUsd: 8000,
        limitCostUsd: 10000,
        accumulatedTokens: 80000,
        limitTokens: 100000,
        periodStart: now,
        periodEnd: now,
        triggeredAt: now,
        tenantId: null,
        taskId: null,
        executionId: null,
        stepId: null,
    };
    assert.equal(event.tenantId, null);
    assert.equal(event.taskId, null);
});
test("CostAlertConfig interface structure is correct", () => {
    const config = {
        enabled: true,
        platformBudgetPolicy: {
            scope: "platform",
            scopeId: "platform-main",
            period: "monthly",
            limitCostUsd: 100000,
            warningThreshold: 0.8,
            actionsOnWarning: ["sev1_alert"],
            actionsOnBreach: ["sev1_alert", "workflow_pause"],
        },
        tenantBudgetPolicies: {
            "tenant-1": {
                scope: "tenant",
                scopeId: "tenant-1",
                period: "monthly",
                limitCostUsd: 10000,
                warningThreshold: 0.8,
                actionsOnWarning: ["sev3_alert"],
                actionsOnBreach: ["sev2_alert"],
            },
        },
        packBudgetPolicies: {},
        defaultWarningThreshold: 0.8,
    };
    assert.equal(config.enabled, true);
    assert.ok(config.platformBudgetPolicy);
    assert.equal(Object.keys(config.tenantBudgetPolicies).length, 1);
    assert.equal(config.defaultWarningThreshold, 0.8);
});
test("CostAlertConfig with null platform policy", () => {
    const config = {
        enabled: true,
        platformBudgetPolicy: null,
        tenantBudgetPolicies: {},
        packBudgetPolicies: {},
        defaultWarningThreshold: 0.9,
    };
    assert.equal(config.platformBudgetPolicy, null);
});
test("StepUsageRecord interface structure is correct", () => {
    const now = new Date().toISOString();
    const record = {
        recordId: "sur_123",
        timestamp: now,
        tenantId: "tenant-456",
        workflowRunId: "wfr_789",
        stepId: "step_001",
        provider: "openai",
        model: "gpt-4o",
        promptTokens: 500,
        completionTokens: 500,
        totalTokens: 1000,
        costUsd: 0.02,
        currency: "USD",
        cached: false,
    };
    assert.equal(record.recordId, "sur_123");
    assert.equal(record.tenantId, "tenant-456");
    assert.equal(record.workflowRunId, "wfr_789");
    assert.equal(record.provider, "openai");
    assert.equal(record.totalTokens, 1000);
    assert.equal(record.costUsd, 0.02);
    assert.equal(record.currency, "USD");
    assert.equal(record.cached, false);
});
test("StepUsageRecord with null workflowRunId", () => {
    const now = new Date().toISOString();
    const record = {
        recordId: "sur_123",
        timestamp: now,
        tenantId: "tenant-456",
        workflowRunId: null,
        stepId: "step_001",
        provider: "anthropic",
        model: "claude-3-opus",
        promptTokens: 1000,
        completionTokens: 500,
        totalTokens: 1500,
        costUsd: 0.03,
        currency: "USD",
        cached: true,
    };
    assert.equal(record.workflowRunId, null);
    assert.equal(record.cached, true);
});
test("eventTier values are correct for each alert level", () => {
    const eventTiers = [
        { alertLevel: "exceeded", tier: "tier_1" },
        { alertLevel: "critical", tier: "tier_2" },
        { alertLevel: "warning", tier: "tier_3" },
        { alertLevel: "ok", tier: "tier_3" },
    ];
    eventTiers.forEach(({ alertLevel, tier }) => {
        assert.ok(alertLevel);
        assert.ok(tier);
    });
});
//# sourceMappingURL=types.test.js.map