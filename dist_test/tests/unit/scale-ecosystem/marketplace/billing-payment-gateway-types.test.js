import assert from "node:assert/strict";
import test from "node:test";
test("CreateBillingCheckoutSessionInput structure is correct", () => {
    const input = {
        invoice: {
            invoiceId: "inv_123",
            accountId: "acc_456",
            workspaceId: null,
            tenantId: "tenant_abc",
            periodId: "2026-04",
            currency: "USD",
            subtotalUsd: 100.00,
            taxUsd: 10.00,
            totalUsd: 110.00,
            status: "draft",
            summaryJson: "{}",
            externalInvoiceRef: null,
            dueAt: "2026-04-15T00:00:00.000Z",
            createdAt: "2026-04-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
            paidAt: null,
        },
        account: {
            accountId: "acc_456",
            ownerId: "user_789",
            planId: "plan_pro",
            status: "active",
            createdAt: "2026-01-01T00:00:00.000Z",
            updatedAt: "2026-04-01T00:00:00.000Z",
        },
        createdAt: "2026-04-01T00:00:00.000Z",
    };
    assert.equal(input.createdAt, "2026-04-01T00:00:00.000Z");
    assert.equal(input.invoice.invoiceId, "inv_123");
    assert.equal(input.account.accountId, "acc_456");
});
test("BillingCheckoutSessionDefinition structure is correct", () => {
    const definition = {
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_123",
        checkoutUrl: "https://checkout.stripe.com/pay/cs_test_123",
        expiresAt: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(definition.gatewayKind, "stripe");
    assert.equal(definition.gatewaySessionRef, "cs_test_123");
    assert.ok(definition.checkoutUrl.startsWith("https://"));
    assert.ok(definition.expiresAt !== null);
});
test("BillingCheckoutSessionDefinition allows null expiresAt", () => {
    const definition = {
        gatewayKind: "manual",
        gatewaySessionRef: "manual_inv_123",
        checkoutUrl: "https://example.com/manual-pay/inv_123",
        expiresAt: null,
    };
    assert.equal(definition.gatewayKind, "manual");
    assert.equal(definition.expiresAt, null);
});
test("BillingPaymentSessionStatusSnapshot structure is correct", () => {
    const snapshot = {
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_456",
        status: "paid",
        occurredAt: "2026-04-14T12:00:00.000Z",
        failureCode: null,
    };
    assert.equal(snapshot.gatewayKind, "stripe");
    assert.equal(snapshot.status, "paid");
    assert.equal(snapshot.occurredAt, "2026-04-14T12:00:00.000Z");
    assert.equal(snapshot.failureCode, null);
});
test("BillingPaymentSessionStatusSnapshot accepts all valid status values", () => {
    const statuses = [
        "pending",
        "paid",
        "expired",
        "cancelled",
        "failed",
    ];
    for (const status of statuses) {
        const snapshot = {
            gatewayKind: "paddle",
            gatewaySessionRef: "trans_test",
            status,
            occurredAt: "2026-04-14T00:00:00.000Z",
        };
        assert.ok(snapshot.status === status);
    }
});
test("BillingPaymentSessionStatusSnapshot allows optional failureCode", () => {
    const snapshotWithCode = {
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_fail",
        status: "failed",
        occurredAt: "2026-04-14T12:00:00.000Z",
        failureCode: "card_declined",
    };
    assert.equal(snapshotWithCode.failureCode, "card_declined");
    const snapshotWithoutCode = {
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_ok",
        status: "pending",
        occurredAt: "2026-04-14T12:00:00.000Z",
    };
    assert.equal(snapshotWithoutCode.failureCode, undefined);
});
test("BillingPaymentGatewayKind type accepts all valid values", () => {
    const kinds = ["stripe", "manual", "paddle"];
    assert.equal(kinds.length, 3);
});
test("ManualBillingPaymentGatewayOptions structure is correct", () => {
    const options = {
        baseUrl: "https://payments.example.com/manual",
    };
    assert.equal(options.baseUrl, "https://payments.example.com/manual");
});
test("ManualBillingPaymentGatewayOptions allows empty options", () => {
    const options = {};
    assert.equal(options.baseUrl, undefined);
});
test("StripeBillingPaymentGatewayOptions structure is correct", () => {
    const options = {
        secretKey: "sk_test_123",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        apiBaseUrl: "https://api.stripe.com",
    };
    assert.equal(options.secretKey, "sk_test_123");
    assert.equal(options.successUrl, "https://example.com/success");
    assert.equal(options.cancelUrl, "https://example.com/cancel");
    assert.equal(options.apiBaseUrl, "https://api.stripe.com");
});
test("StripeBillingPaymentGatewayOptions allows minimal definition", () => {
    const options = {
        secretKey: "sk_test_456",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
    };
    assert.equal(options.secretKey, "sk_test_456");
    assert.equal(options.apiBaseUrl, undefined);
    assert.equal(options.fetchFn, undefined);
});
test("PaddleBillingPaymentGatewayOptions structure is correct", () => {
    const options = {
        apiKey: "paddle_test_789",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
        apiBaseUrl: "https://api.paddle.com",
    };
    assert.equal(options.apiKey, "paddle_test_789");
    assert.equal(options.successUrl, "https://example.com/success");
    assert.equal(options.cancelUrl, "https://example.com/cancel");
    assert.equal(options.apiBaseUrl, "https://api.paddle.com");
});
test("PaddleBillingPaymentGatewayOptions allows minimal definition", () => {
    const options = {
        apiKey: "paddle_test_abc",
        successUrl: "https://example.com/success",
        cancelUrl: "https://example.com/cancel",
    };
    assert.equal(options.apiKey, "paddle_test_abc");
    assert.equal(options.apiBaseUrl, undefined);
    assert.equal(options.fetchFn, undefined);
});
test("BillingPaymentSessionRecord structure is correct", () => {
    const record = {
        sessionId: "session_123",
        invoiceId: "inv_456",
        accountId: "acc_789",
        gatewayKind: "stripe",
        gatewaySessionRef: "cs_test_abc",
        checkoutUrl: "https://checkout.stripe.com/cs_test_abc",
        status: "pending",
        amountUsd: 110.00,
        currency: "USD",
        expiresAt: "2026-04-15T00:00:00.000Z",
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        settledAt: null,
        failureCode: null,
    };
    assert.equal(record.sessionId, "session_123");
    assert.equal(record.gatewayKind, "stripe");
    assert.equal(record.status, "pending");
    assert.equal(record.settledAt, null);
});
test("BillingPaymentSessionRecord allows settled status", () => {
    const record = {
        sessionId: "session_456",
        invoiceId: "inv_789",
        accountId: "acc_000",
        gatewayKind: "paddle",
        gatewaySessionRef: "paddle_trans_123",
        checkoutUrl: "https://checkout.paddle.com/trans_123",
        status: "paid",
        amountUsd: 50.00,
        currency: "USD",
        expiresAt: null,
        createdAt: "2026-04-01T00:00:00.000Z",
        updatedAt: "2026-04-01T00:00:00.000Z",
        settledAt: "2026-04-01T12:00:00.000Z",
        failureCode: null,
    };
    assert.equal(record.status, "paid");
    assert.equal(record.settledAt, "2026-04-01T12:00:00.000Z");
});
//# sourceMappingURL=billing-payment-gateway-types.test.js.map