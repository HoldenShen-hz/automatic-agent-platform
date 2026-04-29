import assert from "node:assert/strict";
import test from "node:test";

import { DashboardProjectionService } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

test("DashboardProjectionService carries tenant metadata into task deltas", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.updated" as never, {
    taskId: "task-1",
    tenantId: "tenant-1",
    status: "in_progress",
  });

  assert.equal(delta?.tenantId, "tenant-1");
  assert.equal(delta?.visibilityScope, "tenant");
});

test("DashboardProjectionService marks system health deltas as global scope", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("system.health.changed" as never, {
    component: "queue",
    status: "degraded",
  });

  assert.equal(delta?.tenantId ?? null, null);
  assert.equal(delta?.visibilityScope, "global");
});
