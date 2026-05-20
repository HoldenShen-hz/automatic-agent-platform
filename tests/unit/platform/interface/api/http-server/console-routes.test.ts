import assert from "node:assert/strict";
import test from "node:test";

import { createConsoleRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/console-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { GatewayTargetDirectoryService } from "../../../../../../src/platform/five-plane-interface/channel-gateway/gateway-target-directory-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockMissionControlService(): MissionControlService {
  return {
    getSnapshot: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [{ taskId: "task-1", title: "Test Task", taskStatus: "done" }],
      pendingApprovals: [],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    }),
    getTaskCockpit: () => ({
      snapshot: {
        task: { id: "task-1", title: "Test Task", status: "done", tenantId: null, createdAt: "2026-04-16T00:00:00.000Z", updatedAt: "2026-04-16T00:00:00.000Z" },
        events: [],
        artifacts: [],
      },
      inspect: { task: { id: "task-1" }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
    listWorkflowCockpits: () => [
      { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0 },
    ],
    getWorkflowCockpit: () => ({
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
    listApprovalQueue: () => [],
    getStabilityPanel: () => ({
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      pendingApprovals: [],
      findings: [],
      blockedTasks: [],
      workers: [],
    }),
    getAdminTakeoverConsole: () => ({
      scope: { taskId: "task-1", divisionId: null, workspaceId: null, tenantId: null },
      inspect: { takeoverSessions: [], operatorActions: [] },
      executionOwner: {},
      activeWorker: null,
      latestPmfVerdict: null,
      timeline: { entries: [] },
    }),
  } as unknown as MissionControlService;
}

function createMockTargetDirectoryService(): GatewayTargetDirectoryService {
  return {
    listTargets: () => [
      { targetId: "tgt-1", displayName: "Target One", source: "directory" as const, lastSeenAt: null },
    ],
  } as unknown as GatewayTargetDirectoryService;
}

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/console", segments: string[] = [], headers: Record<string, string | undefined> = {}): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body: null } as never,
    route: { pathname, segments },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  const method = ctx.request.method ?? "GET";
  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.pathname !== null) {
      if (route.pathname === pathname) {
        return route.handler(ctx);
      }
    } else if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

test("createConsoleRoutes returns 8 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  assert.equal(routes.length, 8);
});

test("GET /console returns HTML dashboard", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console", ["console"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
  assert.match(response.body, /\/ws\/v1\/stream/);
  assert.match(response.body, /Sec-WebSocket-Protocol/);
});

test("GET /console throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console", ["console"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /console/tasks/:id returns task HTML", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/tasks/task-1", ["console", "tasks", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});

test("GET /console/workflows returns workflow list HTML", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/workflows", ["console", "workflows"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});

test("GET /console/approvals returns approval center HTML", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/approvals", ["console", "approvals"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});

test("GET /console/stability returns stability panel HTML", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/stability", ["console", "stability"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});

test("GET /console/targets returns gateway targets HTML", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/targets", ["console", "targets"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});

test("GET /console/targets throws 503 when service unavailable", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: null,
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/targets", ["console", "targets"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /not configured/);
  }
});

test("GET /console/admin/tasks/:id returns admin takeover HTML", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    gatewayTargetDirectoryService: createMockTargetDirectoryService(),
  };
  const routes = createConsoleRoutes(deps);
  const ctx = createMockContext("/console/admin/tasks/task-1", ["console", "admin", "tasks", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.headers["content-type"]?.includes("html"));
});
