import assert from "node:assert/strict";
import test from "node:test";

import { createBillingRoutes } from "../../../../../../src/platform/interface/api/http-server/billing-routes.js";
import type { BillingService } from "../../../../../../src/scale-ecosystem/marketplace/billing-service.js";
import type { RouteContext } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockBillingService(result: Record<string, unknown> = { sessionRef: "sess-123", status: "paid" }): BillingService {
  return {
    reconcilePaymentSession: () => result,
  } as unknown as BillingService;
}

function createMockContext(headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "POST", url: "/v1/billing/webhooks/reconcile", headers, body } as never,
    route: { pathname: "/v1/billing/webhooks/reconcile", segments: [] },
    principal: null,
  };
}

test("createBillingRoutes exposes only the versioned reconcile route", () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  assert.equal(routes.length, 1);
  assert.equal(routes[0]?.pathname, "/v1/billing/webhooks/reconcile");
});

test("POST /v1/billing/webhooks/reconcile returns result when billing service available", async () => {
  const deps = {
    billingService: createMockBillingService({ sessionRef: "v1-sess", status: "pending" }),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "key123", "x-webhook-signature": "secret123" }, JSON.stringify({
    gatewayKind: "paddle",
    gatewaySessionRef: "v1-sess",
    status: "pending",
  }));
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("v1-sess"));
});

test("POST /v1/billing/webhooks/reconcile throws 503 when billing service not configured", async () => {
  const deps = {
    billingService: null,
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "key123", "x-webhook-signature": "secret123" }, JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  }));
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Billing service is not configured/);
  }
});

test("POST /v1/billing/webhooks/reconcile validates payload", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "key123", "x-webhook-signature": "secret123" }, JSON.stringify({
    gatewayKind: "invalid-gateway",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  }));
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /invalid/i);
  }
});

test("POST /v1/billing/webhooks/reconcile rejects missing webhook signature", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "expected-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "key123" }, JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  }));
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /signature/);
  }
});

test("POST /v1/billing/webhooks/reconcile rejects dangerous JSON keys", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext(
    { authorization: "Bearer token123", "x-webhook-signature": "secret123" },
    "{\"gatewayKind\":\"stripe\",\"gatewaySessionRef\":\"sess-abc\",\"status\":\"paid\",\"__proto__\":{\"polluted\":true}}",
  );
  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /reserved key: __proto__/i,
  );
});
