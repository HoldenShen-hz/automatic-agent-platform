import assert from "node:assert/strict";
import test from "node:test";

import { ApiAuthService } from "../../src/platform/five-plane-interface/api/api-auth-service.js";
import { createMissionRoutes } from "../../src/platform/five-plane-interface/api/http-server/mission-routes.js";
import { createTaskRoutes } from "../../src/platform/five-plane-interface/api/http-server/task-routes.js";
import type { RouteDefinition } from "../../src/platform/five-plane-interface/api/http-server/types.js";
import type { MissionControlService } from "../../src/platform/five-plane-interface/api/mission-control-service.js";
import { MissionLiveGuard } from "../../src/platform/five-plane-control-plane/mission/index.js";
import { InMemoryMissionRepository } from "../../src/platform/five-plane-state-evidence/truth/mission-repository.js";
import type { AuthoritativeTaskStore } from "../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";

const authService = new ApiAuthService({
  jwtSecret: "mission-e2e-secret",
  apiKeys: [{ apiKey: "mission-e2e-key", actorId: "user_001", roles: ["admin", "operator", "viewer"], tenantId: "tenant_001" }],
});

function authHeaders(extra: Record<string, string> = {}) {
  const token = authService.exchangeApiKey("mission-e2e-key").accessToken;
  return {
    authorization: `Bearer ${token}`,
    "content-type": "application/json",
    "x-trace-id": "trace_mission_e2e",
    "x-correlation-id": "corr_mission_e2e",
    ...extra,
  };
}

async function invokeRoute(
  routes: readonly RouteDefinition[],
  method: string,
  pathname: string,
  body: Record<string, unknown> | null = null,
  headers: Record<string, string | undefined> = authHeaders(),
) {
  const segments = pathname.split("/").filter((segment) => segment.length > 0);
  for (const route of routes) {
    if (route.method !== method || route.pathname != null && route.pathname !== pathname) {
      continue;
    }
    const response = await route.handler({
      requestId: `req_${method}_${segments.join("_")}`,
      principal: null,
      route: { pathname, segments },
      request: {
        method,
        url: pathname,
        headers,
        body: body == null ? null : JSON.stringify(body),
      },
    });
    if (response != null) {
      return response;
    }
  }
  throw new Error(`route_not_found:${method}:${pathname}`);
}

test("Mission canonical E2E creates a Mission, binds a Task snapshot, and live-guards freeze", async () => {
  const repository = new InMemoryMissionRepository();
  const missionRoutes = createMissionRoutes({ authService, missionRepository: repository });
  const taskIds: string[] = [];
  const taskStore = {
    task: {
      insertTask(record: { id: string }) {
        taskIds.push(record.id);
      },
    },
  } as unknown as AuthoritativeTaskStore;
  const taskRoutes = createTaskRoutes({
    authService,
    inspectService: new InspectService(taskStore),
    missionControlService: {
      getTaskCockpit(taskId: string) {
        return { snapshot: { task: { id: taskId, tenantId: "tenant_001" }, events: [] } };
      },
    } as unknown as MissionControlService,
    taskStore,
    missionRepository: repository,
  });
  const createdResponse = await invokeRoute(missionRoutes, "POST", "/v1/missions", {
    title: "Mission E2E",
    objective: "Bind canonical task flow",
    successCriteria: ["task snapshot exists"],
    domainId: "coding",
  });
  const created = JSON.parse(createdResponse.body).data.mission;
  const activeResponse = await invokeRoute(
    missionRoutes,
    "POST",
    `/v1/missions/${created.missionId}:activate`,
    {},
    authHeaders({ "if-match": created.etag }),
  );
  const active = JSON.parse(activeResponse.body).data.mission;
  const taskResponse = await invokeRoute(taskRoutes, "POST", "/v1/tasks", {
    title: "Mission-bound implementation",
    divisionId: "coding",
    riskClass: "medium",
    missionRef: { mode: "use_existing", missionId: active.missionId },
  });

  assert.equal(taskResponse.statusCode, 201);
  assert.equal(taskIds.length, 1);
  const missionTasks = repository.listMissionTasks(active.missionId);
  assert.equal(missionTasks[0]?.id, taskIds[0]);
  const missionEvidence = repository.listMissionEvidence(active.missionId);
  const missionSnapshotId = missionEvidence[0]!.id;
  const guard = new MissionLiveGuard(repository);
  const principal = { principalId: "user_001", type: "human" as const, tenantId: "tenant_001", roles: ["operator"] };
  assert.equal(guard.evaluate({ missionSnapshotId, principal }).allowed, true);

  const freezeResponse = await invokeRoute(
    missionRoutes,
    "POST",
    `/v1/missions/${active.missionId}:freeze`,
    {},
    authHeaders({ "if-match": active.etag }),
  );
  assert.equal(JSON.parse(freezeResponse.body).data.mission.status, "frozen");
  assert.equal(guard.evaluate({ missionSnapshotId, principal }).reasonCode, "mission.not_executable");
});

test("Mission canonical E2E rejects high-risk Task dispatch without Mission context", async () => {
  const taskStore = {
    task: { insertTask() { throw new Error("high_risk_task_must_not_insert"); } },
  } as unknown as AuthoritativeTaskStore;
  const taskRoutes = createTaskRoutes({
    authService,
    inspectService: new InspectService(taskStore),
    missionControlService: {
      getTaskCockpit(taskId: string) {
        return { snapshot: { task: { id: taskId, tenantId: "tenant_001" }, events: [] } };
      },
    } as unknown as MissionControlService,
    taskStore,
    missionRepository: new InMemoryMissionRepository(),
  });

  await assert.rejects(
    () => invokeRoute(taskRoutes, "POST", "/v1/tasks", { title: "High-risk Missionless task", riskClass: "high" }),
    /mission\.formal_required_for_risk/u,
  );
});
