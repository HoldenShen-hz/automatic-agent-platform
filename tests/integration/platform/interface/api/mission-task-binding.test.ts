import test from "node:test";
import assert from "node:assert/strict";

import { ApiAuthService } from "../../../../../src/platform/five-plane-interface/api/api-auth-service.js";
import { createTaskRoutes } from "../../../../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { RouteDefinition } from "../../../../../src/platform/five-plane-interface/api/http-server/types.js";
import type { MissionControlService } from "../../../../../src/platform/five-plane-interface/api/mission-control-service.js";
import { InspectService } from "../../../../../src/platform/shared/observability/inspect-service.js";
import { InMemoryMissionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";

const authService = new ApiAuthService({
  jwtSecret: "test-secret",
  apiKeys: [{ apiKey: "key_001", actorId: "user_001", roles: ["admin", "operator", "viewer"], tenantId: "tenant_001" }],
});

function authHeaders() {
  const token = authService.exchangeApiKey("key_001").accessToken;
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-trace-id": "trace_001",
    "x-correlation-id": "corr_001",
  };
}

async function invokeRoute(routes: RouteDefinition[], body: Record<string, unknown>) {
  const route = routes.find((candidate) => candidate.method === "POST" && candidate.segments === true);
  assert.ok(route);
  return route.handler({
    requestId: "req_task_mission",
    principal: null,
    route: { pathname: "/v1/tasks", segments: ["v1", "tasks"] },
    request: {
      method: "POST",
      url: "/v1/tasks",
      headers: authHeaders(),
      body: JSON.stringify(body),
    },
  });
}

test("POST /v1/tasks binds task creation to explicit Mission snapshot when repository is configured", async () => {
  const missionRepository = new InMemoryMissionRepository();
  const mission = missionRepository.createMission({
    missionId: "mis_task_binding",
    tenantId: "tenant_001",
    title: "Task binding mission",
    objective: "Bind task creation",
    successCriteria: ["snapshot recorded"],
    ownerPrincipalId: "user_001",
    createdBy: "user_001",
    traceId: "trace_001",
    correlationId: "corr_001",
  });
  const insertedTaskIds: string[] = [];
  const taskStore = {
    task: {
      insertTask(record: { id: string }) {
        insertedTaskIds.push(record.id);
      },
    },
  } as unknown as AuthoritativeTaskStore;
  const missionControlService = {
    getTaskCockpit(taskId: string) {
      return { snapshot: { task: { id: taskId, tenantId: "tenant_001" }, events: [] } };
    },
  } as unknown as MissionControlService;
  const routes = createTaskRoutes({
    authService,
    inspectService: new InspectService(),
    missionControlService,
    taskStore,
    missionRepository,
  });

  const response = await invokeRoute(routes, {
    title: "Mission-bound task",
    divisionId: "coding",
    missionRef: { mode: "use_existing", missionId: mission.missionId },
    riskClass: "medium",
  });

  assert.equal(response?.statusCode, 201);
  assert.equal(insertedTaskIds.length, 1);
  const tasks = missionRepository.listMissionTasks(mission.missionId);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0]!.id, insertedTaskIds[0]);
  assert.equal(missionRepository.listMissionEvidence(mission.missionId).length, 1);
});

test("POST /v1/tasks rejects high-risk task without Mission when repository is configured", async () => {
  const taskStore = { task: { insertTask() { throw new Error("should_not_insert"); } } } as unknown as AuthoritativeTaskStore;
  const missionControlService = {
    getTaskCockpit(taskId: string) {
      return { snapshot: { task: { id: taskId, tenantId: "tenant_001" }, events: [] } };
    },
  } as unknown as MissionControlService;
  const routes = createTaskRoutes({
    authService,
    inspectService: new InspectService(),
    missionControlService,
    taskStore,
    missionRepository: new InMemoryMissionRepository(),
  });

  await assert.rejects(
    () => invokeRoute(routes, { title: "High-risk no mission", riskClass: "high" }),
    (error) => error instanceof Error && error.message.includes("mission.formal_required_for_risk"),
  );
});
