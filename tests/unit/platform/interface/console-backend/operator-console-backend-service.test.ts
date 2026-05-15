import assert from "node:assert/strict";
import test from "node:test";

import { OperatorConsoleBackendService } from "../../../../../src/platform/five-plane-interface/console-backend/index.js";

test("OperatorConsoleBackendService buildSnapshot with empty sources", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer"] };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.operator.operatorId, "op1");
  assert.equal(snapshot.generatedAt.length > 0, true);
  assert.deepEqual(snapshot.taskBoard, []);
  assert.deepEqual(snapshot.approvalQueue, []);
  assert.deepEqual(snapshot.workerPanel, []);
  assert.deepEqual(snapshot.tenantPanel, []);
  assert.deepEqual(snapshot.incidentTimeline, []);
  assert.deepEqual(snapshot.findings, []);
});

test("OperatorConsoleBackendService buildSnapshot with populated sources", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: "tenant1", workspaceId: "ws1", status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
      { taskId: "t2", tenantId: "tenant1", workspaceId: "ws1", status: "blocked", riskLevel: "medium" as const, updatedAt: "2024-01-02" },
    ],
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: "tenant1", riskLevel: "low" as const, reason: "test", createdAt: "2024-01-01" },
    ],
    listWorkers: () => [
      { workerId: "w1", status: "online" as const, activeExecutionCount: 2, queueDepth: 5 },
      { workerId: "w2", status: "offline" as const, activeExecutionCount: 1, queueDepth: 0 },
    ],
    listIncidents: () => [
      { incidentId: "i1", taskId: "t1", tenantId: "tenant1", severity: "warning" as const, summary: "test", createdAt: "2024-01-01" },
    ],
  });

  const operator = { operatorId: "op1", roles: ["viewer"], tenantId: "tenant1" };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.workerPanel.length, 2);
  assert.equal(snapshot.incidentTimeline.length, 1);
  // Findings should include "blocked tasks exist" since task t2 is blocked
  assert.ok(snapshot.findings.some((f) => f.includes("blocked")));
});

test("OperatorConsoleBackendService buildSnapshot filters by tenant", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: "tenant1", workspaceId: "ws1", status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
      { taskId: "t2", tenantId: "tenant2", workspaceId: "ws1", status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    ],
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: "tenant1", riskLevel: "low" as const, reason: "test", createdAt: "2024-01-01" },
      { approvalId: "a2", taskId: "t2", tenantId: "tenant2", riskLevel: "low" as const, reason: "test", createdAt: "2024-01-01" },
    ],
    listIncidents: () => [
      { incidentId: "i1", taskId: "t1", tenantId: "tenant1", severity: "warning" as const, summary: "test", createdAt: "2024-01-01" },
      { incidentId: "i2", taskId: "t2", tenantId: "tenant2", severity: "warning" as const, summary: "test", createdAt: "2024-01-01" },
    ],
  });

  const operator = { operatorId: "op1", roles: ["viewer"], tenantId: "tenant1" };
  const snapshot = service.buildSnapshot(operator);

  // Only tenant1 data should appear
  assert.equal(snapshot.taskBoard.length, 1);
  assert.equal(snapshot.taskBoard[0].taskId, "t1");
  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0].approvalId, "a1");
  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.equal(snapshot.incidentTimeline[0].incidentId, "i1");
});

test("OperatorConsoleBackendService buildSnapshot with no tenant filter", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: "tenant1", workspaceId: "ws1", status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
      { taskId: "t2", tenantId: "tenant2", workspaceId: "ws1", status: "running", riskLevel: "low" as const, updatedAt: "2024-01-01" },
    ],
  });

  const operator = { operatorId: "op1", roles: ["admin"] }; // no tenantId
  const snapshot = service.buildSnapshot(operator);

  // All tasks should appear when no tenant filter
  assert.equal(snapshot.taskBoard.length, 2);
});

test("OperatorConsoleBackendService buildSnapshot detects critical findings", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: null, riskLevel: "critical" as const, reason: "test", createdAt: "2024-01-01" },
    ],
  });

  const snapshot = service.buildSnapshot({ operatorId: "op1", roles: ["viewer"] });
  assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
});

test("OperatorConsoleBackendService buildSnapshot detects offline worker with executions", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w1", status: "offline" as const, activeExecutionCount: 3, queueDepth: 0 },
    ],
  });

  const snapshot = service.buildSnapshot({ operatorId: "op1", roles: ["viewer"] });
  assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});

test("OperatorConsoleBackendService buildSnapshot detects critical incidents", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i1", taskId: null, tenantId: null, severity: "critical" as const, summary: "outage", createdAt: "2024-01-01" },
    ],
  });

  const snapshot = service.buildSnapshot({ operatorId: "op1", roles: ["viewer"] });
  assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});

test("OperatorConsoleBackendService buildSnapshot builds moduleCoverage correctly", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w1", status: "online" as const, activeExecutionCount: 2, queueDepth: 5 },
    ],
  });

  const snapshot = service.buildSnapshot({ operatorId: "op1", roles: ["viewer"] });

  // worker_management should be available (worker exists)
  const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.equal(workerModule?.status, "available");

  // queue_management should be available (queueDepth > 0)
  const queueModule = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.equal(queueModule?.status, "available");

  // tenant_management should be empty (no tenants)
  const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
  assert.equal(tenantModule?.status, "empty");
});

test("OperatorConsoleBackendService planHumanTakeoverAction creates valid action plan", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer"], tenantId: "tenant1" };

  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "retry_step",
    taskId: "task123",
    operator,
    reasonCode: "user_requested",
  });

  assert.equal(plan.actionId, "action1");
  assert.equal(plan.actionType, "retry_step");
  assert.equal(plan.taskId, "task123");
  assert.equal(plan.operatorId, "op1");
  assert.equal(plan.tenantId, "tenant1");
  assert.equal(plan.requiresPolicyEvaluation, false);
  assert.equal(plan.requiresBreakGlass, false);
});

test("OperatorConsoleBackendService planHumanTakeoverAction high-risk action requires policy evaluation", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer"], tenantId: "tenant1" };

  // skip_step is in HIGH_RISK_ACTIONS and BREAK_GLASS_ACTIONS
  // without break_glass role, both flags are true
  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "skip_step",
    taskId: "task123",
    operator,
    reasonCode: "user_requested",
  });

  assert.equal(plan.requiresPolicyEvaluation, true);
  assert.equal(plan.requiresBreakGlass, true);
});

test("OperatorConsoleBackendService planHumanTakeoverAction break-glass action requires break glass role", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer"] }; // no break_glass role

  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "skip_step",
    taskId: "task123",
    operator,
    reasonCode: "user_requested",
  });

  assert.equal(plan.requiresBreakGlass, true);
  assert.equal(plan.requiresPolicyEvaluation, true); // also high risk
});

test("OperatorConsoleBackendService planHumanTakeoverAction with break_glass role skips break-glass check", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer", "break_glass"] };

  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "skip_step",
    taskId: "task123",
    operator,
    reasonCode: "user_requested",
  });

  assert.equal(plan.requiresBreakGlass, false);
  assert.equal(plan.requiresPolicyEvaluation, true);
});

test("OperatorConsoleBackendService planHumanTakeoverAction auditPayload is populated", () => {
  const service = new OperatorConsoleBackendService({});

  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "retry_step",
    taskId: "task123",
    operator: { operatorId: "op1", roles: ["viewer"] },
    reasonCode: "user_requested",
    beforeStateRef: "state_before",
    afterStateRef: "state_after",
  });

  assert.equal(plan.auditPayload.actionType, "retry_step");
  assert.equal(plan.auditPayload.reasonCode, "user_requested");
  assert.equal(plan.auditPayload.beforeStateRef, "state_before");
  assert.equal(plan.auditPayload.afterStateRef, "state_after");
});

test("OperatorConsoleBackendService planHumanTakeoverAction rejects empty operator", () => {
  const service = new OperatorConsoleBackendService({});

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action1",
        actionType: "retry_step",
        taskId: "task123",
        operator: { operatorId: "", roles: ["viewer"] },
        reasonCode: "user_requested",
      }),
    (err: unknown) => (err as Error).message.includes("Operator id is required"),
  );
});

test("OperatorConsoleBackendService planHumanTakeoverAction rejects empty taskId", () => {
  const service = new OperatorConsoleBackendService({});

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action1",
        actionType: "retry_step",
        taskId: "   ",
        operator: { operatorId: "op1", roles: ["viewer"] },
        reasonCode: "user_requested",
      }),
    (err: unknown) => (err as Error).message.includes("task id"),
  );
});

test("OperatorConsoleBackendService planHumanTakeoverAction rejects empty reasonCode", () => {
  const service = new OperatorConsoleBackendService({});

  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action1",
        actionType: "retry_step",
        taskId: "task123",
        operator: { operatorId: "op1", roles: ["viewer"] },
        reasonCode: "   ",
      }),
    (err: unknown) => (err as Error).message.includes("reason code"),
  );
});

test("OperatorConsoleBackendService buildSnapshot incidentTimeline limited to 50 sorted by createdAt", () => {
  const incidents = Array.from({ length: 60 }, (_, i) => ({
    incidentId: `i${i}`,
    taskId: null,
    tenantId: null,
    severity: "info" as const,
    summary: "test",
    createdAt: new Date(2024, 0, i + 1).toISOString(),
  }));

  const service = new OperatorConsoleBackendService({
    listIncidents: () => incidents,
  });

  const snapshot = service.buildSnapshot({ operatorId: "op1", roles: ["viewer"] });

  assert.equal(snapshot.incidentTimeline.length, 50);
  // Should be sorted by createdAt descending (newest first)
  assert.ok(snapshot.incidentTimeline[0].createdAt > snapshot.incidentTimeline[49].createdAt);
});

test("OperatorConsoleBackendService buildSnapshot preserves operator workspaceId", () => {
  const service = new OperatorConsoleBackendService({});
  const operator = { operatorId: "op1", roles: ["viewer"], workspaceId: "workspace123" };

  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.operator.workspaceId, "workspace123");
});

test("OperatorConsoleBackendService planHumanTakeoverAction preserves workspaceId", () => {
  const service = new OperatorConsoleBackendService({});

  const plan = service.planHumanTakeoverAction({
    actionId: "action1",
    actionType: "retry_step",
    taskId: "task123",
    operator: { operatorId: "op1", roles: ["viewer"], workspaceId: "ws1" },
    reasonCode: "user_requested",
  });

  assert.equal(plan.workspaceId, "ws1");
});