import assert from "node:assert/strict";
import test from "node:test";
test("BillingAccountRecord structure is correct", () => {
    const record = {
        accountId: "acct_123",
        ownerId: "owner_456",
        workspaceId: "ws_789",
        planId: "plan_pro",
        status: "active",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.accountId, "acct_123");
    assert.equal(record.planId, "plan_pro");
    assert.equal(record.status, "active");
});
test("BillingAccountRecord allows null workspaceId", () => {
    const record = {
        accountId: "acct_no_ws",
        ownerId: "owner_abc",
        workspaceId: null,
        planId: "plan_basic",
        status: "suspended",
        createdAt: "2026-01-01T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.workspaceId, null);
    assert.equal(record.status, "suspended");
});
test("BillingAccountStatus accepts all valid values", () => {
    const statuses = ["active", "suspended", "cancelled"];
    assert.equal(statuses.length, 3);
});
test("BillingInvoiceRecord structure is correct", () => {
    const record = {
        invoiceId: "inv_123",
        accountId: "acct_456",
        workspaceId: "ws_789",
        tenantId: "tenant_abc",
        periodId: "2026-04",
        currency: "USD",
        subtotalUsd: 99.99,
        taxUsd: 8.75,
        totalUsd: 108.74,
        status: "open",
        summaryJson: '{"lineItems":10}',
        externalInvoiceRef: "stripe_inv_xyz",
        dueAt: "2026-04-30T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        paidAt: null,
    };
    assert.equal(record.invoiceId, "inv_123");
    assert.equal(record.status, "open");
    assert.equal(record.currency, "USD");
    assert.equal(record.totalUsd, 108.74);
});
test("BillingInvoiceRecord allows paid status with paidAt", () => {
    const record = {
        invoiceId: "inv_paid",
        accountId: "acct_paid",
        workspaceId: null,
        tenantId: null,
        periodId: "2026-03",
        currency: "USD",
        subtotalUsd: 49.99,
        taxUsd: 4.38,
        totalUsd: 54.37,
        status: "paid",
        summaryJson: "{}",
        externalInvoiceRef: "stripe_paid",
        dueAt: "2026-03-31T00:00:00.000Z",
        createdAt: "2026-03-01T00:00:00.000Z",
        updatedAt: "2026-03-15T00:00:00.000Z",
        paidAt: "2026-03-15T14:30:00.000Z",
    };
    assert.equal(record.status, "paid");
    assert.ok(record.paidAt !== null);
});
test("BillingInvoiceStatus accepts all valid values", () => {
    const statuses = ["draft", "open", "paid", "void"];
    assert.equal(statuses.length, 4);
});
test("BillingPaymentSessionRecord structure is correct", () => {
    const record = {
        sessionId: "sess_123",
        invoiceId: "inv_456",
        accountId: "acct_789",
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_abc",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_abc",
        status: "pending",
        amountUsd: 108.74,
        currency: "USD",
        expiresAt: "2026-04-15T00:00:00.000Z",
        createdAt: "2026-04-14T00:00:00.000Z",
        updatedAt: "2026-04-14T00:00:00.000Z",
        settledAt: null,
        failureCode: null,
    };
    assert.equal(record.sessionId, "sess_123");
    assert.equal(record.gatewayKind, "stripe");
    assert.equal(record.status, "pending");
});
test("BillingPaymentSessionRecord allows settled session", () => {
    const record = {
        sessionId: "sess_settled",
        invoiceId: "inv_settled",
        accountId: "acct_settled",
        gatewayKind: "paddle",
        gatewaySessionRef: "paddle_xyz",
        checkoutUrl: "https://pay.paddle.com/subscription_xyz",
        status: "paid",
        amountUsd: 49.99,
        currency: "USD",
        expiresAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:05:00.000Z",
        settledAt: "2026-04-01T00:04:30.000Z",
        failureCode: null,
    };
    assert.equal(record.status, "paid");
    assert.ok(record.settledAt !== null);
});
test("BillingPaymentSessionRecord allows failed session", () => {
    const record = {
        sessionId: "sess_failed",
        invoiceId: "inv_failed",
        accountId: "acct_failed",
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_failed",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_failed",
        status: "failed",
        amountUsd: 199.99,
        currency: "USD",
        expiresAt: "2026-04-14T12:00:00.000Z",
        createdAt: "2026-04-14T10:00:00.000Z",
        updatedAt: "2026-04-14T11:00:00.000Z",
        settledAt: null,
        failureCode: "card_declined",
    };
    assert.equal(record.status, "failed");
    assert.equal(record.failureCode, "card_declined");
});
test("BillingPaymentGatewayKind accepts all valid values", () => {
    const kinds = ["manual", "stripe", "paddle"];
    assert.equal(kinds.length, 3);
});
test("BillingPaymentSessionStatus accepts all valid values", () => {
    const statuses = ["pending", "paid", "expired", "cancelled", "failed"];
    assert.equal(statuses.length, 5);
});
test("UsageEventRecord structure is correct", () => {
    const record = {
        usageId: "usage_123",
        accountId: "acct_456",
        subjectId: "subject_789",
        workspaceId: "ws_abc",
        tenantId: "tenant_def",
        taskId: "task_ghi",
        executionId: "exec_jkl",
        stepId: null,
        metricType: "task_execution",
        quantity: 100,
        source: "runtime",
        unitPriceUsd: 0.01,
        capturedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.usageId, "usage_123");
    assert.equal(record.metricType, "task_execution");
    assert.equal(record.quantity, 100);
    assert.equal(record.source, "runtime");
});
test("UsageEventRecord allows null optional fields", () => {
    const record = {
        usageId: "usage_min",
        accountId: "acct_min",
        subjectId: "subject_min",
        workspaceId: null,
        tenantId: null,
        taskId: null,
        executionId: null,
        stepId: null,
        metricType: "token_usage",
        quantity: 5000,
        source: "api",
        unitPriceUsd: 0.0001,
        capturedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.workspaceId, null);
    assert.equal(record.taskId, null);
});
test("BillingUsageSource accepts all valid values", () => {
    const sources = ["runtime", "api", "gateway", "admin"];
    assert.equal(sources.length, 4);
});
test("QuotaCounterRecord structure is correct", () => {
    const record = {
        counterId: "counter_123",
        accountId: "acct_456",
        metricType: "task_execution",
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-04-30T23:59:59.999Z",
        usedQuantity: 500,
        limitQuantity: 1000,
        limitType: "soft",
        resetPolicy: "calendar_month",
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.counterId, "counter_123");
    assert.equal(record.usedQuantity, 500);
    assert.equal(record.limitQuantity, 1000);
    assert.equal(record.limitType, "soft");
});
test("QuotaCounterRecord allows null limit fields", () => {
    const record = {
        counterId: "counter_unlimited",
        accountId: "acct_unlimited",
        metricType: "api_calls",
        windowStart: "2026-04-01T00:00:00.000Z",
        windowEnd: "2026-04-30T23:59:59.999Z",
        usedQuantity: 10000,
        limitQuantity: null,
        limitType: null,
        resetPolicy: null,
        updatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.limitQuantity, null);
    assert.equal(record.limitType, null);
});
test("BillingLimitType accepts all valid values", () => {
    const types = ["hard", "soft", "burst"];
    assert.equal(types.length, 3);
});
test("BillingResetPolicy accepts all valid values", () => {
    const policies = ["calendar_month"];
    assert.equal(policies.length, 1);
});
test("LedgerEntryRecord structure is correct", () => {
    const record = {
        entryId: "entry_123",
        accountId: "acct_456",
        usageId: "usage_789",
        periodId: "2026-04",
        entryType: "usage_charge",
        amountUsd: -5.50,
        currency: "USD",
        sourceRef: "usage_789",
        recordedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.entryId, "entry_123");
    assert.equal(record.entryType, "usage_charge");
    assert.equal(record.amountUsd, -5.50);
});
test("LedgerEntryRecord allows credit entry", () => {
    const record = {
        entryId: "entry_credit",
        accountId: "acct_credit",
        usageId: null,
        periodId: "2026-04",
        entryType: "credit",
        amountUsd: 50.00,
        currency: "USD",
        sourceRef: "promo_code",
        recordedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.entryType, "credit");
    assert.equal(record.amountUsd, 50.00);
    assert.equal(record.usageId, null);
});
test("LedgerEntryRecord entryType accepts all values", () => {
    const types = ["usage_charge", "adjustment", "credit", "refund"];
    assert.equal(types.length, 4);
});
test("EntitlementDecisionRecord structure is correct", () => {
    const record = {
        decisionId: "dec_123",
        accountId: "acct_456",
        featureKey: "feature_custom_models",
        metricType: "task_execution",
        requestedQuantity: 1000,
        allowed: 500,
        decisionType: "degrade",
        reasonCode: "quota_approaching_limit",
        policyVersion: "v2.1.0",
        evaluatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.decisionId, "dec_123");
    assert.equal(record.decisionType, "degrade");
    assert.equal(record.allowed, 500);
});
test("EntitlementDecisionRecord allows null optional fields", () => {
    const record = {
        decisionId: "dec_min",
        accountId: "acct_min",
        featureKey: "feature_basic",
        metricType: null,
        requestedQuantity: null,
        allowed: 100,
        decisionType: "allow",
        reasonCode: "within_limits",
        policyVersion: "v1.0.0",
        evaluatedAt: "2026-04-14T00:00:00.000Z",
    };
    assert.equal(record.metricType, null);
    assert.equal(record.requestedQuantity, null);
    assert.equal(record.decisionType, "allow");
});
test("EntitlementDecisionType accepts all valid values", () => {
    const types = ["allow", "deny", "degrade", "warn"];
    assert.equal(types.length, 4);
});
//# sourceMappingURL=billing-types.test.js.map