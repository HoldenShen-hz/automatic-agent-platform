import test from "node:test";
import assert from "node:assert/strict";

import { loadBillingCliEnv } from "../../../../../src/platform/five-plane-control-plane/config-center/billing-env.js";

test("billing env loader parses payment and invoice settings", () => {
  const config = loadBillingCliEnv({
    AA_DB_PATH: "/tmp/billing.db",
    AA_BILLING_ACTION: "create_invoice",
    AA_PAYMENT_GATEWAY_KIND: "stripe",
    AA_ACCOUNT_ID: "acct-1",
    AA_TENANT_ID: "tenant-1",
    AA_DUE_AT: "2026-05-01T00:00:00.000Z",
    AA_TAX_USD: "1.25",
    AA_STRIPE_SECRET_KEY: "sk_test_123",
    AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
    AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
    AA_STRIPE_API_BASE_URL: "https://stripe-proxy.example.com/v1",
  });

  assert.equal(config.action, "create_invoice");
  assert.equal(config.paymentGatewayKind, "stripe");
  assert.equal(config.paymentGatewayKindConfigured, true);
  assert.equal(config.accountId, "acct-1");
  assert.equal(config.tenantId, "tenant-1");
  assert.equal(config.dueAt, "2026-05-01T00:00:00.000Z");
  assert.equal(config.taxUsd, 1.25);
  assert.equal(config.stripeSecretKey, "sk_test_123");
  assert.equal(config.stripeSuccessUrl, "https://app.example.com/billing/success");
  assert.equal(config.stripeCancelUrl, "https://app.example.com/billing/cancel");
  assert.equal(config.stripeApiBaseUrl, "https://stripe-proxy.example.com/v1");
});

test("billing env loader parses paddle gateway configuration", () => {
  const config = loadBillingCliEnv({
    AA_DB_PATH: "/tmp/billing.db",
    AA_BILLING_ACTION: "create_checkout",
    AA_INVOICE_ID: "invoice_123",
    AA_PAYMENT_GATEWAY_KIND: "paddle",
    AA_PADDLE_API_KEY: "pdl_test_123",
    AA_BILLING_SUCCESS_URL: "https://app.example.com/billing/success",
    AA_BILLING_CANCEL_URL: "https://app.example.com/billing/cancel",
    AA_PADDLE_API_BASE_URL: "https://paddle.example.test",
  });

  assert.equal(config.paymentGatewayKind, "paddle");
  assert.equal(config.paddleApiKey, "pdl_test_123");
  assert.equal(config.paddleApiBaseUrl, "https://paddle.example.test");
});

test("billing env loader rejects invalid numeric values", () => {
  assert.throws(
    () =>
      loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_TAX_USD: "abc",
      }),
    /AA_TAX_USD must be numeric/,
  );
});

test("billing env loader parses reconcile payment status and gateway refs", () => {
  const config = loadBillingCliEnv({
    AA_DB_PATH: "/tmp/billing.db",
    AA_BILLING_ACTION: "reconcile_payment",
    AA_PAYMENT_GATEWAY_KIND: "stripe",
    AA_GATEWAY_SESSION_REF: "cs_live_123",
    AA_PAYMENT_STATUS: "failed",
    AA_FAILURE_CODE: "card_declined",
  });

  assert.equal(config.action, "reconcile_payment");
  assert.equal(config.gatewaySessionRef, "cs_live_123");
  assert.equal(config.paymentStatus, "failed");
  assert.equal(config.failureCode, "card_declined");
});

test("billing env loader parses reconcile pending settings", () => {
  const config = loadBillingCliEnv({
    AA_DB_PATH: "/tmp/billing.db",
    AA_BILLING_ACTION: "reconcile_pending",
    AA_TENANT_ID: "tenant-1",
    AA_LIMIT: "25",
  });

  assert.equal(config.action, "reconcile_pending");
  assert.equal(config.tenantId, "tenant-1");
  assert.equal(config.limit, 25);
  assert.equal(config.paymentGatewayKindConfigured, false);
});

test("billing env loader rejects invalid payment status", () => {
  assert.throws(
    () =>
      loadBillingCliEnv({
        AA_DB_PATH: "/tmp/billing.db",
        AA_PAYMENT_STATUS: "processing",
      }),
    /billing\.invalid_payment_status/,
  );
});
