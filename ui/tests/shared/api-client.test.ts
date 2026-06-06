import { QueryClient } from "@tanstack/react-query";
import { afterEach, describe, expect, it } from "vitest";
import {
  BrowserWSClient,
  DefaultRESTClient,
  HttpTransport,
  InMemoryWSClient,
  MockTransport,
  WSEventRouter,
  approveApproval,
  createCsrfInterceptor,
  createTask,
  createTraceInterceptor,
  createUser,
  createWorkflow,
  deleteTask,
  endpointCatalog,
  fetchAgents,
  fetchDashboardSnapshot,
  fetchKnowledge,
  fetchMissionBudget,
  fetchMissionEvidence,
  fetchMissionKnowledge,
  fetchMissionLearning,
  fetchMissionMembers,
  fetchMissionRuns,
  fetchMissions,
  fetchMissionTasks,
  fetchPackVersions,
  fetchPlugins,
  fetchPrompts,
  fetchApprovals,
  fetchSystemConfig,
  fetchTasks,
  fetchWorkers,
  fetchWorkflowRunSteps,
  fetchWorkflows,
  mapEventToQuery,
  type RestClientRequest,
  updateTask,
  updateUser,
} from "@aa/shared-api-client";

describe("shared api-client", () => {
  afterEach(() => {
    document.head.innerHTML = "";
    localStorage.removeItem("aa.ui.mock.tasks.v1");
  });

  it("fetches dashboard and tasks through the mock REST client", async () => {
    const client = new DefaultRESTClient((request) => new MockTransport().send(request));

    const dashboard = await fetchDashboardSnapshot(client);
    const tasks = await fetchTasks(client);
    const workflows = await fetchWorkflows(client);
    const agents = await fetchAgents(client);

    expect(dashboard.overallHealth).toBe("healthy");
    expect(tasks.length).toBeGreaterThan(0);
    expect(workflows.length).toBeGreaterThan(0);
    expect(agents.length).toBeGreaterThan(0);
  });

  it("normalizes ratio-style dashboard rates into percentages", async () => {
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      if (request.path === endpointCatalog.dashboardSnapshot.path) {
        return {
          status: 200,
          data: {
            overallHealth: "overloaded",
            queueDepth: 11,
            activeExecutions: 1,
            approvalBacklog: 0,
            alertSummary: "stale_workers_detected",
            successRate: 0.8913,
            errorRate: 0.0833,
            uptimePercent: 11.58,
          } as T,
        };
      }
      return { status: 200, data: [] as T };
    });

    const dashboard = await fetchDashboardSnapshot(client);

    expect(dashboard.successRate).toBeCloseTo(89.13, 2);
    expect(dashboard.errorRate).toBeCloseTo(8.33, 2);
    expect(dashboard.uptimePercent).toBe(11.58);
  });

  it("unwraps src-style collection envelopes for list endpoints", async () => {
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      if (request.path.includes("/tasks")) {
        return { status: 200, data: { tasks: [{ id: "task-1", title: "Task", status: "queued", currentStep: "intake", domainId: "platform" }] } as T };
      }
      if (request.path.includes("/workflows")) {
        return {
          status: 200,
          data: {
            workflows: [{
              taskId: "task-1",
              workflowId: "real_task_execution",
              workflowStatus: "running",
              divisionId: "platform",
              owner: "ops",
              currentStepIndex: 0,
              steps: [],
            }],
          } as T,
        };
      }
      if (request.path.includes("/approvals")) {
        return { status: 200, data: { approvals: [{ approvalId: "approval-1", taskId: "task-1", riskLevel: "medium", reasonSummary: "review" }] } as T };
      }
      if (request.path.includes("/v1/workers")) {
        return { status: 200, data: { workers: [{ id: "worker-1", status: "idle", queue: "default", heartbeatLagMs: 0 }] } as T };
      }
      return { status: 200, data: { queues: [{ id: "default", ready: 1, inFlight: 0, retries: 0, dlq: 0 }] } as T };
    });

    await expect(fetchTasks(client)).resolves.toHaveLength(1);
    await expect(fetchWorkflows(client)).resolves.toEqual([
      expect.objectContaining({
        id: "task-1",
        title: "real_task_execution",
        status: "running",
        currentStage: "step-0",
        owner: "ops",
        domainId: "platform",
      }),
    ]);
    await expect(fetchApprovals(client)).resolves.toHaveLength(1);
    await expect(fetchWorkers(client)).resolves.toHaveLength(1);
  });

  it("keeps workflow owner explicit instead of backfilling division as owner", async () => {
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      if (request.path.includes("/workflows")) {
        return {
          status: 200,
          data: {
            workflows: [{
              taskId: "task-real-1",
              workflowId: "real_task_execution",
              workflowStatus: "failed",
              divisionId: "platform",
              currentStepIndex: 0,
              steps: [],
            }],
          } as T,
        };
      }
      return { status: 200, data: { tasks: [] } as T };
    });

    await expect(fetchWorkflows(client)).resolves.toEqual([
      expect.objectContaining({
        id: "task-real-1",
        owner: "unknown",
        domainId: "platform",
      }),
    ]);
  });

  it("maps awaiting-decision task records to paused task DTOs", async () => {
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      if (request.path.includes("/tasks")) {
        return {
          status: 200,
          data: {
            tasks: [{
              taskId: "task-approval-1",
              title: "Approval wait",
              taskStatus: "awaiting_decision",
              workflowStatus: "paused",
              divisionId: "platform",
              currentStepIndex: 2,
            }],
          } as T,
        };
      }
      return { status: 200, data: { tasks: [] } as T };
    });

    await expect(fetchTasks(client)).resolves.toEqual([
      expect.objectContaining({
        id: "task-approval-1",
        status: "paused",
        currentStep: "step-2",
        domainId: "platform",
      }),
    ]);
  });

  it("adds request ids through the trace interceptor", async () => {
    let requestId = "";
    const client = new DefaultRESTClient(
      async (request) => {
        requestId = request.headers.get("x-request-id") ?? "";
        return new MockTransport().send(request);
      },
      [createTraceInterceptor()],
    );

    await client.get(endpointCatalog.dashboardSnapshot.path);
    expect(requestId.length).toBeGreaterThan(0);
  });

  it("supports websocket subscriptions and SSE fallback", () => {
    const client = new InMemoryWSClient();
    const events: string[] = [];
    let status = "disconnected";

    client.onStatusChange((nextStatus) => {
      status = nextStatus;
    });
    const unsubscribe = client.subscribe("dashboard", (event) => {
      events.push(event.type);
    });

    client.connect("ws://example", "token");
    client.publish({ channel: "dashboard", type: "metric.updated", payload: { value: 1 } });
    client.useSseFallback();
    unsubscribe();

    expect(events).toEqual(["metric.updated"]);
    expect(status).toBe("sse-fallback");
  });

  it("maps realtime events into query invalidation scopes", () => {
    expect(mapEventToQuery({ channel: "global", type: "incident.created", payload: {} }).queryKey).toEqual(["incidents"]);
    expect(mapEventToQuery({ channel: "global", type: "progress", payload: {} }).queryKey).toEqual(["tasks"]);
    expect(mapEventToQuery({ channel: "global", type: "message_delta", payload: {} }).queryKey).toEqual(["tasks"]);
    expect(mapEventToQuery({ channel: "global", type: "artifact_ready", payload: {} }).queryKey).toEqual(["tasks"]);
    expect(mapEventToQuery({ channel: "global", type: "panic.activated", payload: {} }).scope).toBe("panic");
    expect(mapEventToQuery({ channel: "global", type: "config.feature-flags.updated", payload: {} }).queryKey).toEqual(["feature-flags"]);
    expect(Object.values(endpointCatalog).length).toBeGreaterThanOrEqual(41);
    expect(endpointCatalog.contractVersion.path).toBe("/v1/meta/contract-version");
  });

  it("routes websocket events through the query router", () => {
    const queryClient = new QueryClient();
    const ws = new InMemoryWSClient();
    const router = new WSEventRouter(ws, queryClient);
    const invalidateCalls: string[] = [];
    const original = queryClient.invalidateQueries.bind(queryClient);
    queryClient.invalidateQueries = ((args) => {
      const queryKey = args?.queryKey;
      invalidateCalls.push(String(queryKey?.[0] ?? ""));
      return original(args);
    }) as typeof queryClient.invalidateQueries;

    router.connect("ws://example", "token");
    router.subscribe("approvals");
    ws.publish({ channel: "approvals", type: "approval.resolved", payload: {} });
    router.disconnect();

    expect(invalidateCalls).toContain("approvals");
  });

  it("supports real http transport with injected fetch", async () => {
    const transport = new HttpTransport({
      baseUrl: "https://example.test",
      fetchImplementation: async (input) => new Response(
        JSON.stringify({ ok: true, url: String(input) }),
        { status: 200, headers: { "content-type": "application/json" } },
      ),
    });
    const client = new DefaultRESTClient((request) => transport.send(request));

    const response = await client.get<{ ok: boolean; url: string }>("/api/v1/health");
    expect(response.ok).toBe(true);
    expect(response.url).toContain("https://example.test/api/v1/health");
  });

  it("supports browser websocket client with a real socket contract", () => {
    class FakeSocket {
      public static readonly OPEN = 1;
      public readonly sent: string[] = [];
      public readyState = FakeSocket.OPEN;
      public onopen: (() => void) | null = null;
      public onmessage: ((event: { data: string }) => void) | null = null;
      public onclose: (() => void) | null = null;
      public onerror: (() => void) | null = null;

      public constructor(_url: string) {
        queueMicrotask(() => {
          this.onopen?.();
        });
      }

      public send(message: string): void {
        this.sent.push(message);
      }

      public close(): void {
        this.onclose?.();
      }
    }

    const client = new BrowserWSClient(FakeSocket as unknown as typeof WebSocket, new InMemoryWSClient());
    const events: string[] = [];
    client.subscribe("dashboard", (event) => {
      events.push(event.type);
    });
    client.connect("ws://example", "token");
    client.publish({ channel: "dashboard", type: "dashboard.metric_updated", payload: {} });
    client.disconnect();

    expect(events).toEqual(["dashboard.metric_updated"]);
  });

  it("injects csrf tokens into write requests only", async () => {
    document.head.innerHTML = '<meta name="aa-csrf-token" content="csrf-token-123" />';
    let getToken = "";
    let postToken = "";
    const client = new DefaultRESTClient(
      async (request) => {
        if (request.method === "GET") {
          getToken = request.headers.get("x-csrf-token") ?? "";
        }
        if (request.method === "POST") {
          postToken = request.headers.get("x-csrf-token") ?? "";
        }
        return new MockTransport().send(request);
      },
      [createCsrfInterceptor()],
    );

    await client.get("/tasks");
    await client.post("/tasks", { ok: true });

    expect(getToken).toBe("");
    expect(postToken).toBe("csrf-token-123");
  });

  it("exposes write endpoints and admin configuration helpers", async () => {
    const client = new DefaultRESTClient(async <T,>(request: RestClientRequest) => {
      if (request.method === "GET") {
        return new MockTransport().send(request);
      }
      return {
        status: 200,
        data: { ok: true, body: request.body } as T,
      };
    });

    await expect(createTask(client, { title: "task" })).resolves.toMatchObject({ ok: true });
    await expect(updateTask(client, "task-1", { status: "running" })).resolves.toMatchObject({ ok: true });
    await expect(deleteTask(client, "task-1")).resolves.toMatchObject({ ok: true });
    await expect(createWorkflow(client, { title: "workflow" })).resolves.toMatchObject({ ok: true });
    await expect(approveApproval(client, "approval-1")).resolves.toMatchObject({ ok: true });
    await expect(createUser(client, { displayName: "Ops" })).resolves.toMatchObject({ ok: true });
    await expect(updateUser(client, "user-1", { status: "active" })).resolves.toMatchObject({ ok: true });
    await expect(fetchSystemConfig(client)).resolves.toMatchObject({ csrfEnabled: true });
    await expect(fetchWorkflowRunSteps(client, "workflow-run-1")).resolves.toBeDefined();
    await expect(fetchKnowledge(client)).resolves.toBeDefined();
    await expect(fetchPackVersions(client, "pack-1")).resolves.toBeDefined();
    await expect(fetchPlugins(client)).resolves.toBeDefined();
    await expect(fetchPrompts(client)).resolves.toBeDefined();
  });

  it("persists mock-created tasks and advances them through the local dev task history", async () => {
    const now = new Date("2026-06-04T10:00:00.000Z").getTime();
    const originalNow = Date.now;
    Date.now = () => now;
    const client = new DefaultRESTClient((request) => new MockTransport().send(request));

    try {
      await createTask(client, {
        id: "task-prompt-code-research",
        title: "请调研 大模型提示code 能力的方法",
        domainId: "platform-ops",
        owner: "platform-sre",
        status: "queued",
        currentStep: "intake",
      });

      const queuedTasks = await fetchTasks(client);
      expect(queuedTasks[0]).toMatchObject({
        id: "task-prompt-code-research",
        title: "请调研 大模型提示code 能力的方法",
        status: "queued",
        currentStep: "intake",
        executionMode: "mock_dev",
        modelCallStatus: "not_called",
        outputSummary: null,
      });

      Date.now = () => now + 2_000;
      const runningTasks = await fetchTasks(client);
      expect(runningTasks[0]).toMatchObject({
        id: "task-prompt-code-research",
        status: "running",
        currentStep: "waiting-for-real-model-run",
        evidenceCount: 0,
        modelProvider: "minimax",
        modelName: "minimax-m2.7",
        modelCallStatus: "not_called",
        outputUri: null,
      });
      await expect(fetchWorkflowRunSteps(client, "task-prompt-code-research")).resolves.toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            id: "task-prompt-code-research-research",
            title: "Wait for real model gateway execution",
            status: "running",
          }),
        ]),
      );

      Date.now = () => now + 7_000;
      const stillWaitingTasks = await fetchTasks(client);
      expect(stillWaitingTasks[0]).toMatchObject({
        id: "task-prompt-code-research",
        status: "running",
        currentStep: "waiting-for-real-model-run",
        evidenceCount: 0,
        modelCallStatus: "not_called",
        outputSummary: null,
      });

      await updateTask(client, "task-prompt-code-research", {
        status: "completed",
        currentStep: "delivered",
        evidenceCount: 3,
        timelineDepth: 4,
      });
      const repairedTasks = await fetchTasks(client);
      expect(repairedTasks[0]).toMatchObject({
        id: "task-prompt-code-research",
        status: "running",
        currentStep: "waiting-for-real-model-run",
        evidenceCount: 0,
        modelCallStatus: "not_called",
        outputSummary: null,
      });
    } finally {
      Date.now = originalNow;
    }
  });

  it("serves default Mission console data through the local mock fallback", async () => {
    const client = new DefaultRESTClient((request) => new MockTransport().send(request));

    const missions = await fetchMissions(client);
    expect(missions[0]).toMatchObject({
      missionId: "mis_local_platform",
      status: "active",
      title: "本地平台验证 Mission",
    });
    await expect(fetchMissionMembers(client, "mis_local_platform")).resolves.toHaveLength(1);
    await expect(fetchMissionTasks(client, "mis_local_platform")).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ type: "task", title: "本地任务入口验证" })]),
    );
    await expect(fetchMissionRuns(client, "mis_local_platform")).resolves.toHaveLength(1);
    await expect(fetchMissionEvidence(client, "mis_local_platform")).resolves.toHaveLength(1);
    await expect(fetchMissionKnowledge(client, "mis_local_platform")).resolves.toHaveLength(1);
    await expect(fetchMissionLearning(client, "mis_local_platform")).resolves.toHaveLength(1);
    await expect(fetchMissionBudget(client, "mis_local_platform")).resolves.toMatchObject({
      missionId: "mis_local_platform",
      status: "configured",
    });
  });
});
