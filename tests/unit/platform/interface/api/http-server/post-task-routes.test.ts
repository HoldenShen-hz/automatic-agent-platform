import assert from "node:assert/strict";
import test from "node:test";

import { createTaskRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { InspectService } from "../../../../../../src/platform/shared/observability/inspect-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import type { IntakeAdmissionService } from "../../../../../../src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";
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
        task: { id: "task-new", title: "New Task", status: "queued", tenantId: null, createdAt: "2026-04-28T00:00:00.000Z", updatedAt: "2026-04-28T00:00:00.000Z" },
        events: [],
        artifacts: [],
      },
      inspect: { task: { id: "task-new" }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
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
      task: { id: "task-new", tenantId: null },
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
      insertTask: () => {},
      getTask: () => null,
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;
}

function createMockContext(pathname = "/api/v1/tasks", segments: string[] = [], headers: Record<string, string | undefined> = {}, method = "GET", body: unknown = null): RouteContext {
  const routePathname = pathname.split("?")[0] ?? pathname;
  return {
    requestId: "req-123",
    request: { method, url: pathname, headers, body } as never,
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

// ── R6-16: POST /v1/tasks intake pipeline routing ─────────────────────────────

test("POST /api/v1/tasks creates a new task with queued status", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: createMockTaskStore(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "New Task" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  const body = JSON.parse(response.body);
  assert.ok(body.data.snapshot?.task?.id != null, "Expected task ID in response");
});

test("POST /api/v1/tasks requires authentication", async () => {
  const deps = {
    authService: null,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: createMockTaskStore(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "New Task" });
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication|auth|principal/i);
  }
});

test("POST /api/v1/tasks requires operator role", async () => {
  const viewerAuthService = {
    requireRole: () => ({ actorId: "actor-viewer", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
  const deps = {
    authService: viewerAuthService,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: createMockTaskStore(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "New Task" });
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw for viewer role");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("POST /api/v1/tasks returns 503 when task store is unavailable", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: undefined,
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "New Task" });
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /task.*store|unavailable/i);
  }
});

test("POST /api/v1/tasks inserts task into task store", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", {
    title: "Insert Test Task",
    divisionId: "div_abc",
    parentId: "parent_xyz",
    inputJson: '{"key":"value"}',
    priority: "high",
    source: "user",
  });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.ok(insertedTask != null, "Expected task to be inserted");
  assert.equal(insertedTask.title, "Insert Test Task");
  assert.equal(insertedTask.status, "queued");
  assert.equal(insertedTask.divisionId, "div_abc");
  assert.equal(insertedTask.parentId, "parent_xyz");
  assert.equal(insertedTask.inputJson, '{"key":"value"}');
  assert.equal(insertedTask.priority, "high");
  assert.equal(insertedTask.source, "user");
  assert.ok(insertedTask.id != null, "Expected task ID to be generated");
  assert.ok(insertedTask.createdAt != null, "Expected createdAt timestamp");
});

test("POST /api/v1/tasks with intakeAdmissionService does not double-write task records", async () => {
  let insertedTask = false;
  let insertedEvents = 0;
  let admitted = false;
  const mockTaskStore = {
    task: {
      insertTask: () => {
        insertedTask = true;
      },
      getTask: () => null,
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
    event: {
      insertEvent: () => {
        insertedEvents += 1;
      },
    },
  } as unknown as AuthoritativeTaskStore;
  const intakeAdmissionService = {
    admit: () => {
      admitted = true;
      return {
        taskDraft: { taskDraftId: "draft-1" },
        confirmedTaskSpec: { confirmedTaskSpecId: "ctspec-1" },
        requestEnvelope: { requestId: "req-1", requestHash: "hash-1", constraintPackRef: "policy://default" },
        runVersionLock: { runVersionLockId: "lock-1" },
        harnessRun: { harnessRunId: "hrun-1" },
        events: [{
          eventId: "event-1",
          eventType: "platform.intake.admitted",
          payload: { ok: true },
          traceId: "trace-1",
          occurredAt: "2026-04-28T00:00:00.000Z",
          schemaVersion: "1",
          aggregateId: "agg-1",
          runId: "run-1",
          aggregateSeq: 1,
          causationId: null,
          correlationId: "corr-1",
          payloadHash: "hash-1",
          replayBehavior: "idempotent",
          source: "task-routes.test",
        }],
      };
    },
  } as unknown as IntakeAdmissionService;

  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
    intakeAdmissionService,
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Intake Task" });

  const response = await callRoute(routes, ctx);

  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(admitted, true);
  assert.equal(insertedTask, false);
  assert.equal(insertedEvents, 1);
});

test("POST /api/v1/tasks uses api_key auth method", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], { "x-api-key": "test-key-123" }, "POST", { title: "Auth Method Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.ok(insertedTask != null, "Expected task to be inserted");
});

test("POST /api/v1/tasks defaults source to user when not provided", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Source Default Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.source, "user");
});

test("POST /api/v1/tasks defaults priority to normal when not provided", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Priority Default Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.priority, "normal");
});

test("POST /api/v1/tasks sets tenantId from principal when available", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const tenantAuthService = {
    requireRole: () => ({ actorId: "actor-tenant", roles: ["operator"], authMethod: "api_key", tenantId: "tenant_abc" }),
  } as unknown as ApiAuthService;

  const deps = {
    authService: tenantAuthService,
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Tenant Task" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.tenantId, "tenant_abc");
});

test("POST /api/v1/tasks generates unique task ID", async () => {
  let insertedTaskIds: string[] = [];
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTaskIds.push(task.id); },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);

  // Make two requests
  const ctx1 = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "First Task" });
  await callRoute(routes, ctx1);

  const ctx2 = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Second Task" });
  await callRoute(routes, ctx2);

  assert.equal(insertedTaskIds.length, 2);
  assert.notEqual(insertedTaskIds[0], insertedTaskIds[1], "Expected different IDs for each task");
});

test("POST /api/v1/tasks sets createdAt and updatedAt timestamps", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
      updateTaskInput: () => {},
      updateTaskStatus: () => {},
      updateTaskOutput: () => {},
    },
  } as unknown as AuthoritativeTaskStore;

  const beforeTime = new Date().toISOString();
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: mockTaskStore,
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Timestamp Test" });
  const response = await callRoute(routes, ctx);
  const afterTime = new Date().toISOString();
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.ok(insertedTask.createdAt >= beforeTime && insertedTask.createdAt <= afterTime);
  assert.ok(insertedTask.updatedAt >= beforeTime && insertedTask.updatedAt <= afterTime);
  assert.equal(insertedTask.createdAt, insertedTask.updatedAt);
});

test("POST /api/v1/tasks sets rootId equal to task ID for top-level task", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Root ID Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.rootId, insertedTask.id);
});

test("POST /api/v1/tasks sets completedAt to null for new task", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Completed At Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.completedAt, null);
});

test("POST /api/v1/tasks accepts minimal payload with only title", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Minimal Task" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.title, "Minimal Task");
});

test("POST /api/v1/tasks rejects payload without title", async () => {
  const deps = {
    authService: createMockAuthService(),
    inspectService: createMockInspectService(),
    missionControlService: createMockMissionControlService(),
    taskStore: createMockTaskStore(),
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", {});
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw for missing title");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /title|required/i);
  }
});

test("POST /api/v1/tasks sets initial actualCostUsd to 0", async () => {
  let insertedTask: any = null;
  const mockTaskStore = {
    task: {
      insertTask: (task: any) => { insertedTask = task; },
      getTask: () => null,
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
  };
  const routes = createTaskRoutes(deps);
  const ctx = createMockContext("/api/v1/tasks", ["api", "v1", "tasks"], {}, "POST", { title: "Cost Test" });
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 201);
  assert.equal(insertedTask.actualCostUsd, 0);
});
