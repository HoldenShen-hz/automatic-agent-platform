import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRoutes } from "../../../../../../src/platform/interface/api/http-server/task-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/interface/api/http-server/types.js";

function createMockMissionControlService(): MissionControlService {
  return {
    getSnapshot: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
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
  } as unknown as MissionControlService;
}

function createMockInspectService(): InspectService {
  return {
    queryTaskInspectSummaries: () => [
      { taskId: "task-1", title: "Test Task", status: "done", createdAt: "2026-04-16T00:00:00.000Z", updatedAt: "2026-04-16T00:00:00.000Z", tenantId: null },
    ],
    getTaskInspectView: () => ({
      task: { id: "task-1", tenantId: null },
      steps: [],
      executions: [],
      approvals: [],
      artifacts: [],
      dispatchDecisions: [],
      stepResults: [],
      runtimeRecovery: { candidates: [] },
      workflowState: null,
    }),
  } as unknown as InspectService;
}

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockContext(pathname = "/tasks", segments: string[] = [], headers: Record<string, string | undefined> = {}): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method: "GET", url: pathname, headers, body: null } as never,
    route: { pathname: routePathname, segments },
    principal: null,
  };
}

/**
 * Finds and calls the correct route handler for a given pathname+segments,
 * mimicking how the HTTP server iterates segment-based routes and returns
 * the first non-null result.
 */
async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  const pathname = ctx.route.pathname;
  for (const route of routes) {
    if (route.method !== (ctx.request.method ?? "GET")) continue;
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

test("createTaskRoutes returns 12 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  assert.equal(routes.length, 12);
});

test("GET /tasks returns task list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks", ["tasks"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task-1"));
});

test("GET /tasks rejects non-numeric limit values", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks?limit=oops", ["tasks"]);
  await assert.rejects(async () => {
    await callRoute(routes, ctx);
  }, /positive integer|invalid_limit/i);
});

test("GET /workflows returns workflow list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/workflows", ["workflows"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("wf-1"));
});

test("GET /tasks/:id returns task cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/task-1", ["tasks", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task-1"));
});

test("GET /tasks/:id/events returns task events", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/task-1/events", ["tasks", "task-1", "events"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("events"));
});

test("GET /tasks/:id/inspect returns task inspect view", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/task-1/inspect", ["tasks", "task-1", "inspect"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task"));
});

test("GET /workflows/:id returns workflow cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/workflows/task-1", ["workflows", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("wf-1"));
});

test("GET /v1/tasks returns task list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/v1/tasks", ["v1", "tasks"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/workflows returns workflow list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/v1/workflows", ["v1", "workflows"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/tasks/:id returns task cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/v1/tasks/task-1", ["v1", "tasks", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/workflows/:id returns workflow cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/v1/workflows/task-1", ["v1", "workflows", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /tasks/:id throws when auth not configured", async () => {
  const deps = {
    authService: null,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/task-1", ["tasks", "task-1"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth.*not configured/i);
  }
});

test("GET /tasks/:id/events throws with invalid task id", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/invalid!@#id/events", ["tasks", "invalid!@#id", "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /invalid.*task|characters/i);
  }
});

test("GET /tasks/:id/events throws when task id exceeds MAX_TASK_ID_LENGTH (128 chars)", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  // Task ID with 129 characters (exceeds 128 limit)
  const longTaskId = "a".repeat(129);
  const ctx = createMockContext(`/tasks/${longTaskId}/events`, ["tasks", longTaskId, "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /exceeds maximum length|128/i);
  }
});

test("GET /tasks/:id/events accepts task id at exactly MAX_TASK_ID_LENGTH (128 chars)", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  // Task ID with exactly 128 characters - should be valid
  const maxLengthTaskId = "a".repeat(128);
  const ctx = createMockContext(`/tasks/${maxLengthTaskId}/events`, ["tasks", maxLengthTaskId, "events"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /tasks/:id/events throws when auth not configured", async () => {
  const deps = {
    authService: null,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/tasks/task-1/events", ["tasks", "task-1", "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});
