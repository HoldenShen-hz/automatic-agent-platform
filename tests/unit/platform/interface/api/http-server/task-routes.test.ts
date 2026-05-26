import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

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
      { taskId: "task-2", workflowId: "wf-2", workflowStatus: "running", currentStepIndex: 1, pendingApprovalCount: 1, retryCount: 0, updatedAt: "2026-04-17T00:00:00.000Z" },
      { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, updatedAt: "2026-04-16T00:00:00.000Z" },
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
      { taskId: "task-3", title: "Test Task 3", divisionId: null, priority: "normal", taskStatus: "queued", workflowId: null, workflowStatus: null, currentStepIndex: null, sessionStatus: null, activeExecutionId: null, latestExecutionStatus: null, pendingApprovalCount: 0, resolvedApprovalCount: 0, dispatchDecisionCount: 0, latestEventAt: null, updatedAt: "2026-04-18T00:00:00.000Z" },
      { taskId: "task-2", title: "Test Task 2", divisionId: null, priority: "normal", taskStatus: "running", workflowId: null, workflowStatus: null, currentStepIndex: null, sessionStatus: null, activeExecutionId: null, latestExecutionStatus: null, pendingApprovalCount: 0, resolvedApprovalCount: 0, dispatchDecisionCount: 0, latestEventAt: null, updatedAt: "2026-04-17T00:00:00.000Z" },
      { taskId: "task-1", title: "Test Task", divisionId: null, priority: "normal", taskStatus: "done", workflowId: null, workflowStatus: null, currentStepIndex: null, sessionStatus: null, activeExecutionId: null, latestExecutionStatus: null, pendingApprovalCount: 0, resolvedApprovalCount: 0, dispatchDecisionCount: 0, latestEventAt: null, updatedAt: "2026-04-16T00:00:00.000Z" },
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

test("createTaskRoutes returns 11 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  assert.equal(routes.length, 11);
});

test("GET /v1/tasks returns task list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.deepEqual(body.data.tasks.map((task: { taskId: string }) => task.taskId), ["task-3", "task-2", "task-1"]);
  assert.equal(body.data.nextCursor, null);
  assert.equal(body.data.hasMore, false);
});

test("GET /v1/tasks rejects non-numeric limit values", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks?limit=oops", ["api", "v1", "tasks"]);
  await assert.rejects(async () => {
    await callRoute(routes, ctx);
  }, /positive integer|invalid_limit/i);
});

test("GET /v1/workflows returns workflow list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/workflows", ["api", "v1", "workflows"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.deepEqual(body.data.workflows.map((workflow: { taskId: string }) => workflow.taskId), ["task-2", "task-1"]);
});

test("GET /v1/workflows/builder returns Layer C workflow builder summaries", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/v1/workflows/builder", ["v1", "workflows", "builder"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(body.data.map((workflow) => workflow.id), ["wf-2", "wf-1"]);
  assert.equal(body.data[0]?.title, "wf-2");
  assert.equal(body.data[0]?.status, "running");
});

test("GET /v1/tasks supports cursor pagination", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);

  const firstPage = await callRoute(routes, createMockContext("/api/v1/tasks?limit=2", ["api", "v1", "tasks"]));
  if (!firstPage) throw new Error("Handler returned null");
  const firstBody = JSON.parse(firstPage.body);
  assert.deepEqual(firstBody.data.tasks.map((task: { taskId: string }) => task.taskId), ["task-3", "task-2"]);
  assert.equal(firstBody.data.hasMore, true);
  assert.equal(typeof firstBody.data.nextCursor, "string");

  const secondPage = await callRoute(
    routes,
    createMockContext(`/api/v1/tasks?limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor)}`, ["api", "v1", "tasks"]),
  );
  if (!secondPage) throw new Error("Handler returned null");
  const secondBody = JSON.parse(secondPage.body);
  assert.deepEqual(secondBody.data.tasks.map((task: { taskId: string }) => task.taskId), ["task-1"]);
  assert.equal(secondBody.data.hasMore, false);
  assert.equal(secondBody.data.nextCursor, null);
});

test("GET /v1/workflows supports cursor pagination", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const response = await callRoute(routes, createMockContext("/api/v1/workflows?limit=1", ["api", "v1", "workflows"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body);
  assert.deepEqual(body.data.workflows.map((workflow: { taskId: string }) => workflow.taskId), ["task-2"]);
  assert.equal(body.data.hasMore, true);
  assert.equal(typeof body.data.nextCursor, "string");
});

test("GET /v1/tasks/:id returns task cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/task-1", ["api", "v1", "tasks", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task-1"));
});

test("GET /v1/tasks/:id/events returns task events", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/task-1/events", ["api", "v1", "tasks", "task-1", "events"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("events"));
});

test("GET /v1/tasks/:id/inspect returns task inspect view", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/task-1/inspect", ["api", "v1", "tasks", "task-1", "inspect"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task"));
});

test("GET /v1/workflows/:id returns workflow cockpit", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/workflows/task-1", ["api", "v1", "workflows", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("wf-1"));
});

test("POST /v1/workflows/:id/pause returns workflow action response", async () => {
  const deps = {
    authService: {
      requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: null }),
    } as unknown as ApiAuthService,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = {
    requestId: "req-123",
    request: { method: "POST", url: "/api/v1/workflows/task-1/pause", headers: {}, body: null } as never,
    route: { pathname: "/api/v1/workflows/task-1/pause", segments: ["api", "v1", "workflows", "task-1", "pause"] },
    principal: null,
  } satisfies RouteContext;
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body);
  assert.equal(body.data.action, "pause");
  assert.equal(body.data.status, "paused");
});

test("GET /v1/tasks returns task list", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"]);
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
  const ctx = createMockContext("/api/v1/workflows", ["api", "v1", "workflows"]);
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
  const ctx = createMockContext("/api/v1/tasks/task-1", ["api", "v1", "tasks", "task-1"]);
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
  const ctx = createMockContext("/api/v1/workflows/task-1", ["api", "v1", "workflows", "task-1"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/tasks/:id throws when auth not configured", async () => {
  const deps = {
    authService: null,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/task-1", ["api", "v1", "tasks", "task-1"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth.*not configured/i);
  }
});

test("GET /v1/tasks/:id/events throws with invalid task id", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/invalid!@#id/events", ["api", "v1", "tasks", "invalid!@#id", "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /invalid.*task|characters/i);
  }
});

test("GET /v1/tasks/:id/events throws when task id exceeds MAX_TASK_ID_LENGTH (128 chars)", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  // Task ID with 129 characters (exceeds 128 limit)
  const longTaskId = "a".repeat(129);
  const ctx = createMockContext(`/api/v1/tasks/${longTaskId}/events`, ["api", "v1", "tasks", longTaskId, "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /exceeds maximum length|128/i);
  }
});

test("GET /v1/tasks/:id/events accepts task id at exactly MAX_TASK_ID_LENGTH (128 chars)", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  // Task ID with exactly 128 characters - should be valid
  const maxLengthTaskId = "a".repeat(128);
  const ctx = createMockContext(`/api/v1/tasks/${maxLengthTaskId}/events`, ["api", "v1", "tasks", maxLengthTaskId, "events"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
});

test("GET /v1/tasks/:id/events throws when auth not configured", async () => {
  const deps = {
    authService: null,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks/task-1/events", ["api", "v1", "tasks", "task-1", "events"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});
