import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import test from "node:test";

import { createBillingRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/billing-routes.js";
import type { BillingService } from "../../../../../../src/scale-ecosystem/marketplace/billing-service.js";
import type { RouteContext } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockBillingService(result: Record<string, unknown> = { sessionRef: "sess-123", status: "paid" }): BillingService {
  return {
    reconcilePaymentSession: () => result,
  } as unknown as BillingService;
}

function createSignedHeaders(body: string, secret: string, timestamp = Math.floor(Date.now() / 1000).toString()): Record<string, string> {
  const signature = createHmac("sha256", secret)
    .update(timestamp)
    .update(".")
    .update(body)
    .digest("hex");
  return {
    "x-webhook-timestamp": timestamp,
    "x-webhook-signature": signature,
  };
}

function createMockContext(headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "POST", url: "/v1/billing/webhooks/reconcile", headers, body } as never,
    route: { pathname: "/v1/billing/webhooks/reconcile", segments: [] },
    principal: null,
  };
}

test("createBillingRoutes returns 1 route", () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  assert.equal(routes.length, 1);
});

test("POST /v1/billing/webhooks/reconcile returns result when billing service available", async () => {
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const deps = {
    billingService: createMockBillingService({ sessionRef: "sess-abc", status: "paid", amount: 100 }),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret), body);
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("sess-abc"));
});

test("POST /v1/billing/webhooks/reconcile accepts sha256-prefixed hex signature", async () => {
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-prefixed",
    status: "paid",
  });
  const deps = {
    billingService: createMockBillingService({ sessionRef: "sess-prefixed", status: "paid" }),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const headers = createSignedHeaders(body, deps.webhookSecret);
  const ctx = createMockContext({
    ...headers,
    "x-webhook-signature": `sha256=${headers["x-webhook-signature"]}`,
  }, body);
  const response = await route.handler(ctx);

  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("sess-prefixed"));
});

test("POST /v1/billing/webhooks/reconcile throws 503 when billing service not configured", async () => {
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const deps = {
    billingService: null,
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret), body);
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Billing service is not configured/);
  }
});

test("POST /v1/billing/webhooks/reconcile validates payload", async () => {
  const body = JSON.stringify({
    gatewayKind: "invalid-gateway",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret), body);
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /invalid/i);
  }
});

test("POST /v1/billing/webhooks/reconcile returns result when billing service available", async () => {
  const body = JSON.stringify({
    gatewayKind: "paddle",
    gatewaySessionRef: "v1-sess",
    status: "pending",
  });
  const deps = {
    billingService: createMockBillingService({ sessionRef: "v1-sess", status: "pending" }),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret), body);
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("v1-sess"));
});

test("POST /v1/billing/webhooks/reconcile throws 503 when billing service not configured", async () => {
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const deps = {
    billingService: null,
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret), body);
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Billing service is not configured/);
  }
});

test("POST /v1/billing/webhooks/reconcile throws 401 when signature is invalid", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "expected-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const validHeaders = createSignedHeaders(body, deps.webhookSecret);
  const ctx = createMockContext({ ...validHeaders, "x-webhook-signature": "0".repeat(64) }, body);
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /signature/);
  }
});

test("POST /v1/billing/webhooks/reconcile does not bypass signature verification with auth headers", async () => {
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "expected-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ authorization: "Bearer valid-token" }, body);

  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /signature/i,
  );
});

test("POST /v1/billing/webhooks/reconcile rejects stale webhook timestamps", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const body = JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  });
  const ctx = createMockContext(createSignedHeaders(body, deps.webhookSecret, "1"), body);

  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /timestamp/i,
  );
});

test("POST /v1/billing/webhooks/reconcile rejects dangerous JSON keys", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "test-webhook-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const body = "{\"gatewayKind\":\"stripe\",\"gatewaySessionRef\":\"sess-abc\",\"status\":\"paid\",\"__proto__\":{\"polluted\":true}}";
  const ctx = createMockContext(
    createSignedHeaders(body, deps.webhookSecret),
    body,
  );
  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /reserved key: __proto__/i,
  );
});
