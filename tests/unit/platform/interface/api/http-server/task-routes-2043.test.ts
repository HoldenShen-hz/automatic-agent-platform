/**
 * @fileoverview Unit tests for Task Routes - Issue #2043
 *
 * ISSUE #2043: PATCH title update wiring
 *
 * The PATCH handler should propagate title updates all the way through parsing
 * and persistence. These tests verify the previously reported dead path stays closed.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRoutes } from "../../../../../../src/platform/interface/api/http-server/task-routes.js";
import { parseUpdateTaskPayload } from "../../../../../../src/platform/interface/api/http-server/schemas.js";
import type { MissionControlService } from "../../../../../../src/platform/interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/interface/api/api-auth-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import type { IntakeAdmissionService } from "../../../../../../src/platform/orchestration/harness/runtime/intake-admission-service.js";
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
    listWorkflowCockpits: () => [],
    getWorkflowCockpit: () => ({
      summary: { taskId: "task-1", workflowId: "wf-1", workflowStatus: "done", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-1", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
  } as unknown as MissionControlService;
}

function createMockInspectService(): InspectService {
  return {
    queryTaskInspectSummaries: () => [],
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
    requireRole: () => ({ actorId: "actor-1", roles: ["operator"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockTaskStore(): AuthoritativeTaskStore {
  return {
    task: {
      getTask: () => ({
        id: "task-1",
        title: "Original Title",
        status: "running",
        tenantId: null,
        inputJson: "{}",
        normalizedInputJson: null,
      }),
      updateTaskTitle: () => {},
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockIntakeAdmissionService(): IntakeAdmissionService {
  return {
    admit: () => {},
  } as unknown as IntakeAdmissionService;
}

function createMockContext(pathname = "/api/v1/tasks", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null, method: string = "GET"): RouteContext {
  return {
    requestId: "req-123",
    request: { method, url: pathname, headers, body } as never,
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

// ── Issue #2043: PATCH title update is dead code ────────────────────────────────

/**
 * ISSUE #2043 TEST SUITE
 *
 * The parseUpdateTaskPayload function always returns an object where title is undefined
 * because the schema defines title as optional and the route code does:
 *   if (payload.title != null) {
 *     deps.taskStore.task.updateTaskTitle(taskId, payload.title, now);
 *   }
 *
 * But parseUpdateTaskPayload returns { title: undefined } when only title is provided
 * in the payload, due to how Zod optional works with the spread operator.
 *
 * ACTUAL BEHAVIOR: Title updates never happen because payload.title is always undefined
 * EXPECTED BEHAVIOR: Title updates should work when title is provided
 */

test("ISSUE #2043: parseUpdateTaskPayload returns title when provided", () => {
  const payload = parseUpdateTaskPayload({ title: "New Title" });

  assert.equal(payload.title, "New Title");
});

test("ISSUE #2043: parseUpdateTaskPayload returns empty object when no fields provided", () => {
  const payload = parseUpdateTaskPayload({});

  // Returns empty object - no fields are set
  assert.deepEqual(payload, {});
});

test("ISSUE #2043: parseUpdateTaskPayload includes title when explicitly set", () => {
  const payload = parseUpdateTaskPayload({
    title: "My New Task Title",
    status: "running",
  });

  assert.equal(payload.status, "running");
  assert.equal(payload.title, "My New Task Title");
});

test("ISSUE #2043: PATCH route calls updateTaskTitle when title is provided", async () => {
  let titleUpdated = false;
  const mockTaskStore = {
    task: {
      getTask: () => ({
        id: "task-1",
        title: "Original Title",
        status: "running",
        tenantId: null,
        inputJson: "{}",
        normalizedInputJson: null,
      }),
      updateTaskTitle: (_id: string, _title: string, _now: string) => {
        titleUpdated = true;
      },
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
    intakeAdmissionService: createMockIntakeAdmissionService(),
  };
  const routes = createTaskRoutes(deps);

  const ctx = createMockContext(
    "/api/v1/tasks/task-1",
    ["api", "v1", "tasks", "task-1"],
    {},
    JSON.stringify({ title: "Updated Title" }),
    "PATCH",
  );

  await callRoute(routes, ctx);

  assert.equal(titleUpdated, true);
});

test("ISSUE #2043: The title update condition forwards the provided title", async () => {
  let capturedTitle: string | undefined;
  const mockTaskStore = {
    task: {
      getTask: () => ({
        id: "task-1",
        title: "Original Title",
        status: "running",
        tenantId: null,
        inputJson: "{}",
        normalizedInputJson: null,
      }),
      updateTaskTitle: (_id: string, title: string, _now: string) => {
        capturedTitle = title;
      },
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
    intakeAdmissionService: createMockIntakeAdmissionService(),
  };
  const routes = createTaskRoutes(deps);

  const ctx = createMockContext(
    "/api/v1/tasks/task-1",
    ["api", "v1", "tasks", "task-1"],
    {},
    JSON.stringify({ title: "Should Update Title" }),
    "PATCH",
  );

  await callRoute(routes, ctx);

  assert.equal(capturedTitle, "Should Update Title");
});

test("ISSUE #2043: Status update works (not dead code)", async () => {
  let statusUpdated = false;
  const mockTaskStore = {
    task: {
      getTask: () => ({
        id: "task-1",
        title: "Original Title",
        status: "running",
        tenantId: null,
        inputJson: "{}",
        normalizedInputJson: null,
      }),
      updateTaskTitle: () => {},
      updateTaskInput: () => {},
      updateTaskStatus: (_id: string, _status: string, _now: string, _error: string | null, _completed: string | null) => {
        statusUpdated = true;
      },
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
    intakeAdmissionService: createMockIntakeAdmissionService(),
  };
  const routes = createTaskRoutes(deps);

  const ctx = createMockContext(
    "/api/v1/tasks/task-1",
    ["api", "v1", "tasks", "task-1"],
    {},
    JSON.stringify({ status: "paused" }),
    "PATCH",
  );

  await callRoute(routes, ctx);

  // Status update IS called because status is properly parsed
  assert.equal(statusUpdated, true);
});

test("ISSUE #2043: outputJson update works (not dead code)", async () => {
  let outputUpdated = false;
  const mockTaskStore = {
    task: {
      getTask: () => ({
        id: "task-1",
        title: "Original Title",
        status: "running",
        tenantId: null,
        inputJson: "{}",
        normalizedInputJson: null,
      }),
      updateTaskTitle: () => {},
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: (_id: string, _output: string, _now: string) => {
        outputUpdated = true;
      },
    },
  } as unknown as AuthoritativeTaskStore;

  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
    intakeAdmissionService: createMockIntakeAdmissionService(),
  };
  const routes = createTaskRoutes(deps);

  const ctx = createMockContext(
    "/api/v1/tasks/task-1",
    ["api", "v1", "tasks", "task-1"],
    {},
    JSON.stringify({ outputJson: '{"result": "done"}' }),
    "PATCH",
  );

  await callRoute(routes, ctx);

  // Output update IS called
  assert.equal(outputUpdated, true);
});
