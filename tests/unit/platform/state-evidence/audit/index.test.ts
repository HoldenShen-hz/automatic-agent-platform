import assert from "node:assert/strict";
import test from "node:test";

import { AuditTrailService } from "../../../../../src/platform/five-plane-state-evidence/audit/index.js";

test("AuditTrailService records and exports task and tenant audit trails", () => {
  const service = new AuditTrailService();
  service.record({
    actorType: "system",
    actorId: "runtime",
    tenantId: "tenant_a",
    taskId: "task_1",
    executionId: "exec_1",
    action: "workflow.started",
    resourceRef: "task:task_1",
    decisionRef: null,
    versionRef: "v1",
    metadata: {},
  });

  assert.equal(service.exportForTask("task_1").length, 1);
  assert.equal(service.exportForTenant("tenant_a").length, 1);
});
