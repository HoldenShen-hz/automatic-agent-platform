import assert from "node:assert/strict";
import test from "node:test";

import {
  OperatorConsoleBackendService,
  type ConsoleModuleId,
  type OperatorIdentity,
  type ConsoleTaskSummary,
} from "../../../../../src/platform/interface/console-backend/index.js";

test("OperatorConsoleBackendService is instantiable", () => {
  const service = new OperatorConsoleBackendService();
  assert.ok(service);
});

test("buildSnapshot with empty sources returns valid structure", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["admin"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.equal(snapshot.operator.operatorId, "op-1");
  assert.equal(snapshot.generatedAt.length > 0, true);
  assert.ok(Array.isArray(snapshot.moduleCoverage));
  assert.ok(Array.isArray(snapshot.taskBoard));
  assert.ok(Array.isArray(snapshot.approvalQueue));
  assert.ok(Array.isArray(snapshot.workerPanel));
  assert.ok(Array.isArray(snapshot.incidentTimeline));
  assert.ok(Array.isArray(snapshot.findings));
});

test("buildSnapshot uses operator roles from input", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-2", roles: ["operator", "admin"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.deepEqual(snapshot.operator.roles, ["operator", "admin"]);
});

test("buildSnapshot with empty taskBoard has no findings", () => {
  const service = new OperatorConsoleBackendService({ listTasks: () => [] });
  const operator: OperatorIdentity = { operatorId: "op-3", roles: ["operator"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.equal(snapshot.taskBoard.length, 0);
  assert.ok(snapshot.findings.length === 0);
});

test("buildSnapshot filters taskBoard by tenantId scope", () => {
  const tasks: ConsoleTaskSummary[] = [
    { taskId: "t-1", tenantId: "tenant-A", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2024-01-01" },
    { taskId: "t-2", tenantId: "tenant-B", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2024-01-01" },
    { taskId: "t-3", tenantId: "tenant-A", workspaceId: null, status: "completed", riskLevel: "medium", updatedAt: "2024-01-01" },
  ];
  const service = new OperatorConsoleBackendService({ listTasks: () => tasks });
  const operator: OperatorIdentity = { operatorId: "op-scope", roles: ["operator"], tenantId: "tenant-A", workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.equal(snapshot.taskBoard.length, 2);
  assert.ok(snapshot.taskBoard.every((t) => t.tenantId === "tenant-A"));
});

test("planHumanTakeoverAction throws if operator id is empty", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "", roles: ["operator"], tenantId: null, workspaceId: null };
  assert.throws(
    () => service.planHumanTakeoverAction({ actionId: "a1", actionType: "take_over_task", taskId: "t1", operator, reasonCode: "x" }),
    /Operator id is required/,
  );
});

test("planHumanTakeoverAction throws if taskId is whitespace", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  assert.throws(
    () => service.planHumanTakeoverAction({ actionId: "a1", actionType: "take_over_task", taskId: "  ", operator, reasonCode: "x" }),
    /task id/,
  );
});

test("planHumanTakeoverAction throws if reasonCode is empty", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  assert.throws(
    () => service.planHumanTakeoverAction({ actionId: "a1", actionType: "take_over_task", taskId: "t1", operator, reasonCode: "" }),
    /reason code/,
  );
});

test("planHumanTakeoverAction returns correct action plan structure", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const plan = service.planHumanTakeoverAction({
    actionId: "action-123",
    actionType: "retry_step",
    taskId: "task-456",
    operator,
    reasonCode: "user_requested",
  });
  assert.equal(plan.actionId, "action-123");
  assert.equal(plan.actionType, "retry_step");
  assert.equal(plan.taskId, "task-456");
  assert.equal(plan.operatorId, "op-1");
  assert.ok(typeof plan.requiresPolicyEvaluation === "boolean");
  assert.ok(typeof plan.requiresBreakGlass === "boolean");
});

test("planHumanTakeoverAction requires break glass for skip_step without role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const plan = service.planHumanTakeoverAction({
    actionId: "a1",
    actionType: "skip_step",
    taskId: "t1",
    operator,
    reasonCode: "debug",
  });
  assert.equal(plan.requiresBreakGlass, true);
});

test("planHumanTakeoverAction does not require break glass when operator has break_glass role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator", "break_glass"], tenantId: null, workspaceId: null };
  const plan = service.planHumanTakeoverAction({
    actionId: "a1",
    actionType: "skip_step",
    taskId: "t1",
    operator,
    reasonCode: "debug",
  });
  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction requires policy evaluation for high-risk actions", () => {
  const service = new OperatorConsoleBackendService({});
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const highRiskActions: Array<{ actionType: Parameters<typeof service.planHumanTakeoverAction>[0]["actionType"] }> = [
    { actionType: "skip_step" },
    { actionType: "switch_worker" },
    { actionType: "attach_artifact" },
    { actionType: "advance_rollout" },
    { actionType: "rollback_rollout" },
    { actionType: "finish_task" },
  ];
  for (const { actionType } of highRiskActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: "a1",
      actionType,
      taskId: "t1",
      operator,
      reasonCode: "test",
    });
    assert.equal(plan.requiresPolicyEvaluation, true, `Action ${actionType} should require policy evaluation`);
  }
});

test("buildSnapshot includes offline worker with active executions in findings", () => {
  const workers = [
    { workerId: "w-1", status: "offline" as const, activeExecutionCount: 2, queueDepth: 0 },
    { workerId: "w-2", status: "online" as const, activeExecutionCount: 0, queueDepth: 0 },
  ];
  const service = new OperatorConsoleBackendService({ listWorkers: () => workers });
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});

test("buildSnapshot includes critical incidents in findings", () => {
  const incidents = [
    {
      incidentId: "inc-1",
      taskId: null,
      tenantId: null,
      severity: "critical" as const,
      summary: "system failure",
      createdAt: "2024-01-01",
    },
  ];
  const service = new OperatorConsoleBackendService({ listIncidents: () => incidents });
  const operator: OperatorIdentity = { operatorId: "op-1", roles: ["operator"], tenantId: null, workspaceId: null };
  const snapshot = service.buildSnapshot(operator);
  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});