import assert from "node:assert/strict";
import test from "node:test";

import { createBillingRoutes } from "../../../../../../src/platform/interface/api/http-server/billing-routes.js";
import { ApiAuthError } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { BillingService } from "../../../../../../src/scale-ecosystem/marketplace/billing-service.js";
import type { RouteContext } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockBillingService(result: Record<string, unknown> = { sessionRef: "sess-123", status: "paid" }): BillingService {
  return {
    reconcilePaymentSession: () => result,
  } as unknown as BillingService;
}

function createMockAuthService() {
  return {
    authenticate(headers: Record<string, string | undefined>) {
      if (headers.authorization === "Bearer valid-token" || headers["x-api-key"] === "valid-key") {
        return {
          actorId: "user-1",
          roles: ["operator"],
          authMethod: "jwt",
          tenantId: null,
        };
      }
      throw new ApiAuthError(401, "api.auth_invalid", "Invalid credentials");
    },
  };
}

function createMockContext(headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "POST", url: "/billing/webhooks/reconcile", headers, body } as never,
    route: { pathname: "/billing/webhooks/reconcile", segments: [] },
    principal: null,
  };
}

test("createBillingRoutes returns 2 routes", () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "secret123",
  };
  const routes = createBillingRoutes(deps);
  assert.equal(routes.length, 2);
});

test("POST /billing/webhooks/reconcile returns result when billing service available", async () => {
  const deps = {
    billingService: createMockBillingService({ sessionRef: "sess-abc", status: "paid", amount: 100 }),
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ authorization: "Bearer valid-token" }, JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  }));
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("sess-abc"));
});

test("POST /billing/webhooks/reconcile throws 503 when billing service not configured", async () => {
  const deps = {
    billingService: null,
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ authorization: "Bearer valid-token" }, JSON.stringify({
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

test("POST /billing/webhooks/reconcile validates payload", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ authorization: "Bearer valid-token" }, JSON.stringify({
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

test("POST /v1/billing/webhooks/reconcile returns result when billing service available", async () => {
  const deps = {
    billingService: createMockBillingService({ sessionRef: "v1-sess", status: "pending" }),
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "valid-key" }, JSON.stringify({
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
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ "x-api-key": "valid-key" }, JSON.stringify({
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

test("POST /billing/webhooks/reconcile throws 401 when no auth and invalid signature", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "expected-secret",
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext({}, JSON.stringify({
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

test("POST /billing/webhooks/reconcile does not bypass signature verification for invalid auth headers", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "expected-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext({ authorization: "Bearer invalid-token" }, JSON.stringify({
    gatewayKind: "stripe",
    gatewaySessionRef: "sess-abc",
    status: "paid",
  }));

  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /signature/i,
  );
});

test("POST /billing/webhooks/reconcile rejects dangerous JSON keys", async () => {
  const deps = {
    billingService: createMockBillingService(),
    webhookSecret: "test-webhook-secret",
    authService: createMockAuthService(),
  };
  const routes = createBillingRoutes(deps);
  const route = routes.find((r) => r.pathname === "/billing/webhooks/reconcile")!;
  const ctx = createMockContext(
    { authorization: "Bearer valid-token" },
    "{\"gatewayKind\":\"stripe\",\"gatewaySessionRef\":\"sess-abc\",\"status\":\"paid\",\"__proto__\":{\"polluted\":true}}",
  );
  await assert.rejects(
    async () => {
      await route.handler(ctx);
    },
    /reserved key: __proto__/i,
  );
});
