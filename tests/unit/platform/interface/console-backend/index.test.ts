import assert from "node:assert/strict";
import test from "node:test";

import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";

test("OperatorConsoleBackendService builds a tenant-scoped operator snapshot with findings", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "task-a", tenantId: "tenant-a", workspaceId: "workspace-a", status: "blocked", riskLevel: "high", updatedAt: "2026-04-20T00:00:00.000Z" },
      { taskId: "task-b", tenantId: "tenant-b", workspaceId: "workspace-b", status: "running", riskLevel: "low", updatedAt: "2026-04-20T00:00:00.000Z" },
    ],
    listPendingApprovals: () => [
      { approvalId: "approval-1", taskId: "task-a", tenantId: "tenant-a", riskLevel: "critical", reason: "org change", createdAt: "2026-04-20T00:00:00.000Z" },
    ],
    listWorkers: () => [
      { workerId: "worker-1", status: "offline", activeExecutionCount: 1, queueDepth: 2 },
    ],
    listIncidents: () => [
      { incidentId: "incident-1", taskId: "task-a", tenantId: "tenant-a", severity: "critical", summary: "execution stuck", createdAt: "2026-04-20T00:01:00.000Z" },
    ],
    listTenants: () => [
      { tenantId: "tenant-a", organizationId: "org-a", isolationMode: "shared_hard_scoped" },
      { tenantId: "tenant-b", organizationId: "org-b", isolationMode: "dedicated_runtime" },
    ],
  });

  const snapshot = service.buildSnapshot({
    operatorId: "op-1",
    roles: ["operator"],
    tenantId: "tenant-a",
  });

  assert.equal(snapshot.taskBoard.length, 1);
  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.tenantPanel.length, 1);
  assert.ok(snapshot.findings.includes("critical approval waiting for operator decision"));
  assert.ok(snapshot.findings.includes("critical incident requires takeover review"));
});

test("OperatorConsoleBackendService plans break-glass actions for privileged operations", () => {
  const service = new OperatorConsoleBackendService();
  const plan = service.planHumanTakeoverAction({
    actionId: "opact-1",
    actionType: "finish_task",
    taskId: "task-a",
    operator: {
      operatorId: "op-1",
      roles: ["operator"],
    },
    reasonCode: "incident.stop_loss",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, true);
  assert.equal(plan.auditPayload.reasonCode, "incident.stop_loss");
});
