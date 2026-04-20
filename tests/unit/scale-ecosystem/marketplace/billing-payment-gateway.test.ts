import assert from "node:assert/strict";
import test from "node:test";

import {
  ManualBillingPaymentGateway,
  StripeBillingPaymentGateway,
  PaddleBillingPaymentGateway,
  type CreateBillingCheckoutSessionInput,
} from "../../../../src/scale-ecosystem/marketplace/billing-payment-gateway.js";
import { ProviderError, ValidationError } from "../../../../src/platform/contracts/errors.js";
import type {
  BillingAccountRecord,
  BillingInvoiceRecord,
  BillingPaymentSessionRecord,
} from "../../../../src/platform/contracts/types/domain.js";

/**
 * Creates a minimal invoice record for testing.
 */
function createTestInvoice(overrides: Partial<BillingInvoiceRecord> = {}): BillingInvoiceRecord {
  return {
    invoiceId: "inv_test_123",
    accountId: "acct_test_1",
    workspaceId: "ws_test_1",
    tenantId: "tenant_test_1",
    periodId: "period_2026_04",
    currency: "USD",
    subtotalUsd: 0.10,
    taxUsd: 0.01,
    totalUsd: 0.11,
    status: "open",
    summaryJson: "{}",
    externalInvoiceRef: null,
    dueAt: "2026-05-01T00:00:00.000Z",
    createdAt: "2026-04-08T10:00:00.000Z",
    updatedAt: "2026-04-08T10:00:00.000Z",
    paidAt: null,
    ...overrides,
  };
}

/**
 * Creates a minimal account record for testing.
 */
function createTestAccount(overrides: Partial<BillingAccountRecord> = {}): BillingAccountRecord {
  return {
    accountId: "acct_test_1",
    ownerId: "owner_test_1",
    workspaceId: "ws_test_1",
    planId: "pro",
    status: "active",
    createdAt: "2026-04-08T10:00:00.000Z",
    updatedAt: "2026-04-08T10:00:00.000Z",
    ...overrides,
  };
}

/**
 * Creates a minimal payment session record for testing.
 */
function createTestSession(overrides: Partial<BillingPaymentSessionRecord> = {}): BillingPaymentSessionRecord {
  return {
    sessionId: "sess_test_1",
    invoiceId: "inv_test_123",
    accountId: "acct_test_1",
    gatewayKind: "stripe",
    gatewaySessionRef: "cs_test_123",
    checkoutUrl: "https://checkout.stripe.com/test",
    status: "pending",
    amountUsd: 0.11,
    currency: "USD",
    expiresAt: "2026-04-15T10:00:00.000Z",
    createdAt: "2026-04-08T10:00:00.000Z",
    updatedAt: "2026-04-08T10:00:00.000Z",
    settledAt: null,
    failureCode: null,
    ...overrides,
  };
}

/**
 * Creates a checkout session input for testing.
 */
function createCheckoutInput(
  invoice?: BillingInvoiceRecord,
  account?: BillingAccountRecord,
): CreateBillingCheckoutSessionInput {
  return {
    invoice: invoice ?? createTestInvoice(),
    account: account ?? createTestAccount(),
    createdAt: "2026-04-08T10:00:00.000Z",
  };
}

// ============================================================================
// ManualBillingPaymentGateway Tests
// ============================================================================

test("ManualBillingPaymentGateway.createCheckoutSession generates correct checkout URL", () => {
  const gateway = new ManualBillingPaymentGateway();
  const invoice = createTestInvoice({ invoiceId: "inv_manual_test" });
  const account = createTestAccount({ accountId: "acct_manual_test" });
  const input = createCheckoutInput(invoice, account);

  const session = gateway.createCheckoutSession(input);

  assert.equal(session.gatewayKind, "manual");
  assert.equal(session.gatewaySessionRef, "manual_inv_manual_test");
  assert.match(session.checkoutUrl, /billing\.manual\.local\/checkout/);
  assert.match(session.checkoutUrl, /inv_manual_test/);
  assert.match(session.checkoutUrl, /acct_manual_test/);
  assert.equal(session.expiresAt, null); // Manual payments don't expire
});

test("ManualBillingPaymentGateway.createCheckoutSession uses custom baseUrl when provided", () => {
  const gateway = new ManualBillingPaymentGateway({ baseUrl: "https://billing.internal.example.com/pay" });
  const input = createCheckoutInput();

  const session = gateway.createCheckoutSession(input);

  assert.match(session.checkoutUrl, /^https:\/\/billing\.internal\.example\.com\/pay\//);
});

test("ManualBillingPaymentGateway.createCheckoutSession handles empty baseUrl and normalizes slashes", () => {
  const gateway = new ManualBillingPaymentGateway({ baseUrl: "  https://billing.test.com///  " });
  const input = createCheckoutInput();

  const session = gateway.createCheckoutSession(input);

  // Should trim whitespace and normalize trailing slashes
  assert.match(session.checkoutUrl, /^https:\/\/billing\.test\.com\//);
  assert.ok(!session.checkoutUrl.endsWith("///"));
});

test("ManualBillingPaymentGateway.fetchPaymentSessionStatus always returns null", () => {
  const gateway = new ManualBillingPaymentGateway();

  // Manual gateway doesn't take any arguments - it always returns null
  const result = gateway.fetchPaymentSessionStatus();

  assert.equal(result, null);
});

test("ManualBillingPaymentGateway.kind returns 'manual'", () => {
  const gateway = new ManualBillingPaymentGateway();
  assert.equal(gateway.kind, "manual");
});

// ============================================================================
// StripeBillingPaymentGateway Tests
// ============================================================================

test("StripeBillingPaymentGateway.createCheckoutSession sends correct form data and returns session", async () => {
  let capturedBody: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url, init) => {
      if (init?.method === "POST") {
        capturedBody = String(init.body ?? "");
        capturedHeaders = init.headers as Record<string, string>;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "cs_stripe_123",
          url: "https://checkout.stripe.com/test/cs_stripe_123",
          expires_at: 1770000000,
        }),
      } as unknown as Response;
    },
  });

  const invoice = createTestInvoice({
    invoiceId: "inv_stripe_test",
    totalUsd: 0.25,
    currency: "USD",
  });
  const account = createTestAccount({ accountId: "acct_stripe_test" });
  const input = createCheckoutInput(invoice, account);

  const session = await gateway.createCheckoutSession(input);

  // Verify URL
  assert.match(capturedBody ?? "", /client_reference_id=inv_stripe_test/);
  // Verify amount is converted to cents (note: Stripe uses URL-encoded brackets like line_items%5B0%5D%5B...)
  assert.match(capturedBody ?? "", /unit_amount%5D=25/);
  // Verify metadata
  assert.match(capturedBody ?? "", /metadata%5Binvoice_id%5D=inv_stripe_test/);
  assert.match(capturedBody ?? "", /metadata%5Baccount_id%5D=acct_stripe_test/);
  // Verify Authorization header
  assert.equal(capturedHeaders?.["Authorization"], "Bearer sk_test_12345");
  assert.equal(capturedHeaders?.["Content-Type"], "application/x-www-form-urlencoded");

  assert.equal(session.gatewayKind, "stripe");
  assert.equal(session.gatewaySessionRef, "cs_stripe_123");
  assert.equal(session.checkoutUrl, "https://checkout.stripe.com/test/cs_stripe_123");
  assert.equal(session.expiresAt, new Date(1770000000 * 1000).toISOString());
});

test("StripeBillingPaymentGateway.createCheckoutSession converts USD to cents correctly", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_amount_test",
        url: "https://checkout.stripe.com/test",
        expires_at: null,
      }),
    } as Response),
  });

  const testCases = [
    { totalUsd: 0.11, expectedCents: 11 },
    { totalUsd: 1.00, expectedCents: 100 },
    { totalUsd: 0.99, expectedCents: 99 },
    { totalUsd: 123.45, expectedCents: 12345 },
    { totalUsd: 0, expectedCents: 0 },
  ];

  for (const { totalUsd, expectedCents } of testCases) {
    const invoice = createTestInvoice({ totalUsd });
    const input = createCheckoutInput(invoice);

    // We need a fresh gateway per test case since fetchFn captures state
    const gw = new StripeBillingPaymentGateway({
      secretKey: "sk_test_12345",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
      fetchFn: async (_url, init) => {
        const body = String(init?.body ?? "");
        // Stripe form data uses URL-encoded brackets like line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=25
        // Match unit_amount followed by any chars until we hit =<digits>
        const match = body.match(/unit_amount[^=]*=(\d+)/);
        const capturedCents = match ? parseInt(match[1]!, 10) : null;
        assert.equal(capturedCents, expectedCents, `Expected ${expectedCents} cents for ${totalUsd} USD, got ${capturedCents} from body: ${body}`);
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          json: async () => ({
            id: `cs_${expectedCents}`,
            url: "https://checkout.stripe.com/test",
          }),
        } as Response;
      },
    });

    await gw.createCheckoutSession(input);
  }
});

test("StripeBillingPaymentGateway.createCheckoutSession handles API error response", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_invalid",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: {
          message: "Invalid API key provided",
        },
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.match(err.code, /billing\.stripe_checkout_failed/);
      assert.match(err.code, /Invalid API key/);
      assert.equal(err.retryable, false); // 4xx errors are not retryable
      return true;
    },
  );
});

test("StripeBillingPaymentGateway.createCheckoutSession handles server error (retryable)", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
      json: async () => ({
        error: {
          message: "Internal error",
        },
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.retryable, true); // 5xx errors are retryable
      return true;
    },
  );
});

test("StripeBillingPaymentGateway.createCheckoutSession throws ValidationError on malformed response", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        // Missing 'id' and 'url' fields
        status: "complete",
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.code, /billing\.stripe_checkout_invalid_response/);
      return true;
    },
  );
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus returns paid status for paid session", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url) => {
      assert.match(String(url), /checkout\/sessions\/cs_paid_123/);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "cs_paid_123",
          status: "complete",
          payment_status: "paid",
        }),
      } as Response;
    },
  });

  const session = createTestSession({ gatewaySessionRef: "cs_paid_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.gatewayKind, "stripe");
  assert.equal(result.gatewaySessionRef, "cs_paid_123");
  assert.equal(result.status, "paid");
  assert.ok(result.occurredAt !== null);
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus returns expired status for expired session", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_expired_123",
        status: "expired",
        payment_status: "unpaid",
      }),
    } as Response),
  });

  const session = createTestSession({ gatewaySessionRef: "cs_expired_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.status, "expired");
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus returns pending for other statuses", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_pending_123",
        status: "open",
        payment_status: "unpaid",
      }),
    } as Response),
  });

  const session = createTestSession({ gatewaySessionRef: "cs_pending_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.status, "pending");
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus handles API errors with retryable flag", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        error: {
          message: "Rate limit exceeded",
        },
      }),
    } as Response),
  });

  const session = createTestSession();
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await assert.rejects(
    async () => gateway.fetchPaymentSessionStatus({ session, invoice, account }),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.retryable, true); // 429 is retryable
      return true;
    },
  );
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus throws ValidationError on mismatched session ID", async () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        // Returned ID doesn't match the requested gatewaySessionRef
        id: "cs_different_456",
        url: "https://checkout.stripe.com/test/cs_different_456",
        status: "complete",
        payment_status: "paid",
      }),
    } as Response),
  });

  const session = createTestSession({ gatewaySessionRef: "cs_expected_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await assert.rejects(
    async () => gateway.fetchPaymentSessionStatus({ session, invoice, account }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.code, /billing\.stripe_reconcile_invalid_response/);
      return true;
    },
  );
});

test("StripeBillingPaymentGateway.fetchPaymentSessionStatus URL-encodes session reference (SSRF protection)", async () => {
  let capturedUrl: string | undefined;

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url) => {
      capturedUrl = String(url);
      // Return the same ID that was requested (after URL decoding in real scenario)
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "cs_test/special&query=123",
          url: "https://checkout.stripe.com/test/cs_test/special&query=123",
          status: "complete",
          payment_status: "paid",
        }),
      } as Response;
    },
  });

  // Session ref with characters that need URL encoding
  const session = createTestSession({ gatewaySessionRef: "cs_test/special&query=123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  // The URL should contain the properly encoded session reference
  assert.ok(capturedUrl !== undefined);
  assert.match(capturedUrl!, /cs_test%2Fspecial%26query%3D123/);
});

test("StripeBillingPaymentGateway.kind returns 'stripe'", () => {
  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
  });
  assert.equal(gateway.kind, "stripe");
});

test("StripeBillingPaymentGateway uses custom apiBaseUrl when provided", async () => {
  let capturedUrl: string | undefined;

  const gateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    apiBaseUrl: "https://stripe.internal.example.com/v1",
    fetchFn: async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          id: "cs_custom_api",
          url: "https://checkout.stripe.com/test",
          expires_at: null,
        }),
      } as Response;
    },
  });

  const input = createCheckoutInput();
  await gateway.createCheckoutSession(input);

  assert.match(capturedUrl!, /^https:\/\/stripe\.internal\.example\.com\/v1\//);
});

// ============================================================================
// PaddleBillingPaymentGateway Tests
// ============================================================================

test("PaddleBillingPaymentGateway.createCheckoutSession sends correct JSON and returns session", async () => {
  let capturedBody: string | undefined;
  let capturedHeaders: Record<string, string> | undefined;

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url, init) => {
      if (init?.method === "POST") {
        capturedBody = String(init.body ?? "");
        capturedHeaders = init.headers as Record<string, string>;
      }
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            id: "txn_paddle_123",
            checkout: {
              url: "https://checkout.paddle.com/test/txn_paddle_123",
            },
          },
        }),
      } as Response;
    },
  });

  const invoice = createTestInvoice({
    invoiceId: "inv_paddle_test",
    totalUsd: 0.50,
  });
  const account = createTestAccount({ accountId: "acct_paddle_test" });
  const input = createCheckoutInput(invoice, account);

  const session = await gateway.createCheckoutSession(input);

  // Verify JSON body structure
  const parsedBody = JSON.parse(capturedBody ?? "{}");
  assert.equal(parsedBody.items[0].price.name, "Automatic Agent Invoice inv_paddle_test");
  assert.equal(parsedBody.items[0].price.unit_price.amount, "50"); // cents
  assert.equal(parsedBody.custom_data.invoice_id, "inv_paddle_test");
  assert.equal(parsedBody.custom_data.account_id, "acct_paddle_test");
  assert.equal(parsedBody.checkout.success_url, "https://app.example.com/success");

  // Verify headers
  assert.equal(capturedHeaders?.["Authorization"], "Bearer pdl_test_12345");
  assert.equal(capturedHeaders?.["Content-Type"], "application/json");

  assert.equal(session.gatewayKind, "paddle");
  assert.equal(session.gatewaySessionRef, "txn_paddle_123");
  assert.equal(session.checkoutUrl, "https://checkout.paddle.com/test/txn_paddle_123");
});

test("PaddleBillingPaymentGateway.createCheckoutSession handles API error response", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_invalid",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({
        error: {
          detail: "Invalid API key",
        },
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.match(err.code, /billing\.paddle_checkout_failed/);
      assert.match(err.code, /Invalid API key/);
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway.createCheckoutSession throws ValidationError on malformed response", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        // Missing data.id and data.checkout.url
        error: null,
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.code, /billing\.paddle_checkout_invalid_response/);
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus maps 'completed' to 'paid'", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url) => {
      assert.match(String(url), /transactions\/txn_completed_123/);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            id: "txn_completed_123",
            status: "completed",
            updated_at: "2026-04-08T12:00:00.000Z",
          },
        }),
      } as Response;
    },
  });

  const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: "txn_completed_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.gatewayKind, "paddle");
  assert.equal(result.gatewaySessionRef, "txn_completed_123");
  assert.equal(result.status, "paid");
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus maps 'billed' to 'paid'", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "txn_billed_123",
          status: "billed",
          updated_at: "2026-04-08T12:00:00.000Z",
        },
      }),
    } as Response),
  });

  const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: "txn_billed_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.status, "paid");
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus maps 'cancelled' (and 'canceled') to 'cancelled'", async () => {
  for (const status of ["canceled", "cancelled"]) {
    const gateway = new PaddleBillingPaymentGateway({
      apiKey: "pdl_test_12345",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
      fetchFn: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            id: `txn_${status}_123`,
            status,
            updated_at: "2026-04-08T12:00:00.000Z",
          },
        }),
      } as Response),
    });

    const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: `txn_${status}_123` });
    const invoice = createTestInvoice();
    const account = createTestAccount();

    const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

    assert.ok(result !== null);
    assert.equal(result.status, "cancelled", `Expected cancelled for status: ${status}`);
  }
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus maps 'past_due' and 'failed' to 'failed'", async () => {
  for (const status of ["past_due", "failed"]) {
    const gateway = new PaddleBillingPaymentGateway({
      apiKey: "pdl_test_12345",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
      fetchFn: async () => ({
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            id: `txn_${status}_123`,
            status,
            updated_at: "2026-04-08T12:00:00.000Z",
          },
        }),
      } as Response),
    });

    const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: `txn_${status}_123` });
    const invoice = createTestInvoice();
    const account = createTestAccount();

    const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

    assert.ok(result !== null);
    assert.equal(result.status, "failed", `Expected failed for status: ${status}`);
  }
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus defaults to 'pending' for unknown statuses", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "txn_unknown_123",
          status: "some_unexpected_status",
          updated_at: "2026-04-08T12:00:00.000Z",
        },
      }),
    } as Response),
  });

  const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: "txn_unknown_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  const result = await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  assert.ok(result !== null);
  assert.equal(result.status, "pending");
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus handles API errors", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 503,
      statusText: "Service Unavailable",
      json: async () => ({
        error: {
          detail: "Paddle is temporarily unavailable",
        },
      }),
    } as Response),
  });

  const session = createTestSession({ gatewayKind: "paddle" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await assert.rejects(
    async () => gateway.fetchPaymentSessionStatus({ session, invoice, account }),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.retryable, true); // 5xx is retryable
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus throws ValidationError on mismatched transaction ID", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          // Returned ID doesn't match the requested gatewaySessionRef
          id: "txn_different_456",
          status: "completed",
          updated_at: "2026-04-08T12:00:00.000Z",
        },
      }),
    } as Response),
  });

  const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: "txn_expected_123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await assert.rejects(
    async () => gateway.fetchPaymentSessionStatus({ session, invoice, account }),
    (err: unknown) => {
      assert.ok(err instanceof ValidationError);
      assert.match(err.code, /billing\.paddle_reconcile_invalid_response/);
      return true;
    },
  );
});

test("PaddleBillingPaymentGateway.fetchPaymentSessionStatus URL-encodes transaction reference (SSRF protection)", async () => {
  let capturedUrl: string | undefined;

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async (url) => {
      capturedUrl = String(url);
      // Return a properly formatted ID that matches what was requested
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            // Return the same ID that was requested (after URL decoding in real scenario)
            id: "txn_test/special&query=123",
            status: "completed",
            updated_at: "2026-04-08T12:00:00.000Z",
          },
        }),
      } as Response;
    },
  });

  // Transaction ref with characters that need URL encoding
  const session = createTestSession({ gatewayKind: "paddle", gatewaySessionRef: "txn_test/special&query=123" });
  const invoice = createTestInvoice();
  const account = createTestAccount();

  await gateway.fetchPaymentSessionStatus({ session, invoice, account });

  // The URL should contain the properly encoded transaction reference
  assert.ok(capturedUrl !== undefined);
  assert.match(capturedUrl!, /txn_test%2Fspecial%26query%3D123/);
});

test("PaddleBillingPaymentGateway.kind returns 'paddle'", () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
  });
  assert.equal(gateway.kind, "paddle");
});

test("PaddleBillingPaymentGateway uses custom apiBaseUrl when provided", async () => {
  let capturedUrl: string | undefined;

  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    apiBaseUrl: "https://paddle.internal.example.com/api",
    fetchFn: async (url) => {
      capturedUrl = String(url);
      return {
        ok: true,
        status: 200,
        statusText: "OK",
        json: async () => ({
          data: {
            id: "txn_custom_api",
            checkout: {
              url: "https://checkout.paddle.com/test",
            },
          },
        }),
      } as Response;
    },
  });

  const input = createCheckoutInput();
  await gateway.createCheckoutSession(input);

  assert.match(capturedUrl!, /^https:\/\/paddle\.internal\.example\.com\/api\//);
});

test("PaddleBillingPaymentGateway handles rate limiting (429) as retryable", async () => {
  const gateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: false,
      status: 429,
      statusText: "Too Many Requests",
      json: async () => ({
        error: {
          detail: "Rate limit exceeded",
        },
      }),
    } as Response),
  });

  const input = createCheckoutInput();

  await assert.rejects(
    async () => gateway.createCheckoutSession(input),
    (err: unknown) => {
      assert.ok(err instanceof ProviderError);
      assert.equal(err.retryable, true); // 429 is retryable
      return true;
    },
  );
});

// ============================================================================
// Integration-style Tests: Gateway Interface Compliance
// ============================================================================

test("All gateways implement BillingPaymentGateway interface kind property", () => {
  const gateways = [
    new ManualBillingPaymentGateway(),
    new StripeBillingPaymentGateway({
      secretKey: "sk_test_12345",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
    }),
    new PaddleBillingPaymentGateway({
      apiKey: "pdl_test_12345",
      successUrl: "https://app.example.com/success",
      cancelUrl: "https://app.example.com/cancel",
    }),
  ];

  const expectedKinds: Array<"manual" | "stripe" | "paddle"> = ["manual", "stripe", "paddle"];

  for (const [index, gateway] of gateways.entries()) {
    assert.equal(gateway.kind, expectedKinds[index]);
  }
});

test("All gateways return correct gatewayKind in checkout session response", async () => {
  const invoice = createTestInvoice();
  const account = createTestAccount();

  // Manual gateway (sync)
  const manualGateway = new ManualBillingPaymentGateway();
  const manualSession = manualGateway.createCheckoutSession({ invoice, account, createdAt: new Date().toISOString() });
  assert.equal(manualSession.gatewayKind, "manual");

  // Stripe gateway (async)
  const stripeGateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_integration_test",
        url: "https://checkout.stripe.com/test",
        expires_at: null,
      }),
    } as Response),
  });
  const stripeSession = await stripeGateway.createCheckoutSession({ invoice, account, createdAt: new Date().toISOString() });
  assert.equal(stripeSession.gatewayKind, "stripe");

  // Paddle gateway (async)
  const paddleGateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "txn_integration_test",
          checkout: { url: "https://checkout.paddle.com/test" },
        },
      }),
    } as Response),
  });
  const paddleSession = await paddleGateway.createCheckoutSession({ invoice, account, createdAt: new Date().toISOString() });
  assert.equal(paddleSession.gatewayKind, "paddle");
});

test("All checkout sessions include gatewaySessionRef and checkoutUrl", async () => {
  const invoice = createTestInvoice();
  const account = createTestAccount();
  const createdAt = new Date().toISOString();

  // Manual gateway
  const manualGateway = new ManualBillingPaymentGateway();
  const manualSession = manualGateway.createCheckoutSession({ invoice, account, createdAt });
  assert.ok(manualSession.gatewaySessionRef.length > 0);
  assert.ok(manualSession.checkoutUrl.startsWith("http"));

  // Stripe gateway
  const stripeGateway = new StripeBillingPaymentGateway({
    secretKey: "sk_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        id: "cs_url_test",
        url: "https://checkout.stripe.com/test/cs_url_test",
        expires_at: null,
      }),
    } as Response),
  });
  const stripeSession = await stripeGateway.createCheckoutSession({ invoice, account, createdAt });
  assert.ok(stripeSession.gatewaySessionRef.length > 0);
  assert.ok(stripeSession.checkoutUrl.startsWith("http"));

  // Paddle gateway
  const paddleGateway = new PaddleBillingPaymentGateway({
    apiKey: "pdl_test_12345",
    successUrl: "https://app.example.com/success",
    cancelUrl: "https://app.example.com/cancel",
    fetchFn: async () => ({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({
        data: {
          id: "txn_url_test",
          checkout: { url: "https://checkout.paddle.com/test/txn_url_test" },
        },
      }),
    } as Response),
  });
  const paddleSession = await paddleGateway.createCheckoutSession({ invoice, account, createdAt });
  assert.ok(paddleSession.gatewaySessionRef.length > 0);
  assert.ok(paddleSession.checkoutUrl.startsWith("http"));
});
