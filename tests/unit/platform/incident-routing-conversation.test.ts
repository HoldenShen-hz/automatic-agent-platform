import assert from "node:assert/strict";
import test from "node:test";

import { ConversationHistoryService } from "../../../src/interaction/ux/conversation-history-service.js";
import { UxEventTrackingService } from "../../../src/interaction/ux/ux-event-tracking-service.js";
import { DegradationController, DegradationLevel } from "../../../src/platform/model-gateway/degradation/degradation-controller.js";
import { AutoStopLossService, type StopLossPlaybook } from "../../../src/platform/five-plane-control-plane/incident-control/auto-stop-loss-service.js";
import { createIncidentRoutes } from "../../../src/platform/five-plane-interface/api/http-server/incident-routes.js";
import { createPromptRoutes } from "../../../src/platform/five-plane-interface/api/http-server/prompt-routes.js";
import { createTaskRoutes } from "../../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { ApiAuthService } from "../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { IncidentFacadeService } from "../../../src/platform/five-plane-interface/api/facade-interfaces.js";
import type { ApiResponsePayload, RouteContext, RouteDefinition } from "../../../src/platform/five-plane-interface/api/http-server/types.js";

function createAuthService(
  roles: Array<"viewer" | "operator" | "admin"> = ["viewer"],
  tenantId: string | null = null,
): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles, authMethod: "api_key", tenantId }),
  } as unknown as ApiAuthService;
}

function createContext(input: {
  method?: string;
  url: string;
  pathname?: string;
  segments?: string[];
  body?: string | null;
}): RouteContext {
  return {
    requestId: "req-reaudit-r29",
    request: {
      method: input.method ?? "GET",
      url: input.url,
      headers: {},
      body: input.body ?? null,
    } as never,
    route: {
      pathname: input.pathname ?? (input.url.split("?")[0] ?? input.url),
      segments: input.segments ?? [],
    },
    principal: null,
  };
}

async function callRoute(routes: RouteDefinition[], ctx: RouteContext): Promise<ApiResponsePayload | null> {
  for (const route of routes) {
    if (route.method !== (ctx.request.method ?? "GET")) {
      continue;
    }
    if (route.pathname !== null) {
      if (route.pathname === ctx.route.pathname) {
        return route.handler(ctx);
      }
      continue;
    }
    if (route.segments) {
      const result = await route.handler(ctx);
      if (result !== null) {
        return result;
      }
    }
  }
  return null;
}

function parseResponseBody(response: ApiResponsePayload): Record<string, unknown> {
  return JSON.parse(response.body).data as Record<string, unknown>;
}

function createStopLossPlaybook(overrides: Partial<StopLossPlaybook> = {}): StopLossPlaybook {
  return {
    id: "reaudit-playbook",
    name: "Reaudit Playbook",
    description: "Reaudit regression coverage",
    enabled: true,
    triggerCondition: { type: "health_status", healthStatusThreshold: "overloaded" },
    actions: ["disable_new_tasks"],
    cooldownMs: 60_000,
    maxExecutionsPerHour: 5,
    requireHumanApproval: true,
    ...overrides,
  };
}

function createHealthyMetrics() {
  return {
    provider: "openai",
    profileName: "gpt-4.1",
    totalRequests: 100,
    failedRequests: 0,
    errorRate: 1,
    latencyP99Ms: 100,
    ttftP99Ms: 100,
    lastUpdated: "2026-05-11T00:00:00.000Z",
  };
}

function createIncidentService(): IncidentFacadeService {
  return {
    listIncidents: () => [],
    listIncidentsPaginated: () => ({ incidents: [], nextToken: null }),
    getIncident: () => null,
    openIncident: () => {
      throw new Error("not_implemented");
    },
    acknowledge: () => {
      throw new Error("not_implemented");
    },
    startMitigation: () => {
      throw new Error("not_implemented");
    },
    resolve: () => {
      throw new Error("not_implemented");
    },
  };
}

test("R29-32 incident routes reject blank incident ids", async () => {
  const routes = createIncidentRoutes({
    authService: createAuthService(),
    incidentService: createIncidentService(),
  });

  await assert.rejects(
    () => callRoute(routes, createContext({
      url: "/v1/incidents/%20%20",
      segments: ["v1", "incidents", "   "],
    })),
    /incident\.invalid_id|Invalid incident ID format\./,
  );
});

test("R29-33 incident id validation message does not reflect attacker input", async () => {
  const routes = createIncidentRoutes({
    authService: createAuthService(),
    incidentService: createIncidentService(),
  });
  const invalidIncidentId = "   ";

  await assert.rejects(
    () => callRoute(routes, createContext({
      url: "/v1/incidents/%20%20",
      segments: ["v1", "incidents", invalidIncidentId],
    })),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "Invalid incident ID format.");
      assert.equal(error.message.includes(invalidIncidentId), false);
      return true;
    },
  );
});

test("R29-34 conversation history sorts before applying limit", async () => {
  const service = new ConversationHistoryService({
    remember: async () => undefined,
    recall: async () => [
      {
        contentJson: JSON.stringify({
          sessionId: "conv-old",
          tenantId: "tenant-a",
          userId: "user-1",
          turns: [],
          createdAt: "2026-05-09T00:00:00.000Z",
          updatedAt: "2026-05-09T00:00:00.000Z",
          status: "completed",
        }),
      },
      {
        contentJson: JSON.stringify({
          sessionId: "conv-newest",
          tenantId: "tenant-a",
          userId: "user-1",
          turns: [],
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:00:00.000Z",
          status: "active",
        }),
      },
      {
        contentJson: JSON.stringify({
          sessionId: "conv-middle",
          tenantId: "tenant-a",
          userId: "user-1",
          turns: [],
          createdAt: "2026-05-10T00:00:00.000Z",
          updatedAt: "2026-05-10T00:00:00.000Z",
          status: "active",
        }),
      },
    ],
  } as never);

  const sessions = await service.listUserSessions("user-1", "tenant-a", 2);
  assert.deepEqual(sessions.map((session) => session.sessionId), ["conv-newest", "conv-middle"]);
});

test("R29-35 ux event tracking keeps an upper bound on in-memory history", () => {
  const service = new UxEventTrackingService();

  for (let index = 0; index < 1005; index += 1) {
    service.trackEvent("ux:button_click", { userId: `user-${index}` });
  }

  const events = service.getRecentEvents(2_000);
  assert.equal(events.length, 1000);
  assert.equal(events[0]?.userId, "user-5");
  assert.equal(events.at(-1)?.userId, "user-1004");
});

test("R29-36 ux analytics publishes the production interaction event type", () => {
  const published: unknown[] = [];
  const service = new UxEventTrackingService({
    publish(event: unknown) {
      published.push(event);
    },
  } as never);

  service.trackEvent("ux:button_click", { userId: "user-1", sessionId: "session-1" });

  assert.equal(published.length, 1);
  assert.equal((published[0] as { eventType: string }).eventType, "ux:interaction_tracked");
});

test("R29-37 task route paginates beyond 200 items by fetching the full summary set before cursor slicing", async () => {
  const allTasks = Array.from({ length: 250 }, (_, index) => ({
    taskId: `task-${String(index).padStart(3, "0")}`,
    title: `Task ${index}`,
    divisionId: null,
    priority: "normal",
    taskStatus: "queued",
    workflowId: null,
    workflowStatus: null,
    currentStepIndex: null,
    sessionStatus: null,
    activeExecutionId: null,
    latestExecutionStatus: null,
    pendingApprovalCount: 0,
    resolvedApprovalCount: 0,
    dispatchDecisionCount: 0,
    latestEventAt: null,
    updatedAt: "2026-05-11T00:00:00.000Z",
  }));
  const queries: Array<Record<string, unknown>> = [];
  const routes = createTaskRoutes({
    authService: createAuthService(),
    inspectService: {
      queryTaskInspectSummaries(query: Record<string, unknown>) {
        queries.push(query);
        return query.fetchAll === true ? allTasks : allTasks.slice(0, 200);
      },
    } as never,
    missionControlService: {} as never,
  });

  let cursor: string | null = null;
  let eighthPage: Record<string, unknown> | null = null;

  for (let pageIndex = 0; pageIndex < 8; pageIndex += 1) {
    const suffix = cursor == null ? "" : `&cursor=${encodeURIComponent(cursor)}`;
    const response = await callRoute(routes, createContext({
      url: `/api/v1/tasks?limit=25${suffix}`,
      pathname: "/api/v1/tasks",
      segments: ["api", "v1", "tasks"],
    }));
    if (!response) {
      throw new Error("task list route returned null");
    }
    eighthPage = parseResponseBody(response);
    cursor = (eighthPage.nextCursor as string | null) ?? null;
  }

  assert.equal(queries.every((query) => query.fetchAll === true), true);
  assert.equal(eighthPage?.hasMore, true);
  assert.ok(cursor);

  const ninthResponse = await callRoute(routes, createContext({
    url: `/api/v1/tasks?limit=25&cursor=${encodeURIComponent(cursor)}`,
    pathname: "/api/v1/tasks",
    segments: ["api", "v1", "tasks"],
  }));
  if (!ninthResponse) {
    throw new Error("task list route returned null");
  }
  const ninthPage = parseResponseBody(ninthResponse);
  assert.deepEqual(
    (ninthPage.tasks as Array<{ taskId: string }>).map((task) => task.taskId).slice(0, 3),
    ["task-200", "task-201", "task-202"],
  );
});

test("R29-39 prompt routes reject unknown request fields instead of forwarding them to the registry", async () => {
  let capturedBundle: Record<string, unknown> | null = null;
  const routes = createPromptRoutes({
    authService: createAuthService(["operator"]),
    promptRegistryService: {
      listBundles: () => [],
      registerBundle(bundle: Record<string, unknown>) {
        capturedBundle = bundle;
        return { bundle: { bundleId: "bundle-1", createdAt: "2026-05-11T00:00:00.000Z" } };
      },
    } as never,
  });

  await assert.rejects(
    async () => callRoute(routes, createContext({
      method: "POST",
      url: "/v1/prompts",
      pathname: "/v1/prompts",
      segments: ["v1", "prompts"],
      body: JSON.stringify({
        name: "system.test",
        version: 1,
        taskType: "general",
        systemPrompt: "hello",
        rogueField: "should-not-pass-through",
      }),
    })),
    /Unrecognized key/,
  );
  assert.equal(capturedBundle, null);
});

test("R29-40 pending stop-loss executions are persisted, visible, and executed on approval", async () => {
  const executedActions: string[] = [];
  const service = new AutoStopLossService({ config: { enableHumanEscalation: true } });
  const playbook = createStopLossPlaybook({
    id: "approval-visible",
    actions: ["disable_new_tasks"],
  });
  service.registerActionHandler("disable_new_tasks", async () => {
    executedActions.push("disable_new_tasks");
    return { success: true, message: "disabled" };
  });

  const event = await service.executePlaybook(playbook, "Operator approval required");
  assert.equal(service.getPendingApprovals().map((pending) => pending.id).includes(event.id), true);

  const approved = await service.approvePendingExecution(event.id, true);
  assert.equal(approved, true);
  assert.deepEqual(executedActions, ["disable_new_tasks"]);
  assert.equal(service.getPendingApprovals().length, 0);

  const stored = service.getExecutionHistory().find((candidate) => candidate.id === event.id);
  assert.ok(stored);
  assert.equal(stored?.humanApproved, true);
  assert.deepEqual(stored?.actionsExecuted, ["disable_new_tasks"]);
});

test("R29-41 degradation recovery reason keeps the healthy streak count instead of recovered_after_0_checks", () => {
  const controller = new DegradationController({
    primaryProvider: {} as never,
    fallbackService: {} as never,
    cacheService: {} as never,
  });

  controller.escalate();
  controller.evaluateHealth(createHealthyMetrics());
  controller.evaluateHealth(createHealthyMetrics());
  const result = controller.evaluateHealth(createHealthyMetrics());

  assert.equal(result.action, "deescalate");
  assert.equal(result.newLevel, DegradationLevel.D0);
  assert.equal(result.reason, "recovered_after_2_checks");
});

test("R29-42 hourly stop-loss rate limit keys do not collide between January 11 and November 1", async () => {
  let currentTime = new Date("2026-01-11T09:00:00.000Z");
  const service = new AutoStopLossService({
    now: () => currentTime,
    playbooks: [],
  });
  const playbook = createStopLossPlaybook({
    id: "hour-key",
    requireHumanApproval: false,
    maxExecutionsPerHour: 1,
    cooldownMs: 0,
    actions: ["circuit_break"],
    triggerCondition: { type: "anomaly_severity", severityThreshold: "critical" },
  });
  service.registerPlaybook(playbook);

  await service.executePlaybook(playbook, "January execution");
  currentTime = new Date("2026-11-01T09:00:00.000Z");

  const result = service.evaluateAnomaly("critical", "error_rate");
  assert.equal(result.matchingPlaybooks.some((candidate) => candidate.id === "hour-key"), true);
});

test("R29-43 cooldown starts after approved human execution", async () => {
  let currentTime = new Date("2026-05-11T00:00:00.000Z");
  const service = new AutoStopLossService({
    now: () => currentTime,
    config: {
      enableHumanEscalation: true,
    },
    playbooks: [],
  });
  const playbook = createStopLossPlaybook({
    id: "cooldown-after-approval",
    cooldownMs: 60_000,
  });
  service.registerPlaybook(playbook);

  const initialEvaluation = service.evaluateHealth("overloaded");
  assert.equal(initialEvaluation.matchingPlaybooks.some((candidate) => candidate.id === playbook.id), true);

  const pendingEvent = await service.executePlaybook(playbook, "Approval before cooldown", {
    healthStatus: "overloaded",
  });
  const approved = await service.approvePendingExecution(pendingEvent.id, true);
  assert.equal(approved, true);

  currentTime = new Date("2026-05-11T00:00:01.000Z");
  const cooledDownEvaluation = service.evaluateHealth("overloaded");
  assert.equal(cooledDownEvaluation.matchingPlaybooks.some((candidate) => candidate.id === playbook.id), false);
});
