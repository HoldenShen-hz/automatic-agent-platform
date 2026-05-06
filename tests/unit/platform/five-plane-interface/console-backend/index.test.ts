import { strict as assert } from "node:assert";
import { test } from "node:test";
import { OperatorConsoleBackendService } from "../../../../../src/platform/five-plane-interface/console-backend/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

const now = "2026-05-01T00:00:00.000Z";

test("OperatorConsoleBackendService constructor accepts empty sources", () => {
  const service = new OperatorConsoleBackendService({});
  assert.ok(service instanceof OperatorConsoleBackendService);
});

test("OperatorConsoleBackendService buildSnapshot returns OperatorConsoleSnapshot", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [],
    listPendingApprovals: () => [],
    listWorkers: () => [],
    listIncidents: () => [],
    listTenants: () => [],
  });
  const operator = { operatorId: "op-1", roles: ["viewer"] };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.operator, operator);
  assert.ok(Array.isArray(snapshot.moduleCoverage));
  assert.ok(Array.isArray(snapshot.taskBoard));
  assert.ok(Array.isArray(snapshot.approvalQueue));
  assert.ok(Array.isArray(snapshot.workerPanel));
  assert.ok(Array.isArray(snapshot.tenantPanel));
  assert.ok(Array.isArray(snapshot.incidentTimeline));
  assert.ok(Array.isArray(snapshot.findings));
});

test("buildSnapshot throws ValidationError when operatorId is empty", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(
    () => service.buildSnapshot({ operatorId: "", roles: [] }),
    (err: unknown) => err instanceof ValidationError && err.code === "console.operator_id_required",
  );
});

test("buildSnapshot throws ValidationError when operatorId is whitespace", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(
    () => service.buildSnapshot({ operatorId: "   ", roles: [] }),
    (err: unknown) => err instanceof ValidationError && err.code === "console.operator_id_required",
  );
});

test("buildSnapshot filters tasks by tenantId when operator has tenantId", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: "tenant-1", workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
      { taskId: "t2", tenantId: "tenant-2", workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
      { taskId: "t3", tenantId: "tenant-1", workspaceId: null, status: "blocked", riskLevel: "medium", updatedAt: now },
    ],
  });
  const operator = { operatorId: "op-1", roles: [], tenantId: "tenant-1" };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
  assert.ok(snapshot.taskBoard.every((t) => t.tenantId === "tenant-1"));
});

test("buildSnapshot does not filter tasks when operator has no tenantId", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: "tenant-1", workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
      { taskId: "t2", tenantId: "tenant-2", workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
    ],
  });
  const operator = { operatorId: "op-1", roles: [] };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.taskBoard.length, 2);
});

test("buildSnapshot filters approvals by tenantId when operator has tenantId", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: "tenant-1", riskLevel: "high", reason: "test", createdAt: now },
      { approvalId: "a2", taskId: "t2", tenantId: "tenant-2", riskLevel: "critical", reason: "test", createdAt: now },
    ],
  });
  const operator = { operatorId: "op-1", roles: [], tenantId: "tenant-1" };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.approvalQueue.length, 1);
  assert.equal(snapshot.approvalQueue[0].approvalId, "a1");
});

test("buildSnapshot filters incidents by tenantId when operator has tenantId", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i1", taskId: "t1", tenantId: "tenant-1", severity: "critical", summary: "test", createdAt: now },
      { incidentId: "i2", taskId: "t2", tenantId: "tenant-2", severity: "warning", summary: "test", createdAt: now },
    ],
  });
  const operator = { operatorId: "op-1", roles: [], tenantId: "tenant-1" };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.incidentTimeline.length, 1);
  assert.equal(snapshot.incidentTimeline[0].incidentId, "i1");
});

test("buildSnapshot sorts incidents by createdAt descending and limits to 50", () => {
  const incidents = Array.from({ length: 60 }, (_, i) => ({
    incidentId: `i${i}`,
    taskId: null,
    tenantId: null,
    severity: "info" as const,
    summary: `incident-${i}`,
    createdAt: new Date(i * 1000).toISOString(),
  }));

  const service = new OperatorConsoleBackendService({
    listIncidents: () => incidents,
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.equal(snapshot.incidentTimeline.length, 50);
  assert.equal(snapshot.incidentTimeline[0].incidentId, "i59");
  assert.equal(snapshot.incidentTimeline[49].incidentId, "i10");
});

test("buildSnapshot filters tenants by operator tenantId", () => {
  const service = new OperatorConsoleBackendService({
    listTenants: () => [
      { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "shared" },
      { tenantId: "tenant-2", organizationId: "org-2", isolationMode: "isolated" },
    ],
  });
  const operator = { operatorId: "op-1", roles: [], tenantId: "tenant-1" };
  const snapshot = service.buildSnapshot(operator);

  assert.equal(snapshot.tenantPanel.length, 1);
  assert.equal(snapshot.tenantPanel[0].tenantId, "tenant-1");
});

test("buildSnapshot builds moduleCoverage correctly for worker_management", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [{ workerId: "w1", status: "online", activeExecutionCount: 0, queueDepth: 0 }],
    listTenants: () => [],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const workerMod = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.equal(workerMod?.status, "available");
});

test("buildSnapshot builds moduleCoverage correctly when worker panel is empty", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [],
    listTenants: () => [],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const workerMod = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
  assert.equal(workerMod?.status, "empty");
});

test("buildSnapshot builds moduleCoverage correctly for queue_management when queue has depth", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [{ workerId: "w1", status: "online", activeExecutionCount: 0, queueDepth: 5 }],
    listTenants: () => [],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const queueMod = snapshot.moduleCoverage.find((m) => m.moduleId === "queue_management");
  assert.equal(queueMod?.status, "available");
});

test("buildSnapshot builds moduleCoverage correctly for approval_management when approvals exist", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: null, riskLevel: "low", reason: "test", createdAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const approvalMod = snapshot.moduleCoverage.find((m) => m.moduleId === "approval_management");
  assert.equal(approvalMod?.status, "available");
});

test("buildSnapshot builds moduleCoverage correctly for incident_timeline when incidents exist", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i1", taskId: null, tenantId: null, severity: "warning", summary: "test", createdAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const incidentMod = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
  assert.equal(incidentMod?.status, "available");
});

test("buildSnapshot builds moduleCoverage correctly for oapeflir_loop_management when tasks exist", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });
  const oapeflirMod = snapshot.moduleCoverage.find((m) => m.moduleId === "oapeflir_loop_management");
  assert.equal(oapeflirMod?.status, "available");
});

test("buildSnapshot generates finding for critical approval", () => {
  const service = new OperatorConsoleBackendService({
    listPendingApprovals: () => [
      { approvalId: "a1", taskId: "t1", tenantId: null, riskLevel: "critical", reason: "test", createdAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.ok(snapshot.findings.includes("critical approval waiting for operator decision"));
});

test("buildSnapshot generates finding for offline worker with active executions", () => {
  const service = new OperatorConsoleBackendService({
    listWorkers: () => [
      { workerId: "w1", status: "offline", activeExecutionCount: 3, queueDepth: 0 },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.ok(snapshot.findings.includes("offline worker still owns active executions"));
});

test("buildSnapshot generates finding for critical incident", () => {
  const service = new OperatorConsoleBackendService({
    listIncidents: () => [
      { incidentId: "i1", taskId: null, tenantId: null, severity: "critical", summary: "test", createdAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.ok(snapshot.findings.includes("critical incident requires takeover review"));
});

test("buildSnapshot generates finding for blocked tasks", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "medium", updatedAt: now },
    ],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.ok(snapshot.findings.includes("blocked tasks exist in operator scope"));
});

test("buildSnapshot does not generate findings when no issues exist", () => {
  const service = new OperatorConsoleBackendService({
    listTasks: () => [
      { taskId: "t1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: now },
    ],
    listPendingApprovals: () => [],
    listWorkers: () => [{ workerId: "w1", status: "online", activeExecutionCount: 0, queueDepth: 0 }],
    listIncidents: () => [],
  });
  const snapshot = service.buildSnapshot({ operatorId: "op-1", roles: [] });

  assert.equal(snapshot.findings.length, 0);
});

test("planHumanTakeoverAction creates action plan with valid input", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-1",
    operator: { operatorId: "op-1", roles: ["operator"] },
    reasonCode: "R1",
  });

  assert.equal(plan.actionId, "action-1");
  assert.equal(plan.actionType, "take_over_task");
  assert.equal(plan.taskId, "task-1");
  assert.equal(plan.operatorId, "op-1");
  assert.equal(plan.requiresBreakGlass, false);
  assert.equal(plan.requiresPolicyEvaluation, false);
});

test("planHumanTakeoverAction throws ValidationError when taskId is empty", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "",
        operator: { operatorId: "op-1", roles: [] },
        reasonCode: "R1",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "console.task_id_required",
  );
});

test("planHumanTakeoverAction throws ValidationError when reasonCode is empty", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "task-1",
        operator: { operatorId: "op-1", roles: [] },
        reasonCode: "",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "console.reason_required",
  );
});

test("planHumanTakeoverAction throws ValidationError when operatorId is empty", () => {
  const service = new OperatorConsoleBackendService({});
  assert.throws(
    () =>
      service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "task-1",
        operator: { operatorId: "", roles: [] },
        reasonCode: "R1",
      }),
    (err: unknown) => err instanceof ValidationError && err.code === "console.operator_id_required",
  );
});

test("planHumanTakeoverAction requires policy evaluation for high risk actions", () => {
  const service = new OperatorConsoleBackendService({});
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
      actionId: "action-1",
      actionType,
      taskId: "task-1",
      operator: { operatorId: "op-1", roles: [] },
      reasonCode: "R1",
    });
    assert.equal(plan.requiresPolicyEvaluation, true, `${actionType} should require policy evaluation`);
  }
});

test("planHumanTakeoverAction requires break glass for break glass actions without role", () => {
  const service = new OperatorConsoleBackendService({});
  const breakGlassActions: Array<{ actionType: Parameters<typeof service.planHumanTakeoverAction>[0]["actionType"] }> = [
    { actionType: "skip_step" },
    { actionType: "switch_worker" },
    { actionType: "finish_task" },
    { actionType: "rollback_rollout" },
  ];

  for (const { actionType } of breakGlassActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: "action-1",
      actionType,
      taskId: "task-1",
      operator: { operatorId: "op-1", roles: [] },
      reasonCode: "R1",
    });
    assert.equal(plan.requiresBreakGlass, true, `${actionType} should require break glass`);
  }
});

test("planHumanTakeoverAction does not require break glass when operator has break_glass role", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "skip_step",
    taskId: "task-1",
    operator: { operatorId: "op-1", roles: ["break_glass"] },
    reasonCode: "R1",
  });

  assert.equal(plan.requiresBreakGlass, false);
});

test("planHumanTakeoverAction uses operator tenantId when tenantId not provided", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-1",
    operator: { operatorId: "op-1", roles: [], tenantId: "my-tenant" },
    reasonCode: "R1",
  });

  assert.equal(plan.tenantId, "my-tenant");
});

test("planHumanTakeoverAction uses provided tenantId over operator tenantId", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-1",
    tenantId: "other-tenant",
    operator: { operatorId: "op-1", roles: [], tenantId: "my-tenant" },
    reasonCode: "R1",
  });

  assert.equal(plan.tenantId, "other-tenant");
});

test("planHumanTakeoverAction uses operator workspaceId when workspaceId not provided", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "take_over_task",
    taskId: "task-1",
    operator: { operatorId: "op-1", roles: [], workspaceId: "my-workspace" },
    reasonCode: "R1",
  });

  assert.equal(plan.workspaceId, "my-workspace");
});

test("planHumanTakeoverAction includes beforeStateRef and afterStateRef in auditPayload", () => {
  const service = new OperatorConsoleBackendService({});
  const plan = service.planHumanTakeoverAction({
    actionId: "action-1",
    actionType: "modify_next_input",
    taskId: "task-1",
    operator: { operatorId: "op-1", roles: [] },
    reasonCode: "R1",
    beforeStateRef: "state-before",
    afterStateRef: "state-after",
  });

  assert.equal(plan.auditPayload.beforeStateRef, "state-before");
  assert.equal(plan.auditPayload.afterStateRef, "state-after");
  assert.equal(plan.auditPayload.reasonCode, "R1");
  assert.equal(plan.auditPayload.actionType, "modify_next_input");
});

test("planHumanTakeoverAction includes low risk actions in auditPayload", () => {
  const service = new OperatorConsoleBackendService({});
  const lowRiskActions: Array<{ actionType: Parameters<typeof service.planHumanTakeoverAction>[0]["actionType"] }> = [
    { actionType: "take_over_task" },
    { actionType: "modify_next_input" },
    { actionType: "retry_step" },
    { actionType: "switch_model" },
    { actionType: "attach_artifact" },
    { actionType: "inject_feedback" },
    { actionType: "create_improvement_candidate" },
    { actionType: "advance_rollout" },
  ];

  for (const { actionType } of lowRiskActions) {
    const plan = service.planHumanTakeoverAction({
      actionId: "action-1",
      actionType,
      taskId: "task-1",
      operator: { operatorId: "op-1", roles: [] },
      reasonCode: "R1",
    });
    assert.equal(plan.requiresPolicyEvaluation, false, `${actionType} should not require policy evaluation`);
  }
});
