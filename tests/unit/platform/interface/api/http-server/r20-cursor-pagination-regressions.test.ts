import assert from "node:assert/strict";
import test from "node:test";

import { IncidentCaseService } from "../../../../../../src/platform/five-plane-state-evidence/incident/index.js";
import { HierarchicalPromptRegistryService } from "../../../../../../src/platform/prompt-engine/registry/hierarchical-registry-service.js";
import { createDashboardRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/dashboard-routes.js";
import { createIncidentRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/incident-routes.js";
import { createPromptRoutes } from "../../../../../../src/platform/five-plane-interface/api/http-server/prompt-routes.js";
import type { ApiAuthService } from "../../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import type { IncidentFacadeService } from "../../../../../../src/platform/five-plane-interface/api/facade-interfaces.js";
import type { MissionControlService } from "../../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import type { ApiResponsePayload, RouteContext, RouteDefinition } from "../../../../../../src/platform/five-plane-interface/api/http-server/types.js";

function createMockAuthService(): ApiAuthService {
  return {
    requireRole: () => ({ actorId: "actor-1", roles: ["viewer", "operator", "admin"], authMethod: "api_key", tenantId: null }),
  } as unknown as ApiAuthService;
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

function createContext(url: string, pathname: string, segments: string[]): RouteContext {
  return {
    requestId: "req-r20",
    request: { method: "GET", url, headers: {}, body: null } as never,
    route: { pathname, segments },
    principal: null,
  };
}

test("R20-30 incident routes return and consume cursor pagination", async () => {
  const backingService = new IncidentCaseService();
  backingService.openIncident({ severity: "high", title: "Incident A" });
  backingService.openIncident({ severity: "high", title: "Incident B" });
  backingService.openIncident({ severity: "high", title: "Incident C" });
  const incidentService: IncidentFacadeService = {
    listIncidents: (limit, tenantId) => backingService.listIncidents(limit, tenantId),
    listIncidentsPaginated: (limit, tenantId, cursor) => backingService.listIncidentsPaginated(limit, tenantId, cursor),
    getIncident: (incidentId, tenantId) => backingService.getIncident(incidentId, tenantId),
    openIncident: (input) => backingService.openIncident(input),
    acknowledge: (incidentId, owner, tenantId) => backingService.acknowledge(incidentId, owner, tenantId),
    startMitigation: (incidentId, tenantId) => backingService.startMitigation(incidentId, tenantId),
    resolve: (incidentId, tenantId) => backingService.resolve(incidentId, tenantId),
  };

  const routes = createIncidentRoutes({
    authService: createMockAuthService(),
    incidentService,
  });

  const firstResponse = await callRoute(routes, createContext("http://localhost/v1/incidents?limit=2", "/v1/incidents", ["v1", "incidents"]));
  if (!firstResponse) throw new Error("missing incident first page");
  const firstBody = JSON.parse(firstResponse.body) as { data: { incidents: Array<{ title: string }>; nextCursor?: string } };
  assert.deepEqual(firstBody.data.incidents.map((item) => item.title), ["Incident C", "Incident B"]);
  assert.equal(typeof firstBody.data.nextCursor, "string");

  const secondResponse = await callRoute(
    routes,
    createContext(
      `http://localhost/v1/incidents?limit=2&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`,
      "/v1/incidents",
      ["v1", "incidents"],
    ),
  );
  if (!secondResponse) throw new Error("missing incident second page");
  const secondBody = JSON.parse(secondResponse.body) as { data: { incidents: Array<{ title: string }>; nextCursor?: string } };
  assert.deepEqual(secondBody.data.incidents.map((item) => item.title), ["Incident A"]);
  assert.equal(secondBody.data.nextCursor, undefined);
});

test("R20-30 prompt routes return and consume cursor pagination", async () => {
  const registry = new HierarchicalPromptRegistryService();
  for (const name of ["prompt.alpha", "prompt.beta", "prompt.gamma"]) {
    registry.registerBundle({
      name,
      version: 1,
      displayVersion: "1.0.0",
      domain: "global",
      taskType: "general",
      packId: undefined,
      systemPrompt: { content: `${name} system`, templateVariables: [], channel: "system" },
      userPrompt: undefined,
      fewShotExamples: undefined,
      constraints: undefined,
      compatibilityMatrix: {
        toolSchemaVersions: [],
        evaluatorSchemaVersions: [],
        domainDescriptorVersions: [],
        modelRoutingProfiles: [],
      },
      metadata: undefined,
    }, "global");
  }

  const routes = createPromptRoutes({
    authService: createMockAuthService(),
    promptRegistryService: registry,
  });

  const firstResponse = await callRoute(routes, createContext("http://localhost/v1/prompts?limit=1", "/v1/prompts", ["v1", "prompts"]));
  if (!firstResponse) throw new Error("missing prompt first page");
  const firstBody = JSON.parse(firstResponse.body) as { data: { prompts: Array<{ bundle: { name: string } }>; nextCursor?: string } };
  assert.equal(firstBody.data.prompts.length, 1);
  assert.equal(typeof firstBody.data.nextCursor, "string");

  const secondResponse = await callRoute(
    routes,
    createContext(
      `http://localhost/v1/prompts?limit=1&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`,
      "/v1/prompts",
      ["v1", "prompts"],
    ),
  );
  if (!secondResponse) throw new Error("missing prompt second page");
  const secondBody = JSON.parse(secondResponse.body) as { data: { prompts: Array<{ bundle: { name: string } }> } };
  assert.equal(secondBody.data.prompts.length, 1);
  assert.notEqual(secondBody.data.prompts[0]?.bundle.name, firstBody.data.prompts[0]?.bundle.name);
});

test("R20-30 dashboard workbench snapshot paginates approvals and task board via cursor", async () => {
  const missionControlService = {
    getSnapshot: () => ({
      generatedAt: "2026-05-11T00:00:00.000Z",
      health: { status: "ok", queuedTasks: 0, activeExecutions: 0, tier1AckBacklog: 0, findings: [] },
      metrics: { tasksTotal: 3, tasksActive: 1, tasksDone: 1, tasksFailed: 0 },
      taskBoard: [
        { taskId: "task-1", title: "Task 1", taskStatus: "done", owner: null, updatedAt: "2026-05-11T00:00:00.000Z" },
        { taskId: "task-2", title: "Task 2", taskStatus: "in_progress", owner: null, updatedAt: "2026-05-11T00:01:00.000Z" },
        { taskId: "task-3", title: "Task 3", taskStatus: "queued", owner: null, updatedAt: "2026-05-11T00:02:00.000Z" },
      ],
      pendingApprovals: [
        {
          id: "approval-1",
          taskId: "task-1",
          executionId: "exec-1",
          sourceAgentId: "agent-1",
          reason: "Promote rollout",
          requestJson: JSON.stringify({ title: "Approval 1", reason: "Reason 1", riskLevel: "medium" }),
          optionsJson: JSON.stringify(["approve"]),
          requestedAt: "2026-05-11T00:00:00.000Z",
          expiresAt: null,
          status: "requested",
          respondedBy: null,
          respondedAt: null,
          responseJson: null,
          timeoutPolicy: "expire",
          createdAt: "2026-05-11T00:00:00.000Z",
          updatedAt: "2026-05-11T00:00:00.000Z",
        },
        {
          id: "approval-2",
          taskId: "task-2",
          executionId: "exec-2",
          sourceAgentId: "agent-2",
          reason: "Approval 2",
          requestJson: JSON.stringify({ title: "Approval 2", reason: "Reason 2", riskLevel: "high" }),
          optionsJson: JSON.stringify(["approve"]),
          requestedAt: "2026-05-11T00:01:00.000Z",
          expiresAt: null,
          status: "requested",
          respondedBy: null,
          respondedAt: null,
          responseJson: null,
          timeoutPolicy: "expire",
          createdAt: "2026-05-11T00:01:00.000Z",
          updatedAt: "2026-05-11T00:01:00.000Z",
        },
        {
          id: "approval-3",
          taskId: "task-3",
          executionId: "exec-3",
          sourceAgentId: "agent-3",
          reason: "Approval 3",
          requestJson: JSON.stringify({ title: "Approval 3", reason: "Reason 3", riskLevel: "critical" }),
          optionsJson: JSON.stringify(["approve"]),
          requestedAt: "2026-05-11T00:02:00.000Z",
          expiresAt: null,
          status: "requested",
          respondedBy: null,
          respondedAt: null,
          responseJson: null,
          timeoutPolicy: "expire",
          createdAt: "2026-05-11T00:02:00.000Z",
          updatedAt: "2026-05-11T00:02:00.000Z",
        },
      ],
      productSignals: { billingAccounts: [], latestPmfReport: null, perceptionBriefs: [] },
      divisions: [],
      gatewayTargets: [],
    }),
  } as unknown as MissionControlService;

  const routes = createDashboardRoutes({
    authService: createMockAuthService(),
    missionControlService,
  });

  const firstResponse = await callRoute(
    routes,
    createContext("http://localhost/v1/workbench/snapshot?limit=1", "/v1/workbench/snapshot", ["v1", "workbench", "snapshot"]),
  );
  if (!firstResponse) throw new Error("missing workbench first page");
  const firstBody = JSON.parse(firstResponse.body) as { data: { nextCursor?: string; workbench: { approvalQueue: Array<{ approvalId: string }>; dashboard: { recentCompletions: Array<{ taskId: string }> } } } };
  assert.deepEqual(firstBody.data.workbench.approvalQueue.map((item) => item.approvalId), ["approval-1"]);
  assert.equal(typeof firstBody.data.nextCursor, "string");
  assert.deepEqual(firstBody.data.workbench.dashboard.recentCompletions.map((item) => item.taskId), ["task-1"]);

  const secondResponse = await callRoute(
    routes,
    createContext(
      `http://localhost/v1/workbench/snapshot?limit=1&cursor=${encodeURIComponent(firstBody.data.nextCursor!)}`,
      "/v1/workbench/snapshot",
      ["v1", "workbench", "snapshot"],
    ),
  );
  if (!secondResponse) throw new Error("missing workbench second page");
  const secondBody = JSON.parse(secondResponse.body) as { data: { workbench: { approvalQueue: Array<{ approvalId: string }>; dashboard: { recentCompletions: Array<{ taskId: string }> } } } };
  assert.deepEqual(secondBody.data.workbench.approvalQueue.map((item) => item.approvalId), ["approval-2"]);
  assert.deepEqual(secondBody.data.workbench.dashboard.recentCompletions.map((item) => item.taskId), []);
});
