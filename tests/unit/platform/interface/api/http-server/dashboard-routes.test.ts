import assert from "node:assert/strict";
import test from "node:test";

import { createDashboardRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/dashboard-routes.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockMissionControlService(): MissionControlService {
  return {
    getSnapshot: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0, findings: [] },
      metrics: { tasksTotal: 0, tasksActive: 0, tasksDone: 0, tasksFailed: 0 },
      queueDepth: 3,
      activeAgents: 2,
      errorRate: 0.125,
      uptimePercent: 99.9,
      taskBoard: [],
      pendingApprovals: [
        {
          id: "approval-1",
          taskId: "task-1",
          executionId: "exec-1",
          sourceAgentId: "agent-1",
          reason: "Promote rollout",
          requestJson: JSON.stringify({ title: "Promote rollout", reason: "Approve canary stage", riskLevel: "medium" }),
          optionsJson: JSON.stringify(["approve"]),
          requestedAt: "2026-04-16T00:00:00.000Z",
          expiresAt: null,
          status: "requested",
          respondedBy: null,
          respondedAt: null,
          responseJson: null,
          timeoutPolicy: "expire",
          createdAt: "2026-04-16T00:00:00.000Z",
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
      ],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    }),
    getStabilityPanel: () => ({
      generatedAt: "2026-04-16T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 1, activeExecutions: 1, tier1AckBacklog: 0, findings: [] },
      workers: [
        {
          workerId: "worker-1",
          status: "busy",
          queueAffinity: "finance",
          runningExecutionCount: 1,
          maxConcurrency: 2,
          lastHeartbeatAt: "2026-04-16T00:00:00.000Z",
        },
        {
          workerId: "worker-2",
          status: "offline",
          queueAffinity: null,
          runningExecutionCount: 0,
          maxConcurrency: 1,
          lastHeartbeatAt: "2026-04-15T23:59:30.000Z",
        },
      ],
      queuedTasks: [
        {
          taskId: "task-queue-1",
          title: "Queued task",
          divisionId: "finance",
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
          updatedAt: "2026-04-16T00:00:00.000Z",
        },
      ],
      queuedTaskCount: 1,
    }),
  } as unknown as MissionControlService;
}

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createMockAuthServiceWithTenant(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer"], authMethod: "api_key", tenantId: "tenant-1" }),
  } as unknown as ApiAuthService;
}

function createMockContext(headers: Record<string, string | undefined> = {}): RouteContext {
  return {
    requestId: "req-123",
    request: { method: "GET", url: "/dashboard/snapshot", headers, body: null } as never,
    route: { pathname: "/dashboard/snapshot", segments: [] },
    principal: null,
  };
}

test("createDashboardRoutes returns 9 routes", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  assert.equal(routes.length, 9);
});

test("GET /dashboard/snapshot returns snapshot", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /dashboard/snapshot throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /dashboard/snapshot throws for tenant-scoped principal", async () => {
  const deps = {
    authService: createMockAuthServiceWithTenant(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /tenant/);
  }
});

test("GET /v1/dashboard/snapshot returns snapshot", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /v1/dashboard/snapshot throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/dashboard/snapshot")!;
  const ctx = createMockContext();
  try {
    await route.handler(ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /v1/workbench/snapshot returns aggregated workbench payload", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/workbench/snapshot")!;
  const ctx = createMockContext();
  const response = await route.handler(ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Record<string, unknown> };
  assert.equal(body.data.inventorySummary != null, true);
  assert.equal(Array.isArray(body.data.approvalQueue), true);
  assert.equal(Array.isArray(body.data.operatorActions), true);
});

test("GET /v1/workbench/snapshot reuses injected singleton services instead of new per request", async () => {
  let buildSnapshotCalls = 0;
  let benchmarkCalls = 0;
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    platformWorkbenchSnapshotService: {
      buildSnapshot(input: Record<string, unknown>) {
        buildSnapshotCalls++;
        return { ...input, operatorActions: [] };
      },
    } as any,
    benchmarkInventoryService: {
      listBenchmarks() {
        benchmarkCalls++;
        return [];
      },
    } as any,
    deploymentInventoryService: { listDeployments: () => [] } as any,
    projectionInventoryService: { listProjectionInventory: () => [] } as any,
    complianceProgramTemplateService: { listTemplates: () => [] } as any,
    judgeProviderRegistryService: { registerDefaults: () => [] } as any,
  };
  const routes = createDashboardRoutes(deps);
  const route = routes.find((r) => r.pathname === "/v1/workbench/snapshot")!;
  await route.handler(createMockContext());
  await route.handler(createMockContext());
  assert.equal(buildSnapshotCalls, 2);
  assert.equal(benchmarkCalls, 2);
});

test("GET /v1/workers returns Layer C worker summaries", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/workers")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(body.data[0]?.id, "worker-1");
  assert.equal(body.data[0]?.queue, "finance");
  assert.equal(body.data[0]?.status, "busy");
});

test("GET /v1/queues returns public queue summaries", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/queues")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(body.data[0], {
    id: "finance",
    ready: 1,
    inFlight: 1,
    retries: 0,
    dlq: 0,
  });
});

test("GET /v1/agents returns public agent summaries", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/agents")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(body.data[0], {
    id: "worker-1",
    name: "worker-1",
    domainId: "finance",
    status: "healthy",
    load: 0.5,
  });
});

test("GET /v1/dashboard/metrics returns contract-aligned analytics cards", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/dashboard/metrics")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.deepEqual(
    body.data.map((entry) => entry.id),
    ["queue-depth", "active-agents", "error-rate", "uptime"],
  );
});

test("GET /v1/explanations returns Layer C explanation summaries", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: {
      ...createMockMissionControlService(),
      getSnapshot: () => ({
        ...createMockMissionControlService().getSnapshot(),
        health: {
          ...createMockMissionControlService().getSnapshot().health,
          findings: ["queue depth elevated"],
        },
      }),
    } as MissionControlService,
  });
  const route = routes.find((r) => r.pathname === "/v1/explanations")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(body.data[0]?.id, "system-health");
  assert.match(String(body.data[0]?.summary), /queue depth elevated/);
});

test("GET /v1/meta/contract-version returns supported public contract range", async () => {
  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
  });
  const route = routes.find((r) => r.pathname === "/v1/meta/contract-version")!;
  const response = await route.handler(createMockContext());
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  const body = JSON.parse(response.body) as { data: Record<string, string> };
  assert.match(body.data.contractVersion, /^\d{4}-\d{2}-\d{2}$/);
  assert.match(body.data.minServerVersion, /^\d{4}-\d{2}-\d{2}$/);
});
