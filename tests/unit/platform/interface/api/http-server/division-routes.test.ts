import assert from "node:assert/strict";
import test from "node:test";

import { createDivisionRoutes } from "../../../../../../src/platform/interface/api/http-server/division-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { DivisionRegistry } from "../../../../../../src/domains/governance/division-loader.js";
import type { RouteContext } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockMissionControlService(divisions: Record<string, unknown>[] = []): MissionControlService {
  return {
    getSnapshot: () => ({ divisions }),
  } as unknown as MissionControlService;
}

function createMockDivisionRegistry(divisions = [{ id: "div-1", name: "Test Division", description: "A test", defaultWorkflowId: "wf-1" }]): DivisionRegistry {
  const map = new Map<string, { id: string; name: string; description: string; defaultWorkflowId: string }>();
  for (const div of divisions) {
    map.set(div.id, div as { id: string; name: string; description: string; defaultWorkflowId: string });
  }
  return { divisions: map } as unknown as DivisionRegistry;
}

function createMockContext(): RouteContext {
  return {
    requestId: "req-123",
    request: {} as never,
    route: { pathname: "/", segments: [] },
    principal: null,
  };
}

test("createDivisionRoutes returns 2 routes", () => {
  const deps = {
    divisionRegistry: createMockDivisionRegistry(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDivisionRoutes(deps);
  assert.equal(routes.length, 2);
});

test("GET /divisions returns divisions from registry", async () => {
  const deps = {
    divisionRegistry: createMockDivisionRegistry([
      { id: "div-1", name: "Division One", description: "First", defaultWorkflowId: "wf-1" },
      { id: "div-2", name: "Division Two", description: "Second", defaultWorkflowId: "wf-2" },
    ]),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDivisionRoutes(deps);
  const route = routes.find((r) => r.pathname === "/divisions")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("Division One"));
  assert.ok(response.body.includes("div-1"));
});

test("GET /divisions falls back to missionControlService when registry is null", async () => {
  const deps = {
    divisionRegistry: null,
    missionControlService: createMockMissionControlService([{ divisionId: "snap-1", name: "Snapshot Div" }]),
  };
  const routes = createDivisionRoutes(deps);
  const route = routes.find((r) => r.pathname === "/divisions")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("Snapshot Div"));
});

test("GET /v1/divisions returns divisions from registry", async () => {
  const deps = {
    divisionRegistry: createMockDivisionRegistry([
      { id: "div-v1", name: "V1 Division", description: "Version 1", defaultWorkflowId: "wf-v1" },
    ]),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDivisionRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/divisions")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("V1 Division"));
});

test("GET /v1/divisions falls back to missionControlService when registry is null", async () => {
  const deps = {
    divisionRegistry: null,
    missionControlService: createMockMissionControlService([{ divisionId: "v1-snap", name: "V1 Snapshot" }]),
  };
  const routes = createDivisionRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/divisions")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("v1-snap"));
});
