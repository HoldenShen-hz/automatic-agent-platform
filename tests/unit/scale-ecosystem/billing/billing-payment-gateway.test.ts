// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import {
  ManualBillingPaymentGateway,
  StripeBillingPaymentGateway,
  PaddleBillingPaymentGateway,
} from "../../../../src/scale-ecosystem/billing/billing-payment-gateway.js";
import { ProviderError, ValidationError } from "../../../../src/platform/contracts/errors.js";

// Helper to create mock billing records
function createMockInvoice(overrides = {}) {
  return {
    invoiceId: "inv_test_123",
    accountId: "acct_test_456",
    workspaceId: "ws_test_789",
    tenantId: "tenant_test",
    periodId: "period_2026_04",
    currency: "USD",
    subtotalUsd: 100.0,
    taxUsd: 10.0,
    totalUsd: 110.0,
    status: "pending",
    summaryJson: "{}",
    externalInvoiceRef: null,
    dueAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    paidAt: null,
    ...overrides,
  };
}

function createMockAccount(overrides = {}) {
  return {
    accountId: "acct_test_456",
    ownerId: "owner_test_abc",
    workspaceId: "ws_test_789",
    planId: "plan_pro",
    status: "active",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    ...overrides,
  };
}

function createMockSession(overrides = {}) {
  return {
    sessionId: "sess_test_xyz",
    invoiceId: "inv_test_123",
    accountId: "acct_test_456",
    gatewayKind: "stripe",
    gatewaySessionRef: "cs_test_session_abc",
    checkoutUrl: "https://checkout.stripe.com/pay/cs_test",
    status: "pending",
    amountUsd: 110.0,
    currency: "USD",
    expiresAt: "2026-04-15T00:00:00.000Z",
    createdAt: "2026-04-01T00:00:00.000Z",
    updatedAt: "2026-04-01T00:00:00.000Z",
    settledAt: null,
    failureCode: null,
    ...overrides,
  };
}

// ============================================================
// ManualBillingPaymentGateway Tests
// ============================================================

test("ManualBillingPaymentGateway createCheckoutSession generates correct session", () => {
  const gateway = new ManualBillingPaymentGateway();
  const invoice = createMockInvoice();
  const account = createMockAccount();
  const createdAt = "2026-04-01T00:00:00.000Z";

  const session = gateway.createCheckoutSession({ invoice, account, createdAt });

  assert.equal(session.gatewayKind, "manual");
  assert.equal(session.gatewaySessionRef, `manual_${invoice.invoiceId}`);
  assert.ok(session.checkoutUrl.includes(invoice.invoiceId));
  assert.ok(session.checkoutUrl.includes(account.accountId));
  assert.equal(session.expiresAt, null);
});

test("ManualBillingPaymentGateway createCheckoutSession with custom baseUrl", () => {
  const gateway = new ManualBillingPaymentGateway({ baseUrl: "https://pay.example.com/manual" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const session = gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  assert.ok(session.checkoutUrl.startsWith("https://pay.example.com/manual"));
});

test("ManualBillingPaymentGateway createCheckoutSession trims trailing slash from baseUrl", () => {
  const gateway = new ManualBillingPaymentGateway({ baseUrl: "https://pay.example.com/manual///" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const session = gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  // Should not have triple slashes
  assert.ok(!session.checkoutUrl.includes("///"));
});

test("ManualBillingPaymentGateway createCheckoutSession encodes special characters in IDs", () => {
  const gateway = new ManualBillingPaymentGateway({ baseUrl: "https://pay.example.com" });
  const invoice = createMockInvoice({ invoiceId: "inv with spaces & symbols" });
  const account = createMockAccount({ accountId: "acct with spaces & symbols" });

  const session = gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  assert.ok(session.checkoutUrl.includes(encodeURIComponent(invoice.invoiceId)));
  assert.ok(session.checkoutUrl.includes(encodeURIComponent(account.accountId)));
});

test("ManualBillingPaymentGateway fetchPaymentSessionStatus always returns null", () => {
  const gateway = new ManualBillingPaymentGateway();
  const session = createMockSession({ gatewayKind: "manual" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result, null);
});

// ============================================================
// StripeBillingPaymentGateway Tests
// ============================================================

test("StripeBillingPaymentGateway createCheckoutSession success", async () => {
  const mockFetch = async (url, options) => {
    assert.ok(url.includes("/checkout/sessions"));
    assert.equal(options.method, "POST");
    assert.ok(options.headers.Authorization.startsWith("Bearer sk_test_"));
    assert.equal(options.headers["Content-Type"], "application/x-www-form-urlencoded");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_test_abc123",
        url: "https://checkout.stripe.com/pay/cs_test_abc123",
        expires_at: 1746124800,
        status: "open",
        payment_status: "unpaid",
      }),
    };
  };

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_abc",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice({ totalUsd: 99.99 });
  const account = createMockAccount();

  const session = await gateway.createCheckoutSession({
    invoice,
    account,
    createdAt: "2026-04-01T00:00:00.000Z",
  });

  assert.equal(session.gatewayKind, "stripe");
  assert.equal(session.gatewaySessionRef, "cs_test_abc123");
  assert.equal(session.checkoutUrl, "https://checkout.stripe.com/pay/cs_test_abc123");
  assert.ok(session.expiresAt !== null);
  // expiresAt should be a valid ISO date string
  assert.ok(session.expiresAt !== null && session.expiresAt.includes("T"));
});

test("StripeBillingPaymentGateway createCheckoutSession converts USD to cents", async () => {
  let capturedBody;
  const mockFetch = async (url, options) => {
    capturedBody = options.body;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_test",
        url: "https://checkout.stripe.com/pay/cs_test",
      }),
    };
  };

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice({ totalUsd: 50.555 });
  const account = createMockAccount();

  await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  // Should be rounded to 5056 cents
  assert.ok(capturedBody.includes("line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=5056"));
});

test("StripeBillingPaymentGateway createCheckoutSession handles zero amount", async () => {
  let receivedUrl;
  const mockFetch = async (url, options) => {
    receivedUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_zero",
        url: "https://checkout.stripe.com/pay/cs_zero",
      }),
    };
  };

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice({ totalUsd: 0 });
  const account = createMockAccount();

  const session = await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  // Session should be created successfully even with zero amount
  assert.equal(session.gatewayKind, "stripe");
  assert.equal(session.gatewaySessionRef, "cs_zero");
});

test("StripeBillingPaymentGateway createCheckoutSession throws ProviderError on 5xx", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    json: async () => ({ error: { message: "Stripe is down" } }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.message.includes("billing.stripe_checkout_failed"));
      assert.ok(err.retryable === true);
      return true;
    },
  );
});

test("StripeBillingPaymentGateway createCheckoutSession throws ValidationError on malformed response", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      id: null, // invalid
      url: "not-a-string", // invalid
    }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.message.includes("billing.stripe_checkout_invalid_response"));
      return true;
    },
  );
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus returns paid status", async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes("/checkout/sessions/cs_test_paid"));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_test_paid",
        status: "complete",
        payment_status: "paid",
      }),
    };
  };

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewaySessionRef: "cs_test_paid" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result?.gatewayKind, "stripe");
  assert.equal(result?.gatewaySessionRef, "cs_test_paid");
  assert.equal(result?.status, "paid");
  assert.ok(result?.occurredAt !== null);
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus returns expired status", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      id: "cs_test_expired",
      status: "expired",
      payment_status: "unpaid",
    }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewaySessionRef: "cs_test_expired" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result?.status, "expired");
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus returns pending for open session", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      id: "cs_test_pending",
      status: "open",
      payment_status: "unpaid",
    }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewaySessionRef: "cs_test_pending" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result?.status, "pending");
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus throws ProviderError on 5xx", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    json: async () => ({ error: { message: "Gateway timeout" } }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession();
  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.fetchPaymentSessionStatus({ session, invoice, account });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.message.includes("billing.stripe_reconcile_failed"));
      assert.ok(err.retryable === true);
      return true;
    },
  );
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus throws ProviderError on 429 (rate limit)", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 429,
    statusText: "Too Many Requests",
    json: async () => ({ error: { message: "Rate limited" } }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession();
  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.fetchPaymentSessionStatus({ session, invoice, account });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.retryable === true);
      return true;
    },
  );
});

test("StripeBillingPaymentGateway fetchPaymentSessionStatus throws ValidationError on mismatched session ID", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      id: "cs_different_id", // does not match input session's gatewaySessionRef
      status: "open",
      payment_status: "unpaid",
    }),
  });

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewaySessionRef: "cs_expected_id" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.fetchPaymentSessionStatus({ session, invoice, account });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.message.includes("billing.stripe_reconcile_invalid_response"));
      return true;
    },
  );
});

test("StripeBillingPaymentGateway uses default API URL when not provided", async () => {
  let capturedUrl;
  const mockFetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ id: "cs_test", url: "https://checkout.stripe.com/pay/cs_test" }),
    };
  };

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  assert.ok(capturedUrl.includes("api.stripe.com"));
});

// ============================================================
// PaddleBillingPaymentGateway Tests
// ============================================================

test("PaddleBillingPaymentGateway createCheckoutSession success", async () => {
  const mockFetch = async (url, options) => {
    assert.ok(url.includes("/transactions"));
    assert.equal(options.method, "POST");
    assert.ok(options.headers.Authorization.startsWith("Bearer paddle_"));
    assert.equal(options.headers["Content-Type"], "application/json");
    const body = JSON.parse(options.body);
    assert.equal(body.items[0].price.name, `Automatic Agent Invoice ${body.items[0].price.description.split(" ")[1]}`);
    assert.equal(body.checkout.success_url, "https://app.example.com/success");
    assert.equal(body.checkout.cancel_url, "https://app.example.com/cancel");
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_paddle_123",
          status: "pending",
          checkout: {
            url: "https://checkout.paddle.com/pay/trans_paddle_123",
          },
        },
      }),
    };
  };

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_abc123",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice({ totalUsd: 75.50 });
  const account = createMockAccount();

  const session = await gateway.createCheckoutSession({
    invoice,
    account,
    createdAt: "2026-04-01T00:00:00.000Z",
  });

  assert.equal(session.gatewayKind, "paddle");
  assert.equal(session.gatewaySessionRef, "trans_paddle_123");
  assert.equal(session.checkoutUrl, "https://checkout.paddle.com/pay/trans_paddle_123");
  assert.equal(session.expiresAt, null); // Paddle doesn't return expiry
});

test("PaddleBillingPaymentGateway createCheckoutSession converts USD to cents", async () => {
  let capturedBody;
  const mockFetch = async (url, options) => {
    capturedBody = JSON.parse(options.body);
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_test",
          status: "pending",
          checkout: { url: "https://checkout.paddle.com/pay/trans_test" },
        },
      }),
    };
  };

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice({ totalUsd: 123.45 });
  const account = createMockAccount();

  await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  // Should be 12345 cents
  assert.equal(capturedBody.items[0].price.unit_price.amount, "12345");
});

test("PaddleBillingPaymentGateway createCheckoutSession throws ProviderError on error", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 422,
    statusText: "Unprocessable Entity",
    json: async () => ({ error: { detail: "Invalid pricing data" } }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_invalid",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.message.includes("billing.paddle_checkout_failed"));
      assert.ok(err.retryable === false); // 422 is not retryable
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway createCheckoutSession throws ProviderError on 5xx", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 503,
    statusText: "Service Unavailable",
    json: async () => ({ error: { detail: "Paddle is down" } }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.retryable === true);
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway createCheckoutSession throws ValidationError on malformed response", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: null, // invalid
        checkout: { url: null }, // invalid
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.message.includes("billing.paddle_checkout_invalid_response"));
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns paid for completed transaction", async () => {
  const mockFetch = async (url) => {
    assert.ok(url.includes("/transactions/trans_paddle_paid"));
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_paddle_paid",
          status: "completed",
          updated_at: "2026-04-15T10:30:00.000Z",
        },
      }),
    };
  };

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_paddle_paid" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result?.gatewayKind, "paddle");
  assert.equal(result?.gatewaySessionRef, "trans_paddle_paid");
  assert.equal(result?.status, "paid");
  assert.equal(result?.occurredAt, "2026-04-15T10:30:00.000Z");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus maps various paid statuses", async () => {
  const statuses = ["completed", "paid", "billed"];
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_test",
          status: "completed",
          updated_at: "2026-04-15T10:30:00.000Z",
        },
      }),
    }),
  });

  for (const status of statuses) {
    const mockFetch = async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_test",
          status,
          updated_at: "2026-04-15T10:30:00.000Z",
        },
      }),
    });

    const testGateway = new PaddleBillingPaymentGateway({
      apiKey: "paddle_test",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
      fetchFn: mockFetch,
    });

    const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_test" });
    const result = await testGateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });
    assert.equal(result?.status, "paid", `Status ${status} should map to paid`);
  }
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns cancelled for canceled status", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_cancelled",
        status: "canceled",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_cancelled" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.equal(result?.status, "cancelled");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns cancelled for cancelled status", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_cancelled2",
        status: "cancelled",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_cancelled2" });
  const result = await gateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });

  assert.equal(result?.status, "cancelled");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns failed for past_due", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_past_due",
        status: "past_due",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_past_due" });
  const result = await gateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });

  assert.equal(result?.status, "failed");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns failed for failed status", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_failed",
        status: "failed",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_failed" });
  const result = await gateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });

  assert.equal(result?.status, "failed");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus returns pending for unknown status", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_pending",
        status: "active",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_pending" });
  const result = await gateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });

  assert.equal(result?.status, "pending");
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus throws ProviderError on error", async () => {
  const mockFetch = async () => ({
    ok: false,
    status: 404,
    statusText: "Not Found",
    json: async () => ({ error: { detail: "Transaction not found" } }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.fetchPaymentSessionStatus({ session, invoice, account });
    },
    (err) => {
      assert.ok(err instanceof ProviderError);
      assert.ok(err.message.includes("billing.paddle_reconcile_failed"));
      assert.ok(err.retryable === false); // 404 is not retryable
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus throws ValidationError on mismatched ID", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "cs_different", // does not match session's gatewaySessionRef
        status: "completed",
        updated_at: "2026-04-15T10:30:00.000Z",
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "cs_expected" });
  const invoice = createMockInvoice();
  const account = createMockAccount();

  await assert.rejects(
    async () => {
      await gateway.fetchPaymentSessionStatus({ session, invoice, account });
    },
    (err) => {
      assert.ok(err instanceof ValidationError);
      assert.ok(err.message.includes("billing.paddle_reconcile_invalid_response"));
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway fetchPaymentSessionStatus uses current time when updated_at missing", async () => {
  const mockFetch = async () => ({
    ok: true,
    status: 200,
    statusText: "OK",
    json: async () => ({
      data: {
        id: "trans_no_date",
        status: "completed",
        // updated_at is missing
      },
    }),
  });

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const session = createMockSession({ gatewayKind: "paddle", gatewaySessionRef: "trans_no_date" });
  const before = new Date().toISOString();
  const result = await gateway.fetchPaymentSessionStatus({ session, invoice: createMockInvoice(), account: createMockAccount() });
  const after = new Date().toISOString();

  assert.ok(result!.occurredAt >= before);
  assert.ok(result!.occurredAt <= after);
});

test("PaddleBillingPaymentGateway uses default API URL when not provided", async () => {
  let capturedUrl;
  const mockFetch = async (url) => {
    capturedUrl = url;
    return {
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "trans_test",
          status: "pending",
          checkout: { url: "https://checkout.paddle.com/pay/trans_test" },
        },
      }),
    };
  };

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "paddle_test",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: mockFetch,
  });

  const invoice = createMockInvoice();
  const account = createMockAccount();

  await gateway.createCheckoutSession({ invoice, account, createdAt: "2026-04-01T00:00:00.000Z" });

  assert.ok(capturedUrl.includes("sandbox.paddle.com") || capturedUrl.includes("api.paddle.com"));
});
