import assert from "node:assert/strict";
import test from "node:test";

import { createHealthRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/health-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { RouteContext } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockMissionControlService(health: Record<string, unknown> = { status: "ok" }): MissionControlService {
  return {
    getSnapshot: () => ({ health }),
    getHealthReportAsync: async () => health,
  } as unknown as MissionControlService;
}

function createMockContext(): RouteContext {
  return {
    requestId: "req-123",
    request: {} as never,
    route: { pathname: "/", segments: [] },
    principal: null,
  };
}

test("createHealthRoutes returns readiness, liveness, health, and OpenAPI routes", () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  assert.equal(routes.length, 8);
  assert.ok(routes.some((route) => route.pathname === "/v1/version"));
  assert.ok(routes.some((route) => route.pathname === "/v1/handshake"));
});

test("GET /livez returns alive during shutdown without marking ready", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
    isShuttingDown: () => true,
  };
  const routes = createHealthRoutes(deps);
  const livezRoute = routes.find((r) => r.pathname === "/livez")!;
  const response = await livezRoute.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("alive"));
});

test("GET /readyz returns 503 while shutting down", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
    isShuttingDown: () => true,
  };
  const routes = createHealthRoutes(deps);
  const readyzRoute = routes.find((r) => r.pathname === "/readyz")!;
  const response = await readyzRoute.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 503);
  assert.ok(response.body.includes("shutting_down"));
});

test("GET /healthz returns health status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok", uptime: 100 }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/healthz")!;
  const ctx = createMockContext();
  const response = await healthzRoute.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /v1/healthz returns health status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "degraded" }),
  };
  const routes = createHealthRoutes(deps);
  const healthzRoute = routes.find((r) => r.pathname === "/v1/healthz")!;
  const ctx = createMockContext();
  const response = await healthzRoute.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("degraded"));
});

test("GET /health returns health status", async () => {
  const deps = {
    missionControlService: createMockMissionControlService({ status: "ok" }),
  };
  const routes = createHealthRoutes(deps);
  const healthRoute = routes.find((r) => r.pathname === "/health")!;
  const ctx = createMockContext();
  const response = await healthRoute.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/openapi.json returns OpenAPI document", async () => {
  const deps = {
    missionControlService: createMockMissionControlService(),
  };
  const routes = createHealthRoutes(deps);
  const openapiRoute = routes.find((r) => r.pathname === "/v1/openapi.json")!;
  const ctx = createMockContext();
  const response = await openapiRoute.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("openapi"));
});

test("GET /v1/version returns SDK compatibility metadata", async () => {
  const routes = createHealthRoutes({
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/version")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("minClientVersion"));
});

test("GET /v1/handshake returns accepted compatibility metadata", async () => {
  const routes = createHealthRoutes({
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/handshake")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"accepted\": true"));
});
