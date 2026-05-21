import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../../src/platform/five-plane-interface/api/inspect-service.js";
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

/**
 * [ARCH-P1-3] Verify all list endpoints return cursor-based pagination fields
 *
 * Tests the endpoints that support cursor-based pagination as required by architecture §6.6.
 * The reference manual specifies /api/tasks, /api/domains, /api/executions, /api/audit-logs.
 * This test covers the implemented task and workflow list endpoints.
 */
test("[ARCH-P1-3] list endpoints return cursor-based pagination fields", async () => {
  const taskDeps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const taskRoutes = createTaskRoutes(taskDeps);

  // Test /api/v1/tasks endpoint
  const tasksResponse = await callRoute(taskRoutes, createMockContext("/api/v1/tasks", ["api", "v1", "tasks"]));
  if (!tasksResponse) throw new Error("Handler returned null");
  const tasksBody = JSON.parse(tasksResponse.body);
  assert.ok(
    tasksBody.data.cursor !== undefined || tasksBody.data.nextCursor !== undefined,
    "/api/v1/tasks must return cursor field",
  );
  assert.ok(Array.isArray(tasksBody.data.tasks), "/api/v1/tasks must return items");

  // Test /api/v1/workflows endpoint
  const workflowsResponse = await callRoute(taskRoutes, createMockContext("/api/v1/workflows", ["api", "v1", "workflows"]));
  if (!workflowsResponse) throw new Error("Handler returned null");
  const workflowsBody = JSON.parse(workflowsResponse.body);
  assert.ok(
    workflowsBody.data.cursor !== undefined || workflowsBody.data.nextCursor !== undefined,
    "/api/v1/workflows must return cursor field",
  );
  assert.ok(Array.isArray(workflowsBody.data.workflows), "/api/v1/workflows must return items");
});

/**
 * [ARCH-P1-3] Verify cursor-based pagination traverses all records correctly
 */
test("[ARCH-P1-3] cursor-based pagination traverses all records", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);

  const allItems: string[] = [];
  let cursor: string | undefined;

  do {
    let url = "/api/v1/tasks?limit=2";
    if (cursor) {
      url += `&cursor=${encodeURIComponent(cursor)}`;
    }
    const res = await callRoute(routes, createMockContext(url, ["api", "v1", "tasks"]));
    if (!res) throw new Error("Handler returned null");
    const body = JSON.parse(res.body);
    allItems.push(...body.data.tasks.map((task: { taskId: string }) => task.taskId));
    cursor = body.data.nextCursor ?? body.data.cursor;
  } while (cursor);

  assert.ok(allItems.length > 0, "Must retrieve records via cursor");
  // Should have retrieved all 3 tasks from mock service
  assert.equal(allItems.length, 3, "Must retrieve all 3 tasks via cursor pagination");
  assert.deepEqual(allItems, ["task-3", "task-2", "task-1"], "Must retrieve tasks in correct order");
});

/**
 * [ARCH-P1-3] Verify /api/tasks supports cursor pagination
 */
test("[ARCH-P1-3] /api/tasks supports cursor pagination", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);

  // First page with limit 2
  const firstPage = await callRoute(routes, createMockContext("/api/v1/tasks?limit=2", ["api", "v1", "tasks"]));
  if (!firstPage) throw new Error("Handler returned null");
  const firstBody = JSON.parse(firstPage.body);

  assert.deepEqual(firstBody.data.tasks.map((task: { taskId: string }) => task.taskId), ["task-3", "task-2"]);
  assert.equal(firstBody.data.hasMore, true);
  assert.equal(typeof firstBody.data.nextCursor, "string");

  // Second page using cursor
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

/**
 * [ARCH-P1-3] Verify /api/workflows supports cursor pagination
 */
test("[ARCH-P1-3] /api/workflows supports cursor pagination", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createTaskRoutes(deps);

  const firstPage = await callRoute(routes, createMockContext("/api/v1/workflows?limit=1", ["api", "v1", "workflows"]));
  if (!firstPage) throw new Error("Handler returned null");
  const firstBody = JSON.parse(firstPage.body);

  assert.deepEqual(firstBody.data.workflows.map((workflow: { taskId: string }) => workflow.taskId), ["task-2"]);
  assert.equal(firstBody.data.hasMore, true);
  assert.equal(typeof firstBody.data.nextCursor, "string");

  const secondPage = await callRoute(
    routes,
    createMockContext(`/api/v1/workflows?limit=1&cursor=${encodeURIComponent(firstBody.data.nextCursor)}`, ["api", "v1", "workflows"]),
  );
  if (!secondPage) throw new Error("Handler returned null");
  const secondBody = JSON.parse(secondPage.body);

  assert.deepEqual(secondBody.data.workflows.map((workflow: { taskId: string }) => workflow.taskId), ["task-1"]);
  assert.equal(secondBody.data.hasMore, false);
  assert.equal(secondBody.data.nextCursor, null);
});