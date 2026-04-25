/**
 * Unit tests for snapshot builder functionality
 * Tests buildSnapshot output structure and helper function outcomes
 */

import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";

test("buildSnapshot returns correct snapshot structure with all required fields", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.generatedAt.length > 0);
  assert.equal(snapshot.operator.operatorId, "op-1");
  assert.ok(Array.isArray(snapshot.moduleCoverage));
  assert.ok(Array.isArray(snapshot.taskBoard));
  assert.ok(Array.isArray(snapshot.approvalQueue));
  assert.ok(Array.isArray(snapshot.workerPanel));
  assert.ok(Array.isArray(snapshot.tenantPanel));
  assert.ok(Array.isArray(snapshot.incidentTimeline));
  assert.ok(Array.isArray(snapshot.findings));
});

test("buildSnapshot with empty data sources returns empty arrays", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.deepEqual(snapshot.taskBoard, []);
  assert.deepEqual(snapshot.approvalQueue, []);
  assert.deepEqual(snapshot.workerPanel, []);
  assert.deepEqual(snapshot.tenantPanel, []);
  assert.deepEqual(snapshot.incidentTimeline, []);
  assert.deepEqual(snapshot.findings, []);
});

test("buildSnapshot filters task board by operator tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
      { taskId: "t-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
      { taskId: "t-3", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
    ],
  });

  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 1);
  assert.equal(snapshot.taskBoard[0]?.taskId, "t-1");
});

test("buildSnapshot operator without tenant scope sees all tasks", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
      { taskId: "t-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
    ],
  });

  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
});

test("buildSnapshot filters approval queue by operator tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a-1", taskId: "t-1", tenantId: "tenant-a", riskLevel: "high", reason: "Test 1", createdAt: "2026-04-25T00:00:00.000Z" },
      { approvalId: "a-2", taskId: "t-2", tenantId: "tenant-b", riskLevel: "medium", reason: "Test 2", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });

  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-b", workspaceId: null };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0]?.approvalId, "a-2");
});

test("buildSnapshot filters incidents by operator tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: "tenant-a", severity: "warning" as const, summary: "First", createdAt: "2026-04-24T10:00:00.000Z" },
      { incidentId: "i-2", taskId: null, tenantId: "tenant-b", severity: "critical" as const, summary: "Second", createdAt: "2026-04-24T11:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-b", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-2");
});

test("buildSnapshot incident timeline is sorted by createdAt descending", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-old", taskId: null, tenantId: null, severity: "info" as const, summary: "Old", createdAt: "2026-04-20T00:00:00.000Z" },
      { incidentId: "i-new", taskId: null, tenantId: null, severity: "info" as const, summary: "New", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-new");
  assert.equal(snapshot.incidentTimeline[1]?.incidentId, "i-old");
});

test("buildSnapshot incident timeline limited to 50 items", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () =>
      Array.from({ length: 100 }, (_, i) => ({
        incidentId: `i-${i}`,
        taskId: null,
        tenantId: null,
        severity: "info" as const,
        summary: `Incident ${i}`,
        createdAt: new Date(Date.now() - i * 1000).toISOString(),
      })),
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.incidentTimeline.length <= 50);
});

test("buildFindings includes critical approval waiting", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "critical", reason: "Critical action", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
});

test("buildFindings includes blocked tasks existence", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});

test("buildFindings includes offline worker with active executions", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-offline", status: "offline" as const, activeExecutionCount: 3, queueDepth: 0 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});

test("buildFindings includes critical incident", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: null, severity: "critical" as const, summary: "Critical", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});

test("buildFindings is empty when no conditions are met", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
    ],
    listWorkers: () => [
      { workerId: "w-1", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.findings.length, 0);
});

test("buildModuleCoverage includes all 10 module IDs", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.moduleCoverage.length, 10);
});

test("buildModuleCoverage marks worker_management available when workers exist", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-1", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.ok(workerModule);
  assert.equal(workerModule.status, "available");
});

test("buildModuleCoverage marks worker_management empty when no workers", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.ok(workerModule);
  assert.equal(workerModule.status, "empty");
});

test("buildModuleCoverage marks queue_management available when any worker has queue depth", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-1", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
      { workerId: "w-2", status: "online" as const, activeExecutionCount: 0, queueDepth: 5 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const queueModule = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.ok(queueModule);
  assert.equal(queueModule.status, "available");
});

test("buildModuleCoverage marks tenant_management available when tenants exist", () => {
  const service = new OperatorConsoleBackendService({
    listTenants: () => [
      { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
  assert.ok(tenantModule);
  assert.equal(tenantModule.status, "available");
});

test("buildModuleCoverage marks approval_management available when approvals exist", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "low", reason: "Test", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const approvalModule = snapshot.moduleCoverage.find((m) => m.moduleId === "approval_management");
  assert.ok(approvalModule);
  assert.equal(approvalModule.status, "available");
});

test("buildModuleCoverage marks incident_timeline available when incidents exist", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: null, severity: "info" as const, summary: "Test", createdAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const incidentModule = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.ok(incidentModule);
  assert.equal(incidentModule.status, "available");
});

test("buildModuleCoverage marks oapeflir_loop_management available when tasks exist", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-25T00:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const loopModule = snapshot.moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
  assert.ok(loopModule);
  assert.equal(loopModule.status, "available");
});

test("buildModuleCoverage marks modules without data as empty", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  for (const module of snapshot.moduleCoverage) {
    assert.equal(module.status, "empty");
  }
});

test("buildSnapshot tenant panel is filtered by operator scope", () => {
  const service = new OperatorConsoleBackendService({
    listTenants: () => [
      { tenantId: "tenant-a", organizationId: "org-1", isolationMode: "strict" },
      { tenantId: "tenant-b", organizationId: "org-2", isolationMode: "standard" },
    ],
  });

  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 1);
  assert.equal(snapshot.tenantPanel[0]?.tenantId, "tenant-a");
});

test("buildSnapshot operator without tenant scope sees all tenants", () => {
  const service = new OperatorConsoleBackendService({
    listTenants: () => [
      { tenantId: "tenant-a", organizationId: "org-1", isolationMode: "strict" },
      { tenantId: "tenant-b", organizationId: "org-2", isolationMode: "standard" },
    ],
  });

  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 2);
});

test("buildSnapshot operator identity is preserved in snapshot", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-123", roles: ["admin", "operator"], tenantId: "tenant-x", workspaceId: "ws-y" };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.operator.operatorId, "op-123");
  assert.deepEqual(snapshot.operator.roles, ["admin", "operator"]);
  assert.equal(snapshot.operator.tenantId, "tenant-x");
  assert.equal(snapshot.operator.workspaceId, "ws-y");
});

test("planHumanTakeoverAction sets correct action plan structure", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-123",
    operator,
    reasonCode: "operator_override",
  });

  assert.equal(plan.actionId, "action-1");
  assert.equal(plan.actionType, "take_over_task");
  assert.equal(plan.taskId, "task-123");
  assert.equal(plan.operatorId, "op-1");
  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction with high-risk action requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const highRiskActions = ["switch_worker", "attach_artifact", "advance_rollout", "rollback_rollout", "finish_task"] as const;

  for (const actionType of highRiskActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: `action-${actionType}`,
      actionType,
      taskId: "task-123",
      operator,
      reasonCode: "test",
    });
    assert.equal(plan.requiresPolicyEvaluation, true, `${actionType} should require policy evaluation`);
  }
});

test("planHumanTakeoverAction with break-glass action requires break-glass when not authorized", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const breakGlassActions = ["skip_step", "switch_worker", "finish_task", "rollback_rollout"] as const;

  for (const actionType of breakGlassActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: `action-${actionType}`,
      actionType,
      taskId: "task-123",
      operator,
      reasonCode: "test",
    });
    assert.equal(plan.requiresBreakGlass, true, `${actionType} should require break-glass`);
  }
});

test("planHumanTakeoverAction does not require break-glass if operator has break_glass role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator", "break_glass"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "skip_step",
    taskId: "task-123",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction combines high-risk and break-glass for switch_worker", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "switch_worker",
    taskId: "task-123",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, true);
});

test("planHumanTakeoverAction auditPayload contains all fields", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "retry_step",
    taskId: "task-123",
    operator,
    reasonCode: "user_request",
    beforeStateRef: "state-before",
    afterStateRef: "state-after",
  });

  assert.deepEqual(plan.auditPayload, {
    actionType: "retry_step",
    reasonCode: "user_request",
    beforeStateRef: "state-before",
    afterStateRef: "state-after",
  });
});

test("planHumanTakeoverAction handles missing optional state refs as null", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "retry_step",
    taskId: "task-123",
    operator,
    reasonCode: "user_request",
  });

  assert.equal(plan.auditPayload.beforeStateRef, null);
  assert.equal(plan.auditPayload.afterStateRef, null);
});

test("planHumanTakeoverAction handles null tenant and workspace", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-123",
    tenantId: null,
    workspaceId: null,
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.tenantId, null);
  assert.equal(plan.workspaceId, null);
});

test("planHumanTakeoverAction uses provided tenant and workspace", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-123",
    tenantId: "tenant-x",
    workspaceId: "workspace-y",
    operator,
    reasonCode: "test",
  });

  assert.equal(plan.tenantId, "tenant-x");
  assert.equal(plan.workspaceId, "workspace-y");
});

test("planHumanTakeoverAction validates task id is not empty", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "a-1",
        actionType: "take_over_task",
        taskId: "   ",
        operator,
        reasonCode: "test",
      }),
    (error) => error instanceof Error && (error as any).code === "console.task_id_required",
  );
});

test("planHumanTakeoverAction validates reason is not empty", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "a-1",
        actionType: "take_over_task",
        taskId: "task-123",
        operator,
        reasonCode: "",
      }),
    (error) => error instanceof Error && (error as any).code === "console.reason_required",
  );
});

test("buildSnapshot validates operator id is not empty", () => {
  const service = new OperatorConsoleBackendService({});

  assert.throws(
    () =>
      service.buildSnapshot({
        operatorId: "",
        roles: ["operator"],
        tenantId: null,
        workspaceId: null,
      }),
    (error) => error instanceof Error && (error as any).code === "console.operator_id_required",
  );
});

test("buildSnapshot validates operator id is not whitespace only", () => {
  const service = new OperatorConsoleBackendService({});

  assert.throws(
    () =>
      service.buildSnapshot({
        operatorId: "   ",
        roles: ["operator"],
        tenantId: null,
        workspaceId: null,
      }),
    (error) => error instanceof Error && (error as any).code === "console.operator_id_required",
  );
});
