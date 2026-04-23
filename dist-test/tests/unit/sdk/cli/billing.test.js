/**
 * Billing CLI Tests
 *
 * Tests for billing CLI module which handles account management, usage recording,
 * entitlement evaluation, invoice handling, and payment session reconciliation.
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadBillingCliEnv } from "../../../../src/platform/control-plane/config-center/billing-env.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";
describe("loadBillingCliEnv", () => {
    it("parses create_account action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "create_account",
            AA_DB_PATH: "/tmp/test.db",
            AA_OWNER_ID: "owner-123",
            AA_WORKSPACE_ID: "ws-456",
            AA_PLAN_ID: "plan-basic",
            AA_ACCOUNT_STATUS: "active",
        });
        assert.equal(config.action, "create_account");
        assert.equal(config.ownerId, "owner-123");
        assert.equal(config.workspaceId, "ws-456");
        assert.equal(config.planId, "plan-basic");
        assert.equal(config.accountStatus, "active");
    });
    it("parses evaluate action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "evaluate",
            AA_DB_PATH: "/tmp/test.db",
            AA_ACCOUNT_ID: "acc-123",
            AA_FEATURE_KEY: "feature-x",
            AA_METRIC_TYPE: "task_execution",
        });
        assert.equal(config.action, "evaluate");
        assert.equal(config.accountId, "acc-123");
        assert.equal(config.featureKey, "feature-x");
        assert.equal(config.metricType, "task_execution");
    });
    it("parses usage action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "usage",
            AA_DB_PATH: "/tmp/test.db",
            AA_ACCOUNT_ID: "acc-123",
            AA_WORKSPACE_ID: "ws-456",
            AA_TENANT_ID: "tenant-789",
            AA_METRIC_TYPE: "task_execution",
            AA_QUANTITY: "100",
            AA_SOURCE: "cli-test",
        });
        assert.equal(config.action, "usage");
        assert.equal(config.accountId, "acc-123");
        assert.equal(config.workspaceId, "ws-456");
        assert.equal(config.tenantId, "tenant-789");
        assert.equal(config.metricType, "task_execution");
        assert.equal(config.quantity, 100);
        assert.equal(config.source, "cli-test");
    });
    it("parses summary action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "summary",
            AA_DB_PATH: "/tmp/test.db",
            AA_ACCOUNT_ID: "acc-123",
        });
        assert.equal(config.action, "summary");
        assert.equal(config.accountId, "acc-123");
    });
    it("parses create_invoice action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "create_invoice",
            AA_DB_PATH: "/tmp/test.db",
            AA_ACCOUNT_ID: "acc-123",
            AA_TENANT_ID: "tenant-789",
        });
        assert.equal(config.action, "create_invoice");
        assert.equal(config.accountId, "acc-123");
        assert.equal(config.tenantId, "tenant-789");
    });
    it("parses list_invoices action with limit", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "list_invoices",
            AA_DB_PATH: "/tmp/test.db",
            AA_ACCOUNT_ID: "acc-123",
            AA_LIMIT: "50",
        });
        assert.equal(config.action, "list_invoices");
        assert.equal(config.accountId, "acc-123");
        assert.equal(config.limit, 50);
    });
    it("parses list_payment_sessions action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "list_payment_sessions",
            AA_DB_PATH: "/tmp/test.db",
            AA_INVOICE_ID: "inv-123",
            AA_LIMIT: "50",
        });
        assert.equal(config.action, "list_payment_sessions");
        assert.equal(config.invoiceId, "inv-123");
        assert.equal(config.limit, 50);
    });
    it("parses reconcile_pending action", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "reconcile_pending",
            AA_DB_PATH: "/tmp/test.db",
            AA_TENANT_ID: "tenant-789",
        });
        assert.equal(config.action, "reconcile_pending");
        assert.equal(config.tenantId, "tenant-789");
    });
    it("parses stripe payment gateway configuration", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "create_checkout",
            AA_DB_PATH: "/tmp/test.db",
            AA_PAYMENT_GATEWAY_KIND: "stripe",
            AA_STRIPE_SECRET_KEY: "sk_test_xxx",
            AA_BILLING_SUCCESS_URL: "https://success.example.com",
            AA_BILLING_CANCEL_URL: "https://cancel.example.com",
        });
        assert.equal(config.paymentGatewayKind, "stripe");
        assert.equal(config.stripeSecretKey, "sk_test_xxx");
        assert.equal(config.stripeSuccessUrl, "https://success.example.com");
        assert.equal(config.stripeCancelUrl, "https://cancel.example.com");
    });
    it("parses paddle payment gateway configuration", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "create_checkout",
            AA_DB_PATH: "/tmp/test.db",
            AA_PAYMENT_GATEWAY_KIND: "paddle",
            AA_PADDLE_API_KEY: "paddle_xxx",
            AA_BILLING_SUCCESS_URL: "https://success.example.com",
            AA_BILLING_CANCEL_URL: "https://cancel.example.com",
        });
        assert.equal(config.paymentGatewayKind, "paddle");
        assert.equal(config.paddleApiKey, "paddle_xxx");
        assert.equal(config.paddleSuccessUrl, "https://success.example.com");
        assert.equal(config.paddleCancelUrl, "https://cancel.example.com");
    });
    it("throws ValidationError for unknown action", () => {
        assert.throws(() => loadBillingCliEnv({
            AA_BILLING_ACTION: "unknown_action",
            AA_DB_PATH: "/tmp/test.db",
        }), (e) => e instanceof ValidationError && e.code === "billing.invalid_action");
    });
    it("returns null stripe fields when gateway credentials are not provided", () => {
        const config = loadBillingCliEnv({
            AA_BILLING_ACTION: "create_checkout",
            AA_DB_PATH: "/tmp/test.db",
            AA_PAYMENT_GATEWAY_KIND: "stripe",
            AA_BILLING_SUCCESS_URL: "https://success.example.com",
            AA_BILLING_CANCEL_URL: "https://cancel.example.com",
        });
        assert.equal(config.paymentGatewayKind, "stripe");
        assert.equal(config.stripeSecretKey, null);
        assert.equal(config.stripeSuccessUrl, "https://success.example.com");
        assert.equal(config.stripeCancelUrl, "https://cancel.example.com");
    });
});
//# sourceMappingURL=billing.test.js.map