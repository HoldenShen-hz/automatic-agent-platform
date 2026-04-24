/**
 * Unit tests for OperatorConsoleBackendService - Additional coverage
 * Tests module coverage, findings, and edge cases
 */

import assert from "node:assert/strict";
import test from "node:test";

import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";

test("buildSnapshot with empty data sources returns empty arrays", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(Array.isArray(snapshot.moduleCoverage));
  assert.ok(Array.isArray(snapshot.taskBoard));
  assert.ok(Array.isArray(snapshot.approvalQueue));
  assert.ok(Array.isArray(snapshot.workerPanel));
  assert.ok(Array.isArray(snapshot.tenantPanel));
  assert.ok(Array.isArray(snapshot.incidentTimeline));
  assert.ok(Array.isArray(snapshot.findings));
});

test("buildSnapshot includes all module IDs in moduleCoverage", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.moduleCoverage.length >= 10);
  const moduleIds = snapshot.moduleCoverage.map((m) => m.moduleId);
  assert.ok(moduleIds.includes("worker_management"));
  assert.ok(moduleIds.includes("queue_management"));
  assert.ok(moduleIds.includes("approval_management"));
  assert.ok(moduleIds.includes("incident_timeline"));
});

test("buildSnapshot marks modules with data as available", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-1", status: "online" as const, activeExecutionCount: 2, queueDepth: 5 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.ok(workerModule);
  assert.equal(workerModule.status, "available");
});

test("buildSnapshot marks modules without data as empty", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.ok(workerModule);
  assert.equal(workerModule.status, "empty");
});

test("buildSnapshot includes tenant panel filtered by operator tenant", () => {
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

test("buildSnapshot sorts incident timeline by createdAt descending", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: null, severity: "info" as const, summary: "First", createdAt: "2026-04-20T10:00:00.000Z" },
      { incidentId: "i-2", taskId: null, tenantId: null, severity: "critical" as const, summary: "Second", createdAt: "2026-04-24T10:00:00.000Z" },
      { incidentId: "i-3", taskId: null, tenantId: null, severity: "warning" as const, summary: "Third", createdAt: "2026-04-22T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-2");
  assert.equal(snapshot.incidentTimeline[1]?.incidentId, "i-3");
  assert.equal(snapshot.incidentTimeline[2]?.incidentId, "i-1");
});

test("buildSnapshot limits incident timeline to 50 items", () => {
  const incidents = Array.from({ length: 100 }, (_, i) => ({
    incidentId: `i-${i}`,
    taskId: null,
    tenantId: null,
    severity: "info" as const,
    summary: `Incident ${i}`,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));

  const service = new OperatorConsoleBackendService({
    listIncidents: () => incidents,
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.incidentTimeline.length <= 50);
});

test("buildSnapshot generates correct timestamp", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const before = new Date().toISOString();
  const snapshot = service.buildSnapshot(operator);
  const after = new Date().toISOString();

  assert.ok(snapshot.generatedAt >= before);
  assert.ok(snapshot.generatedAt <= after);
});

test("buildSnapshot includes offline worker with active executions in findings", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-1", status: "offline" as const, activeExecutionCount: 3, queueDepth: 0 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});

test("buildSnapshot includes critical incident in findings", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: null, severity: "critical" as const, summary: "Critical", createdAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});

test("buildSnapshot includes blocked tasks in findings", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "low" as const, updatedAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});

test("buildSnapshot filters tasks by tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2026-04-24T10:00:00.000Z" },
      { taskId: "t-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2026-04-24T10:00:00.000Z" },
      { taskId: "t-3", tenantId: null, workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 1);
  assert.equal(snapshot.taskBoard[0]?.taskId, "t-1");
});

test("buildSnapshot filters approvals by tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a-1", taskId: "t-1", tenantId: "tenant-a", riskLevel: "medium" as const, reason: "Test 1", createdAt: "2026-04-24T10:00:00.000Z" },
      { approvalId: "a-2", taskId: "t-2", tenantId: "tenant-b", riskLevel: "high" as const, reason: "Test 2", createdAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0]?.approvalId, "a-1");
});

test("buildSnapshot filters incidents by tenant scope", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: "tenant-a", severity: "warning" as const, summary: "Incident 1", createdAt: "2026-04-24T10:00:00.000Z" },
      { incidentId: "i-2", taskId: null, tenantId: "tenant-b", severity: "critical" as const, summary: "Incident 2", createdAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-1");
});

test("planHumanTakeoverAction sets correct auditPayload", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "retry_step",
    taskId: "t-123",
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

test("planHumanTakeoverAction with high-risk action requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "switch_worker",
    taskId: "t-123",
    operator,
    reasonCode: "rebalance",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
});

test("planHumanTakeoverAction with break-glass action requires break-glass if not authorized", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "skip_step",
    taskId: "t-123",
    operator,
    reasonCode: "debug",
  });

  assert.equal(plan.requiresBreakGlass, true);
});

test("planHumanTakeoverAction with break-glass action does not require break-glass if authorized", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator", "break_glass"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "skip_step",
    taskId: "t-123",
    operator,
    reasonCode: "debug",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction sets tenant and workspace IDs", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "t-123",
    tenantId: "tenant-x",
    workspaceId: "workspace-y",
    operator,
    reasonCode: "operator_override",
  });

  assert.equal(plan.tenantId, "tenant-x");
  assert.equal(plan.workspaceId, "workspace-y");
});

test("planHumanTakeoverAction handles null tenant and workspace", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "t-123",
    operator,
    reasonCode: "operator_override",
  });

  assert.equal(plan.tenantId, null);
  assert.equal(plan.workspaceId, null);
});

test("planHumanTakeoverAction uses operator operatorId", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-123", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "t-123",
    operator,
    reasonCode: "operator_override",
  });

  assert.equal(plan.operatorId, "op-123");
});

test("buildSnapshot handles queue_management with non-empty queue", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w-1", status: "online", activeExecutionCount: 0, queueDepth: 10 },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const queueModule = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.ok(queueModule);
  assert.equal(queueModule.status, "available");
});

test("buildSnapshot handles tenant_management with tenants", () => {
  const service = new OperatorConsoleBackendService({
    listTenants: () => [
      { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "strict" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
  assert.ok(tenantModule);
  assert.equal(tenantModule.status, "available");
});

test("buildSnapshot handles approval_management with approvals", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "low", reason: "Test", createdAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const approvalModule = snapshot.moduleCoverage.find((m) => m.moduleId === "approval_management");
  assert.ok(approvalModule);
  assert.equal(approvalModule.status, "available");
});

test("buildSnapshot handles incident_timeline with incidents", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i-1", taskId: null, tenantId: null, severity: "info", summary: "Test", createdAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const incidentModule = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.ok(incidentModule);
  assert.equal(incidentModule.status, "available");
});

test("buildSnapshot handles oapeflir_loop_management with tasks", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-24T10:00:00.000Z" },
    ],
  });
  const operator = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const loopModule = snapshot.moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
  assert.ok(loopModule);
  assert.equal(loopModule.status, "available");
});