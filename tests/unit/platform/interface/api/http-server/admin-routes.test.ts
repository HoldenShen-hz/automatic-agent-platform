import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import { createAdminRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/admin-routes.js";
import { ConfigRolloutService } from "../../../../../../src/platform/five-plane-control-plane/config-center/config-rollout-service.js";
import { TenantBoundaryRegistryService } from "../../../../../../src/platform/five-plane-control-plane/tenant/index.js";
import { CostReportService } from "../../../../../../src/platform/five-plane-interface/api/cost-report-service.js";
import { AdminConfigService } from "../../../../../../src/platform/five-plane-interface/api/admin-config-service.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { CoordinatorLoadBalancingService } from "../../../../../../src/platform/five-plane-execution/ha/coordinator-load-balancing-service.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { RouteContext, RouteDefinition, ApiResponsePayload } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import { StorageError } from "../../../../../../src/platform/contracts/errors.js";

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
    getStabilityPanel: () => ({
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0 },
      pendingApprovals: [],
      findings: [],
      blockedTasks: [],
      workers: [],
    }),
    getAdminTakeoverConsole: (_taskId: string) => ({
      scope: { taskId: "task-123", divisionId: null, workspaceId: null, tenantId: null },
      inspect: { takeoverSessions: [], operatorActions: [] },
      executionOwner: {},
      activeWorker: null,
      latestPmfVerdict: null,
      timeline: { entries: [] },
    }),
  } as unknown as MissionControlService;
}

function createMockLoadBalancingService(): CoordinatorLoadBalancingService {
  return {
    buildSummary: () => ({ generatedAt: "2026-04-16T00:00:00.000Z", coordinators: [], hotCoordinators: [] }),
    selectCoordinator: () => ({ selectedCoordinatorId: "coord-1", score: 0.5, candidates: 1 }),
  } as unknown as CoordinatorLoadBalancingService;
}

function createMockAuthService(roles: string[] = ["viewer"]): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: roles as ("viewer" | "operator" | "admin")[], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
}

function createTenantRegistryService(): TenantBoundaryRegistryService {
  return new TenantBoundaryRegistryService({
    organizations: [
      {
        organizationId: "org-1",
        displayName: "Example Org",
        billingAccountId: null,
        defaultTenantId: "tenant-1",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
    ],
    tenants: [
      {
        tenantId: "tenant-1",
        organizationId: "org-1",
        displayName: "Tenant One",
        storageScope: "storage/tenant-1",
        identityScope: "identity/tenant-1",
        policyScope: "policy/tenant-1",
        artifactScope: "artifacts/tenant-1",
        isolationMode: "shared_logical",
        deploymentMode: "cloud_shared",
        status: "active",
        createdAt: "2026-04-16T00:00:00.000Z",
        updatedAt: "2026-04-16T00:00:00.000Z",
      },
    ],
  });
}

function createMockContext(pathname = "/v1/stability", segments: string[] = [], headers: Record<string, string | undefined> = {}, body: string | null = null): RouteContext {
  return {
    requestId: "req-123",
    request: { method: body != null ? "POST" : "GET", url: pathname, headers, body } as never,
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

test("createAdminRoutes returns all registered admin routes", () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  assert.equal(routes.length, 30);
  assert.ok(routes.some((route) => route.pathname === "/v1/admin/queues"));
  assert.ok(routes.some((route) => route.pathname === "/v1/preferences" && route.method === "GET"));
  assert.ok(routes.some((route) => route.pathname === "/v1/preferences" && route.method === "PUT"));
  assert.ok(routes.some((route) => route.pathname === "/v1/admin/governance/leadership-claims" && route.method === "GET"));
  assert.ok(routes.some((route) => route.pathname === "/v1/admin/governance/leadership-claims/review-requests" && route.method === "POST"));
});

test("GET /v1/stability returns stability panel", async () => {
  const deps = {
    authService: createMockAuthService(),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("ok"));
});

test("GET /v1/stability throws when auth not configured", async () => {
  const deps = {
    authService: null,
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/stability", ["v1", "stability"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /authentication/);
  }
});

test("GET /v1/admin/tasks/:id returns admin takeover console", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("task-123"));
});

test("GET /v1/admin/tasks/:id throws for non-admin role", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/tasks/task-123", ["v1", "admin", "tasks", "task-123"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("GET /v1/admin/control-plane/load-balancing returns summary", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("generatedAt") || response.body.includes("coordinators"));
});

test("GET /v1/admin/control-plane/load-balancing throws 503 when service unavailable", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: null,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing", ["v1", "admin", "control-plane", "load-balancing"]);
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /not configured/);
  }
});

test("GET /v1/admin/queues returns queue summary", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/queues", ["v1", "admin", "queues"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("queues"));
});

test("GET and PUT /v1/preferences round-trip preference state", async () => {
  const deps = {
    authService: createMockAuthService(["operator"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);

  const getResponse = await callRoute(routes, createMockContext("/v1/preferences", ["v1", "preferences"]));
  if (!getResponse) throw new Error("Handler returned null");
  assert.equal(getResponse.statusCode, 200);
  assert.ok(getResponse.body.includes("defaultDashboardLayout"));

  const putResponse = await callRoute(
    routes,
    {
      requestId: "req-123",
      request: {
        method: "PUT",
        url: "/v1/preferences",
        headers: {},
        body: JSON.stringify({ locale: "en-US", theme: "light", defaultDashboardLayout: ["tasks", "queues"] }),
      } as never,
      route: { pathname: "/v1/preferences", segments: ["v1", "preferences"] },
      principal: null,
    },
  );
  if (!putResponse) throw new Error("Handler returned null");
  assert.equal(putResponse.statusCode, 200);
  const putBody = JSON.parse(putResponse.body);
  assert.equal(putBody.data.locale, "en-US");
  assert.equal(putBody.data.theme, "light");
  assert.deepEqual(putBody.data.defaultDashboardLayout, ["tasks", "queues"]);
});

test("POST /v1/admin/control-plane/load-balancing/select selects coordinator", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, JSON.stringify({ queueName: "default" }));
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("coord-1"));
});

test("POST /v1/admin/control-plane/load-balancing/select validates payload is object", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/control-plane/load-balancing/select", ["v1", "admin", "control-plane", "load-balancing", "select"], {}, "not an object");
  try {
    await callRoute(routes, ctx);
    assert.fail("Expected handler to throw");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.match(err.message, /Request body must be valid JSON/);
  }
});

test("POST /v1/admin/control-plane/load-balancing/select rejects dangerous json keys", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext(
    "/v1/admin/control-plane/load-balancing/select",
    ["v1", "admin", "control-plane", "load-balancing", "select"],
    {},
    "{\"__proto__\":{\"polluted\":true}}",
  );
  await assert.rejects(async () => {
    await callRoute(routes, ctx);
  }, (err: unknown) => typeof err === "object" && err != null && "code" in err && err.code === "api.invalid_json_key");
});

test("GET /v1/admin/workers returns workers list envelope", async () => {
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/admin/workers", ["v1", "admin", "workers"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"workers\""));
});

test("GET /v1/harness-runs/:id falls back from workflowId lookup to matching taskId", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]),
    missionControlService: {
      ...createMockMissionControlService(),
      getWorkflowCockpit(id: string) {
        if (id === "workflow-123") {
          throw new StorageError("workflow.not_found", "workflow.not_found", {
            statusCode: 404,
            retryable: false,
          });
        }
        return {
          summary: { taskId: "task-123", workflowId: "workflow-123", workflowStatus: "running", pendingApprovalCount: 0, retryCount: 0, generatedAt: "2026-04-16T00:00:00.000Z" },
          inspect: { workflowState: {} },
          timeline: { entries: [] },
        };
      },
      listWorkflowCockpits() {
        return [{ taskId: "task-123", workflowId: "workflow-123", workflowStatus: "running", pendingApprovalCount: 0, retryCount: 0, generatedAt: "2026-04-16T00:00:00.000Z" }];
      },
    } as unknown as MissionControlService,
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/harness-runs/workflow-123", ["v1", "harness-runs", "workflow-123"]);
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"task-123\""));
});

test("GET /v1/harness-runs/:id does not swallow internal workflow lookup errors", async () => {
  const deps = {
    authService: createMockAuthService(["viewer"]),
    missionControlService: {
      ...createMockMissionControlService(),
      getWorkflowCockpit() {
        throw new Error("database offline");
      },
      listWorkflowCockpits() {
        assert.fail("listWorkflowCockpits should not run for non-not-found failures");
      },
    } as unknown as MissionControlService,
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext("/v1/harness-runs/workflow-123", ["v1", "harness-runs", "workflow-123"]);
  await assert.rejects(() => callRoute(routes, ctx), /database offline/);
});

test("POST /v1/admin/config returns update metadata", async () => {
  const adminConfigService = new AdminConfigService();
  const deps = {
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    adminConfigService,
  };
  const routes = createAdminRoutes(deps);
  const ctx = createMockContext(
    "/v1/admin/config",
    ["v1", "admin", "config"],
    {},
    JSON.stringify({ key: "runtime.maxConcurrency", value: 8 }),
  );
  const response = await callRoute(routes, ctx);
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("runtime.maxConcurrency"));
  assert.equal(adminConfigService.listUpdates(1)[0]?.key, "runtime.maxConcurrency");
});

test("GET /v1/admin/rollouts returns active rollouts", async () => {
  const configRolloutService = new ConfigRolloutService();
  configRolloutService.startRollout("runtime.maxConcurrency", "platform", null, 25, { changedBy: "admin" });
  const routes = createAdminRoutes({
    authService: createMockAuthService(["viewer"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    configRolloutService,
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/rollouts", ["v1", "admin", "rollouts"]));
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("runtime.maxConcurrency"));
});

test("GET /v1/admin/tenants returns tenant registry data", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    tenantRegistryService: createTenantRegistryService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/tenants", ["v1", "admin", "tenants"]));
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("Tenant One"));
});

test("GET /v1/admin/budgets returns aggregated budget summaries", async () => {
  const costReportService = new CostReportService();
  costReportService.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.000Z",
    totalCostUsd: 25,
    resourceCosts: [{ resourceId: "openai", resourceType: "api", costUsd: 25, currency: "USD" }],
    submittedBy: "operator-1",
  });
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    costReportService,
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/budgets", ["v1", "admin", "budgets"]));
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"totalCostUsd\": 25"));
});

test("GET /v1/admin/chargeback/reports returns chargeback allocations", async () => {
  const costReportService = new CostReportService();
  costReportService.createReport({
    tenantId: "tenant-1",
    periodStart: "2026-04-01T00:00:00.000Z",
    periodEnd: "2026-04-30T23:59:59.000Z",
    totalCostUsd: 25,
    resourceCosts: [{ resourceId: "openai:gpt-5", resourceType: "api", costUsd: 25, currency: "USD" }],
    submittedBy: "operator-1",
  });
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
    costReportService,
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/chargeback/reports", ["v1", "admin", "chargeback", "reports"]));
  if (!response) throw new Error("Handler returned null");
  assert.equal(response.statusCode, 200);
  assert.ok(response.body.includes("\"totalCostUsd\": 25"));
  assert.ok(response.body.includes("openai:gpt-5"));
});

test("GET /v1/admin/inventories/benchmarks returns benchmark inventory", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/inventories/benchmarks", ["v1", "admin", "inventories", "benchmarks"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length > 0, true);
  assert.equal(body.data[0]?.architectureSection != null, true);
});

test("GET /v1/admin/inventories/projections returns projection inventory", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/inventories/projections", ["v1", "admin", "inventories", "projections"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length > 0, true);
  assert.equal(body.data[0]?.projectionName != null, true);
  assert.equal(body.data[0]?.consumerId != null, true);
});

test("GET /v1/admin/inventories/deployments returns deployment inventory", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/inventories/deployments", ["v1", "admin", "inventories", "deployments"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length > 0, true);
  assert.equal(body.data[0]?.deploymentId != null, true);
  assert.equal(body.data[0]?.s4Mode, "contract_only");
});

test("GET /v1/admin/inventories/schema returns authoritative schema inventory", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/inventories/schema", ["v1", "admin", "inventories", "schema"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as {
    data: {
      summary: { totalTables: number };
      tables: Array<{ tableName: string }>;
    };
  };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.summary.totalTables, body.data.tables.length);
  assert.ok(body.data.summary.totalTables >= 86);
  assert.ok(body.data.tables.some((table) => table.tableName === "outbox"));
});

test("GET /v1/admin/judges returns default judge registry descriptors", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/judges", ["v1", "admin", "judges"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length, 3);
  assert.equal(body.data[0]?.providerId != null, true);
});

test("GET /v1/admin/compliance/program-templates returns compliance templates", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/compliance/program-templates", ["v1", "admin", "compliance", "program-templates"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as { data: Array<Record<string, unknown>> };
  assert.equal(response.statusCode, 200);
  assert.equal(body.data.length, 3);
  assert.equal(body.data[0]?.templateId != null, true);
});

test("GET /v1/admin/governance/leadership-claims returns governance snapshot", async () => {
  const routes = createAdminRoutes({
    authService: createMockAuthService(["admin"]),
    missionControlService: createMockMissionControlService(),
    coordinatorLoadBalancingService: createMockLoadBalancingService(),
  });

  const response = await callRoute(routes, createMockContext("/v1/admin/governance/leadership-claims", ["v1", "admin", "governance", "leadership-claims"]));
  if (!response) throw new Error("Handler returned null");
  const body = JSON.parse(response.body) as {
    data: {
      families: Array<Record<string, unknown>>;
      claims: Array<Record<string, unknown>>;
      summary: { familyCount: number };
    };
  };
  assert.equal(response.statusCode, 200);
  assert.ok(body.data.summary.familyCount >= 1);
  assert.ok(body.data.families.length >= 1);
  assert.ok(Array.isArray(body.data.claims));
});

test("POST /v1/admin/governance/leadership-claims/review-requests persists a review request", async () => {
  const originalDataRoot = process.env.AA_DATA_ROOT;
  const workspace = mkdtempSync(join(tmpdir(), "aa-admin-leadership-review-"));
  process.env.AA_DATA_ROOT = workspace;

  try {
    const routes = createAdminRoutes({
      authService: createMockAuthService(["admin"]),
      missionControlService: createMockMissionControlService(),
      coordinatorLoadBalancingService: createMockLoadBalancingService(),
    });
    const response = await callRoute(
      routes,
      createMockContext(
        "/v1/admin/governance/leadership-claims/review-requests",
        ["v1", "admin", "governance", "leadership-claims", "review-requests"],
        { "content-type": "application/json" },
        JSON.stringify({
          familyId: "engineering",
          divisionId: "coding",
          scenarioId: "issue-to-patch",
          requestedClaimLevel: "local_leader",
          requestedSurfaces: ["docs", "ui"],
          rationale: "evidence package is complete",
        }),
      ),
    );
    if (!response) throw new Error("Handler returned null");
    const body = JSON.parse(response.body) as {
      data: {
        reviewRequest: {
          familyId: string;
          requestedBy: string;
          status: string;
        };
      };
    };
    assert.equal(response.statusCode, 201);
    assert.equal(body.data.reviewRequest.familyId, "engineering");
    assert.equal(body.data.reviewRequest.requestedBy, "actor-1");
    assert.equal(body.data.reviewRequest.status, "pending");
  } finally {
    if (originalDataRoot == null) {
      delete process.env.AA_DATA_ROOT;
    } else {
      process.env.AA_DATA_ROOT = originalDataRoot;
    }
    rmSync(workspace, { recursive: true, force: true });
  }
});
