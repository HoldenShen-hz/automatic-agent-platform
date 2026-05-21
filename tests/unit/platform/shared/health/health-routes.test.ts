/**
 * Unit tests for Health Routes
 *
 * @see src/platform/five-plane-interface/api/http-server/health-routes.ts
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createHealthRoutes } from "../../../../../src/platform/five-plane-interface/api/http-server/health-routes.js";
import type { MissionControlService } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { RouteContext } from "../../../../../src/platform/five-plane-interface/api/http-server/types.js";

// ─────────────────────────────────────────────────────────────────────────────
// Test Fixtures
// ─────────────────────────────────────────────────────────────────────────────

function createMockMissionControlService(health: Record<string, unknown> = { status: "ok" }): MissionControlService {
  return {
    getSnapshot: () => ({ health }),
    getHealthReportAsync: async () => health,
  } as unknown as MissionControlService;
}

function createMockContext(principal?: unknown): RouteContext {
  return {
    requestId: "req-123",
    request: {} as never,
    route: { pathname: "/", segments: [] },
    principal: principal as RouteContext["principal"],
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Route Creation Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createHealthRoutes returns 8 routes", () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  assert.equal(routes.length, 8);
});

test("createHealthRoutes includes all expected health endpoints", () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);

  const pathnames = routes.map((r) => r.pathname);
  assert.ok(pathnames.includes("/livez"));
  assert.ok(pathnames.includes("/readyz"));
  assert.ok(pathnames.includes("/healthz"));
  assert.ok(pathnames.includes("/v1/healthz"));
  assert.ok(pathnames.includes("/health"));
  assert.ok(pathnames.includes("/v1/openapi.json"));
  assert.ok(pathnames.includes("/v1/version"));
  assert.ok(pathnames.includes("/v1/handshake"));
});

test("createHealthRoutes returns array of RouteDefinition", () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);

  for (const route of routes) {
    assert.ok("method" in route);
    assert.ok("pathname" in route);
    assert.ok("handler" in route);
    assert.equal(typeof route.handler, "function");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /livez Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /livez returns 200 with alive status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const livezRoute = routes.find((r) => r.pathname === "/livez")!;
  const response = await livezRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("alive"));
});

test("GET /livez during shutdown returns 200 but indicates shuttingDown", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
    isShuttingDown: () => true,
  };
  const routes = createHealthRoutes(deps);
  const livezRoute = routes.find((r) => r.pathname === "/livez")!;
  const response = await livezRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("shuttingDown"));
  assert.ok(response.body.includes("true"));
});

test("GET /livez without isShuttingDown defaults to false", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const livezRoute = routes.find((r) => r.pathname === "/livez")!;
  const response = await livezRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("false"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /readyz Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /readyz returns 200 when healthy", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
  };
  const routes = createHealthRoutes(deps);
  const readyzRoute = routes.find((r) => r.pathname === "/readyz")!;
  const response = await readyzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ready"));
});

test("GET /readyz returns 503 when shutting down", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
    isShuttingDown: () => true,
  };
  const routes = createHealthRoutes(deps);
  const readyzRoute = routes.find((r) => r.pathname === "/readyz")!;
  const response = await readyzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
  assert.ok(response.body.includes("shutting_down"));
});

test("GET /readyz returns 503 for unhealthy status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "degraded" }),
  };
  const routes = createHealthRoutes(deps);
  const readyzRoute = routes.find((r) => r.pathname === "/readyz")!;
  const response = await readyzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
});

test("GET /readyz includes full health report", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok", uptime: 100 }),
  };
  const routes = createHealthRoutes(deps);
  const readyzRoute = routes.find((r) => r.pathname === "/readyz")!;
  const response = await readyzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.ok(response.body.includes("uptime"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /healthz Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /healthz returns 200 for ok status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /healthz returns 200 for healthy status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "healthy" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("healthy"));
});

test("GET /healthz returns 503 for degraded status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "degraded" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
  assert.ok(response.body.includes("degraded"));
});

test("GET /healthz returns 503 for unhealthy status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "unhealthy" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
});

test("GET /healthz returns 503 for overloaded status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "overloaded" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
});

test("GET /healthz returns 503 when shutting down regardless of status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
    isShuttingDown: () => true,
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/healthz Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /v1/healthz returns 200 for ok status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/v1/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
});

test("GET /v1/healthz returns 503 for unhealthy status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "unhealthy" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/v1/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 503);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /health Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /health returns 200 with full report", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok", uptime: 100 }),
  };
  const routes = createHealthRoutes(deps);
  const healthRoute = routes.find((r) => r.pathname === "/health")!;
  const response = await healthRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("uptime"));
});

test("GET /health always returns 200 regardless of health status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "degraded" }),
  };
  const routes = createHealthRoutes(deps);
  const healthRoute = routes.find((r) => r.pathname === "/health")!;
  const response = await healthRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/openapi.json Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /v1/openapi.json returns 401 without authentication", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const openapiRoute = routes.find((r) => r.pathname === "/v1/openapi.json")!;
  const ctx = createMockContext(null);
  const response = await openapiRoute.handler(ctx);

  assert.ok(response !== null);
  assert.equal(response.statusCode, 401);
  assert.ok(response.body.includes("api.openapi_auth_required"));
});

test("GET /v1/openapi.json returns 200 with authentication", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const openapiRoute = routes.find((r) => r.pathname === "/v1/openapi.json")!;
  const ctx = createMockContext({ actorId: "operator-1" });
  const response = await openapiRoute.handler(ctx);

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("openapi"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/version Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /v1/version returns 200 with version info", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const versionRoute = routes.find((r) => r.pathname === "/v1/version")!;
  const response = await versionRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("minClientVersion"));
  assert.ok(response.body.includes("platformVersion"));
  assert.ok(response.body.includes("contractVersion"));
});

test("GET /v1/version includes apiVersion", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const versionRoute = routes.find((r) => r.pathname === "/v1/version")!;
  const response = await versionRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.ok(response.body.includes("apiVersion"));
  assert.ok(response.body.includes("v1"));
});

// ─────────────────────────────────────────────────────────────────────────────
// GET /v1/handshake Tests
// ─────────────────────────────────────────────────────────────────────────────

test("GET /v1/handshake returns 200 with accepted true", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const handshakeRoute = routes.find((r) => r.pathname === "/v1/handshake")!;
  const response = await handshakeRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"accepted\": true"));
});

test("GET /v1/handshake includes all version fields", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const handshakeRoute = routes.find((r) => r.pathname === "/v1/handshake")!;
  const response = await handshakeRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.ok(response.body.includes("apiVersion"));
  assert.ok(response.body.includes("platformVersion"));
  assert.ok(response.body.includes("contractVersion"));
  assert.ok(response.body.includes("minClientVersion"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Edge Cases
// ─────────────────────────────────────────────────────────────────────────────

test("createHealthRoutes works without isShuttingDown", () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);

  assert.ok(routes.length > 0);
});

test("createHealthRoutes with empty health report", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({}),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  // Empty status defaults to unhealthy, returns 503
  assert.equal(response.statusCode, 503);
});

test("createHealthRoutes with missing health status field", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ uptime: 100 }),
  };
  const routes = createHealthRoutes(deps);
  const healthRoute = routes.find((r) => r.pathname === "/health")!;
  const response = await healthRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
});

test("healthStatusCode function handles ok status correctly", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
});

test("healthStatusCode function handles healthy status correctly", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "healthy" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const response = await healthzRoute.handler(createMockContext());

  assert.ok(response !== null);
  assert.equal(response.statusCode, 200);
});

test("route handler preserves requestId", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const versionRoute = routes.find((r) => r.pathname === "/v1/version")!;
  const ctx = createMockContext();
  ctx.requestId = "custom-request-id";
  const response = await versionRoute.handler(ctx);

  assert.ok(response !== null);
  assert.ok(response.body.includes("custom-request-id") || response.headers?.["x-request-id"] === "custom-request-id");
});