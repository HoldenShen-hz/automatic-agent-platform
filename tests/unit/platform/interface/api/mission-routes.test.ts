import assert from "node:assert/strict";
import test from "node:test";

import { createMissionRoutes } from "../../../../../src/platform/five-plane-interface/api/http-server/mission-routes.js";
import type { MissionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import type { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";

test("createMissionRoutes returns array of route definitions", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);
});

test("createMissionRoutes includes POST /v1/missions route", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  const postRoute = routes.find((r) => r.method === "POST" && r.pathname === "/v1/missions");
  assert.ok(postRoute !== undefined);
  assert.equal(postRoute!.method, "POST");
  assert.equal(postRoute!.pathname, "/v1/missions");
});

test("createMissionRoutes includes GET /v1/missions route", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  const getRoute = routes.find((r) => r.method === "GET" && r.pathname === "/v1/missions");
  assert.ok(getRoute !== undefined);
  assert.equal(getRoute!.method, "GET");
  assert.equal(getRoute!.pathname, "/v1/missions");
});

test("createMissionRoutes includes POST /v1/mission-resolutions:dry-run route", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  const dryRunRoute = routes.find((r) => r.method === "POST" && r.pathname === "/v1/mission-resolutions:dry-run");
  assert.ok(dryRunRoute !== undefined);
  assert.equal(dryRunRoute!.method, "POST");
  assert.equal(dryRunRoute!.pathname, "/v1/mission-resolutions:dry-run");
});

test("createMissionRoutes with custom mission repository", () => {
  const mockRepo = {
    listMissions: (tenantId: string) => [],
    getMission: (missionId: string) => null,
    createMission: (mission: any) => mission,
    updateMission: (mission: any, event: any) => mission,
    listMemberships: (missionId: string) => [],
    listMissionTasks: (missionId: string) => [],
    listMissionRuns: (missionId: string) => [],
    listMissionEvidence: (missionId: string) => [],
    addMembership: (membership: any) => membership,
    revokeMembershipById: (missionId: string, membershipId: string, actorId: string, traceId: string, correlationId: string) => null,
  } as unknown as MissionRepository;
  const deps = { authService: null, missionRepository: mockRepo };
  const routes = createMissionRoutes(deps);
  assert.ok(Array.isArray(routes));
});

test("createMissionRoutes routes have handler functions", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  for (const route of routes) {
    assert.equal(typeof route.handler, "function");
  }
});

test("createMissionRoutes segment routes have segments flag", () => {
  const deps = { authService: null, missionRepository: null };
  const routes = createMissionRoutes(deps);
  const segmentRoutes = routes.filter((r) => r.segments === true);
  assert.ok(segmentRoutes.length > 0);
  for (const route of segmentRoutes) {
    assert.equal(route.segments, true);
  }
});

test("createMissionRoutes with authService provided", () => {
  const mockAuthService = {
    authenticate: (request: any) => ({ actorId: "test-actor", tenantId: "test-tenant" }),
    requireAuth: (request: any) => ({ actorId: "test-actor", tenantId: "test-tenant" }),
  } as unknown as ApiAuthService;
  const deps = { authService: mockAuthService, missionRepository: null };
  const routes = createMissionRoutes(deps);
  assert.ok(Array.isArray(routes));
  assert.ok(routes.length > 0);
});