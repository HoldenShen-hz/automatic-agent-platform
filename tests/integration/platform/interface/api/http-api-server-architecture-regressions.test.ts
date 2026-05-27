import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { createServer as createNetServer } from "node:net";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { HttpApiServer } from "../../../../../src/platform/five-plane-interface/api/http-api-server.js";
import { IncidentCaseService } from "../../../../../src/platform/five-plane-state-evidence/incident/index.js";
import { IntakeAdmissionService } from "../../../../../src/platform/five-plane-orchestration/harness/runtime/intake-admission-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { WorkerRegistryService } from "../../../../../src/platform/five-plane-execution/worker-pool/worker-registry-service.js";
import { waitForCondition } from "../../../../helpers/wait.js";

function createServerHarness(options: {
  workerHeartbeatSweepIntervalMs?: number;
  workerHeartbeatTtlMs?: number;
} = {}) {
  const workspace = mkdtempSync(join(tmpdir(), "aa-http-api-arch-"));
  const db = new SqliteDatabase(join(workspace, "api.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const incidentService = new IncidentCaseService();
  const authService = new ApiAuthService({
    apiKeys: [
      {
        apiKey: "test-api-key",
        actorId: "operator-1",
        roles: ["viewer", "operator", "admin"],
      },
    ],
    jwtSecret: "test-jwt-secret",
  });
  const intakeAdmissionService = new IntakeAdmissionService();

  const inspectService = {
    queryTaskInspectSummaries: () => [],
    getTaskInspectView: (taskId: string) => {
      const task = store.task.getTask(taskId);
      return {
        task: {
          id: task?.id ?? taskId,
          tenantId: task?.tenantId ?? null,
          createdAt: task?.createdAt ?? null,
          updatedAt: task?.updatedAt ?? null,
        },
        steps: [],
        executions: [],
        approvals: [],
        artifacts: [],
        dispatchDecisions: [],
        stepResults: [],
        runtimeRecovery: { candidates: [] },
        workflowState: null,
      };
    },
  };

  const missionControlService = {
    getTaskCockpit: (taskId: string) => {
      const task = store.task.getTask(taskId);
      if (!task) {
        throw new Error(`task_not_found:${taskId}`);
      }
      return {
        snapshot: {
          task: {
            id: task.id,
            title: task.title,
            status: task.status,
            tenantId: task.tenantId,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          },
          events: store.listEventsForTask(taskId),
          artifacts: [],
        },
        inspect: {
          task: {
            id: task.id,
            tenantId: task.tenantId,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
          },
          steps: [],
          executions: [],
          approvals: [],
          artifacts: [],
          dispatchDecisions: [],
          stepResults: [],
          runtimeRecovery: { candidates: [] },
          workflowState: null,
        },
        timeline: { entries: [] },
      };
    },
    listWorkflowCockpits: () => [],
    getWorkflowCockpit: () => ({
      summary: { taskId: "task-missing", workflowId: "wf-missing", workflowStatus: "pending", currentStepIndex: 0, pendingApprovalCount: 0, retryCount: 0, resumableFromStep: null },
      inspect: { task: { id: "task-missing", tenantId: null }, steps: [], executions: [], approvals: [], artifacts: [], dispatchDecisions: [], stepResults: [], runtimeRecovery: { candidates: [] }, workflowState: null },
      timeline: { entries: [] },
    }),
    getSnapshot: () => ({
      generatedAt: new Date().toISOString(),
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      taskBoard: [],
      pendingApprovals: [],
      divisions: [],
      gatewayTargets: [],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
    }),
  };

  const approvalService = {
    applyDecision: () => undefined,
  };

  return {
    workspace,
    store,
    server: new HttpApiServer({
      approvalService: approvalService as never,
      authService,
      inspectService: inspectService as never,
      incidentService,
      missionControlService: missionControlService as never,
      taskStore: store,
      intakeAdmissionService,
      ...(options.workerHeartbeatSweepIntervalMs !== undefined
        ? { workerHeartbeatSweepIntervalMs: options.workerHeartbeatSweepIntervalMs }
        : {}),
      ...(options.workerHeartbeatTtlMs !== undefined
        ? { workerHeartbeatTtlMs: options.workerHeartbeatTtlMs }
        : {}),
    }),
    incidentService,
    cleanup() {
      db.close();
      rmSync(workspace, { recursive: true, force: true });
    },
  };
}

async function canBindLocalSockets(): Promise<boolean> {
  return await new Promise((resolve) => {
    const probe = createNetServer();
    probe.once("error", () => resolve(false));
    probe.listen(0, "127.0.0.1", () => {
      probe.close(() => resolve(true));
    });
  });
}

const canBindSockets = await canBindLocalSockets();

function networkPathTest(name: string, body: Parameters<typeof test>[1]): void {
  test(name, async (t) => {
    if (!canBindSockets) {
      t.diagnostic("Skipping local socket bind lifecycle path: local sockets are unavailable in this environment.");
      return;
    }
    await body(t);
  });
}

test("HttpApiServer enforces Accept-Version negotiation and propagates correlation IDs", async (t) => {
  const harness = createServerHarness();
  t.after(() => harness.cleanup());

  const rejected = await harness.server.inject({
    method: "GET",
    url: "/api/v1/tasks",
    headers: {
      "x-api-key": "test-api-key",
      "accept-version": "2025-01-01",
      "x-correlation-id": "corr-version-reject",
    },
  });
  assert.equal(rejected.statusCode, 400);
  assert.equal(rejected.headers["x-trace-id"], "corr-version-reject");
  assert.equal(rejected.headers["x-api-version"], "2026-04-01");

  const accepted = await harness.server.inject({
    method: "GET",
    url: "/api/v1/tasks",
    headers: {
      "x-api-key": "test-api-key",
      "accept-version": "2026-04-01",
      "x-correlation-id": "corr-version-accept",
    },
  });
  assert.equal(accepted.statusCode, 200);
  assert.equal(accepted.headers["x-trace-id"], "corr-version-accept");
  assert.equal(accepted.headers["x-api-version"], "2026-04-01");
});

test("HttpApiServer replays idempotent task creation and persists the RSM fact event with the task", async (t) => {
  const harness = createServerHarness();
  t.after(() => harness.cleanup());

  const request = {
    method: "POST",
    url: "/api/v1/tasks",
    headers: {
      "x-api-key": "test-api-key",
      "idempotency-key": "task-create-001",
      "accept-version": "2026-04-01",
      "x-correlation-id": "corr-task-create",
    },
    body: JSON.stringify({
      title: "Architecture review task",
      divisionId: "coding",
      inputJson: "{\"kind\":\"review\"}",
      priority: "high",
      source: "user",
    }),
  } as const;

  const beforeCount = harness.store.listTasks(500).filter((task) => task.title === "Architecture review task").length;
  const created = await harness.server.inject(request);
  assert.equal(created.statusCode, 201);
  assert.equal(created.headers["x-api-version"], "2026-04-01");
  assert.equal(created.headers["x-trace-id"], "corr-task-create");

  const createdBody = created.json<{ data: { snapshot: { task: { id: string } } } }>();
  const taskId = createdBody.data.snapshot.task.id;
  assert.ok(taskId.startsWith("task_"));

  const replayed = await harness.server.inject(request);
  assert.equal(replayed.statusCode, 201);
  assert.equal(replayed.headers["x-idempotent-replay"], "true");
  assert.equal(replayed.body, created.body);

  const afterCount = harness.store.listTasks(500).filter((task) => task.title === "Architecture review task").length;
  assert.equal(afterCount, beforeCount + 1);

  const events = harness.store.listEventsForTask(taskId);
  const factEvent = events.find((event) => event.eventType === "platform.harness_run.status_changed");
  assert.ok(factEvent, "expected task creation to persist the emitted harness platform fact event");
  assert.equal(factEvent?.traceId, "corr-task-create");
});

networkPathTest("HttpApiServer sweeps stale worker heartbeats, marks workers offline, and opens a single incident", async (t) => {
  const harness = createServerHarness({
    workerHeartbeatSweepIntervalMs: 10,
    workerHeartbeatTtlMs: 1_000,
  });
  t.after(async () => {
    await harness.server.stop();
    harness.cleanup();
  });

  const workers = new WorkerRegistryService(harness.store);
  workers.recordHeartbeat({
    workerId: "worker-stale-1",
    status: "idle",
    capabilities: ["read"],
    runningExecutionIds: [],
    maxConcurrency: 1,
    occurredAt: "2026-01-01T00:00:00.000Z",
  });

  await harness.server.start({ host: "127.0.0.1", port: 0 });
  await waitForCondition(() => {
    const snapshot = harness.store.worker.getWorkerSnapshot("worker-stale-1");
    return snapshot?.status === "offline" && harness.incidentService.listIncidents(10).length === 1;
  }, {
    timeoutMs: 1_000,
    intervalMs: 20,
    description: "stale worker heartbeat sweep",
  });

  const snapshot = harness.store.worker.getWorkerSnapshot("worker-stale-1");
  assert.equal(snapshot?.status, "offline");
  assert.equal(harness.incidentService.listIncidents(10).length, 1);
  assert.match(harness.incidentService.listIncidents(10)[0]?.title ?? "", /worker-stale-1/);
});
