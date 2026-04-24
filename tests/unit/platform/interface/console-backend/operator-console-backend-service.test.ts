import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService } from "../../../../src/platform/interface/console-backend/index.js";

function createMockSources() {
  return {
    listTasks: () => [
      { taskId: "task-001", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01T00:00:00Z" },
      { taskId: "task-002", tenantId: "tenant-a", workspaceId: null, status: "blocked", riskLevel: "high" as const, updatedAt: "2024-01-01T00:00:00Z" },
      { taskId: "task-003", tenantId: "tenant-b", workspaceId: null, status: "completed", riskLevel: "low" as const, updatedAt: "2024-01-01T00:00:00Z" },
    ],
    listPendingApprovals: () => [
      { approvalId: "appr-001", taskId: "task-001", tenantId: "tenant-a", riskLevel: "critical" as const, reason: "production write", createdAt: "2024-01-01T00:00:00Z" },
      { approvalId: "appr-002", taskId: "task-004", tenantId: "tenant-a", riskLevel: "low" as const, reason: "staging read", createdAt: "2024-01-01T00:00:00Z" },
    ],
    listWorkers: () => [
      { workerId: "worker-001", status: "online" as const, activeExecutionCount: 3, queueDepth: 10 },
      { workerId: "worker-002", status: "offline" as const, activeExecutionCount: 2, queueDepth: 5 },
    ],
    listIncidents: () => [
      { incidentId: "inc-001", taskId: "task-001", tenantId: "tenant-a", severity: "critical" as const, summary: "system failure", createdAt: "2024-01-01T00:00:00Z" },
      { incidentId: "inc-002", taskId: null, tenantId: null, severity: "info" as const, summary: "minor issue", createdAt: "2024-01-01T00:00:00Z" },
    ],
    listTenants: () => [
      { tenantId: "tenant-a", organizationId: "org-001", isolationMode: "standard" },
      { tenantId: "tenant-b", organizationId: "org-002", isolationMode: "strict" },
    ],
  };
}

test("OperatorConsoleBackendService buildSnapshot returns complete snapshot", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-001", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.operator.operatorId, "op-001");
  assert.ok(snapshot.generatedAt.length > 0);
  assert.ok(Array.isArray(snapshot.moduleCoverage));
  assert.ok(Array.isArray(snapshot.taskBoard));
  assert.ok(Array.isArray(snapshot.approvalQueue));
  assert.ok(Array.isArray(snapshot.workerPanel));
  assert.ok(Array.isArray(snapshot.tenantPanel));
  assert.ok(Array.isArray(snapshot.incidentTimeline));
  assert.ok(Array.isArray(snapshot.findings));
});

test("OperatorConsoleBackendService filters taskBoard by tenant scope", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-002", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
  assert.ok(snapshot.taskBoard.every((t) => t.tenantId === "tenant-a"));
});

test("OperatorConsoleBackendService includes all tasks when operator has no tenant scope", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-003", roles: ["admin"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 3);
});

test("OperatorConsoleBackendService filters approvalQueue by tenant scope", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-004", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.approvalQueue.length, 2);
  assert.ok(snapshot.approvalQueue.every((a) => a.tenantId === "tenant-a"));
});

test("OperatorConsoleBackendService returns all workers regardless of tenant scope", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-005", roles: ["operator"], tenantId: "tenant-a", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.workerPanel.length, 2);
});

test("OperatorConsoleBackendService filters tenantPanel by operator tenant", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-006", roles: ["operator"], tenantId: "tenant-b", workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 1);
  assert.equal(snapshot.tenantPanel[0].tenantId, "tenant-b");
});

test("OperatorConsoleBackendService limits incident timeline to 50 entries sorted by createdAt desc", () => {
  const manyIncidents = Array.from({ length: 60 }, (_, i) => ({
    incidentId: `inc-${i}`,
    taskId: null,
    tenantId: null,
    severity: "info" as const,
    summary: `incident ${i}`,
    createdAt: new Date(Date.now() - i * 1000).toISOString(),
  }));
  const service = new OperatorConsoleBackendService({
    listIncidents: () => manyIncidents,
    listTasks: () => [],
    listPendingApprovals: () => [],
    listWorkers: () => [],
    listTenants: () => [],
  });
  const operator = { operatorId: "op-007", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.incidentTimeline.length <= 50);
});

test("OperatorConsoleBackendService detects critical approval in findings", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-008", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
});

test("OperatorConsoleBackendService detects offline worker with active executions in findings", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-009", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});

test("OperatorConsoleBackendService detects critical incident in findings", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-010", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});

test("OperatorConsoleBackendService detects blocked tasks in findings", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-011", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});

test("OperatorConsoleBackendService planHumanTakeoverAction throws for empty taskId", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-012", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () => service.planHumanTakeoverAction({
      actionId: "action-001",
      actionType: "take_over_task",
      taskId: "   ",
      operator,
      reasonCode: "test",
    }),
    (err: any) => err.message.includes("task id"),
  );
});

test("OperatorConsoleBackendService planHumanTakeoverAction throws for empty reasonCode", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-013", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () => service.planHumanTakeoverAction({
      actionId: "action-002",
      actionType: "take_over_task",
      taskId: "task-001",
      operator,
      reasonCode: "   ",
    }),
    (err: any) => err.message.includes("reason code"),
  );
});

test("OperatorConsoleBackendService planHumanTakeoverAction throws for empty operatorId", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "   ", roles: ["operator"], tenantId: null, workspaceId: null };

  assert.throws(
    () => service.planHumanTakeoverAction({
      actionId: "action-003",
      actionType: "take_over_task",
      taskId: "task-001",
      operator,
      reasonCode: "test",
    }),
    (err: any) => err.message.includes("operator id"),
  );
});

test("OperatorConsoleBackendService planHumanTakeoverAction for high-risk action requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-014", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-004",
    actionType: "switch_worker",
    taskId: "task-001",
    operator,
    reasonCode: "worker unavailable",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.taskId, "task-001");
  assert.equal(plan.actionType, "switch_worker");
});

test("OperatorConsoleBackendService planHumanTakeoverAction for break-glass action without role requires break glass", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-015", roles: ["operator"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-005",
    actionType: "skip_step",
    taskId: "task-002",
    operator,
    reasonCode: "retry needed",
  });

  assert.equal(plan.requiresBreakGlass, true);
});

test("OperatorConsoleBackendService planHumanTakeoverAction for break-glass action with role does not require break glass", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-016", roles: ["operator", "break_glass"], tenantId: null, workspaceId: null };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-006",
    actionType: "skip_step",
    taskId: "task-003",
    operator,
    reasonCode: "retry needed",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("OperatorConsoleBackendService planHumanTakeoverAction includes audit payload", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-017", roles: ["operator"], tenantId: "tenant-a", workspaceId: "ws-001" };

  const plan = service.planHumanTakeoverAction({
    actionId: "action-007",
    actionType: "retry_step",
    taskId: "task-004",
    tenantId: "tenant-a",
    workspaceId: "ws-001",
    operator,
    reasonCode: "step failed",
    beforeStateRef: "step-5",
    afterStateRef: "step-6",
  });

  assert.deepEqual(plan.auditPayload, {
    actionType: "retry_step",
    reasonCode: "step failed",
    beforeStateRef: "step-5",
    afterStateRef: "step-6",
  });
  assert.equal(plan.tenantId, "tenant-a");
  assert.equal(plan.workspaceId, "ws-001");
  assert.equal(plan.operatorId, "op-017");
});

test("OperatorConsoleBackendService works with empty sources", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op-018", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 0);
  assert.equal(snapshot.approvalQueue.length, 0);
  assert.equal(snapshot.workerPanel.length, 0);
  assert.equal(snapshot.tenantPanel.length, 0);
  assert.equal(snapshot.incidentTimeline.length, 0);
});

test("OperatorConsoleBackendService builds module coverage correctly", () => {
  const service = new OperatorConsoleBackendService(createMockSources());
  const operator = { operatorId: "op-019", roles: ["operator"], tenantId: null, workspaceId: null };

  const snapshot = service.buildSnapshot(operator);

  const workerMgmt = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.ok(workerMgmt);
  assert.equal(workerMgmt.status, "available");

  const incidentTimeline = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.ok(incidentTimeline);
  assert.equal(incidentTimeline.status, "available");
});