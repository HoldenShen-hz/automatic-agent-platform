import assert from "node:assert/strict";
import test from "node:test";
test("CreateBillingAccountInput structure is correct", () => {
    const input = {
        accountId: "acct_123",
        ownerId: "owner_456",
        workspaceId: "ws_789",
        planId: "plan_basic",
        status: "active",
        createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.accountId, "acct_123");
    assert.equal(input.ownerId, "owner_456");
    assert.equal(input.planId, "plan_basic");
});
test("CreateBillingAccountInput allows minimal definition", () => {
    const input = {
        ownerId: "owner_abc",
        planId: "plan_pro",
    };
    assert.equal(input.accountId, undefined);
    assert.equal(input.workspaceId, undefined);
    assert.equal(input.status, undefined);
});
test("CreateBillingAccountInput allows null workspaceId", () => {
    const input = {
        ownerId: "owner_def",
        workspaceId: null,
        planId: "plan_enterprise",
    };
    assert.equal(input.workspaceId, null);
});
test("EvaluateEntitlementInput structure is correct", () => {
    const input = {
        accountId: "acct_123",
        featureKey: "feature_custom_models",
        metricType: "task_execution",
        requestedQuantity: 1000,
        evaluatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.accountId, "acct_123");
    assert.equal(input.featureKey, "feature_custom_models");
    assert.equal(input.requestedQuantity, 1000);
});
test("EvaluateEntitlementInput allows minimal definition", () => {
    const input = {
        accountId: "acct_456",
        featureKey: "feature_basic",
    };
    assert.equal(input.metricType, undefined);
    assert.equal(input.requestedQuantity, undefined);
});
test("EvaluateEntitlementInput allows null metricType", () => {
    const input = {
        accountId: "acct_789",
        featureKey: "feature_all",
        metricType: null,
    };
    assert.equal(input.metricType, null);
});
test("BillingMetricType accepts all valid values", () => {
    const types = [
        "task_execution",
        "token_usage",
        "artifact_storage_bytes",
        "premium_feature_activation",
    ];
    assert.equal(types.length, 4);
});
test("RecordUsageInput structure is correct", () => {
    const input = {
        accountId: "acct_123",
        subjectId: "subject_456",
        workspaceId: "ws_789",
        tenantId: "tenant_abc",
        taskId: "task_def",
        executionId: "exec_ghi",
        metricType: "task_execution",
        quantity: 10,
        source: "runtime",
        capturedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(input.metricType, "task_execution");
    assert.equal(input.quantity, 10);
    assert.equal(input.source, "runtime");
});
test("RecordUsageInput allows minimal definition", () => {
    const input = {
        accountId: "acct_456",
        metricType: "token_usage",
        quantity: 100,
        source: "api",
    };
    assert.equal(input.subjectId, undefined);
    assert.equal(input.workspaceId, undefined);
});
test("RecordUsageInput allows null optional fields", () => {
    const input = {
        accountId: "acct_789",
        workspaceId: null,
        tenantId: null,
        taskId: null,
        executionId: null,
        metricType: "artifact_storage_bytes",
        quantity: 60,
        source: "gateway",
    };
    assert.equal(input.workspaceId, null);
    assert.equal(input.taskId, null);
});
//# sourceMappingURL=billing-types.test.js.map