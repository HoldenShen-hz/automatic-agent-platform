import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService, } from "../../../../../src/platform/interface/console-backend/index.js";
function makeOperator(overrides = {}) {
    return {
        operatorId: "op_001",
        roles: ["operator"],
        tenantId: null,
        workspaceId: null,
        ...overrides,
    };
}
function makeTaskBoard(overrides = []) {
    return overrides.map((t, i) => ({
        taskId: `task_${i}`,
        tenantId: null,
        workspaceId: null,
        status: "running",
        riskLevel: "low",
        updatedAt: "2026-04-20T10:00:00.000Z",
        ...t,
    }));
}
function makeApprovalQueue(overrides = []) {
    return overrides.map((a, i) => ({
        approvalId: `approval_${i}`,
        taskId: `task_${i}`,
        tenantId: null,
        riskLevel: "low",
        reason: "approval required",
        createdAt: "2026-04-20T10:00:00.000Z",
        ...a,
    }));
}
function makeWorkerPanel(overrides = []) {
    return overrides.map((w, i) => ({
        workerId: `worker_${i}`,
        status: "online",
        activeExecutionCount: 0,
        queueDepth: 0,
        ...w,
    }));
}
function makeIncidentTimeline(overrides = []) {
    return overrides.map((inc, i) => ({
        incidentId: `incident_${i}`,
        taskId: null,
        tenantId: null,
        severity: "info",
        summary: "incident summary",
        createdAt: "2026-04-20T10:00:00.000Z",
        ...inc,
    }));
}
test("buildSnapshot returns snapshot with all panels populated", () => {
    const service = new OperatorConsoleBackendService({
        listTasks: () => makeTaskBoard([{ taskId: "task_1" }]),
        listPendingApprovals: () => makeApprovalQueue([{ approvalId: "approval_1" }]),
        listWorkers: () => makeWorkerPanel([{ workerId: "worker_1" }]),
        listIncidents: () => makeIncidentTimeline([{ incidentId: "incident_1" }]),
        listTenants: () => [{ tenantId: "tenant_1", organizationId: "org_1", isolationMode: "shared" }],
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.equal(typeof snapshot.generatedAt, "string");
    assert.equal(snapshot.operator.operatorId, "op_001");
    assert.equal(snapshot.taskBoard.length, 1);
    assert.equal(snapshot.approvalQueue.length, 1);
    assert.equal(snapshot.workerPanel.length, 1);
    assert.equal(snapshot.incidentTimeline.length, 1);
    assert.equal(snapshot.tenantPanel.length, 1);
    assert.ok(Array.isArray(snapshot.moduleCoverage));
    assert.ok(Array.isArray(snapshot.findings));
});
test("buildSnapshot filters task board by tenant scope", () => {
    const service = new OperatorConsoleBackendService({
        listTasks: () => makeTaskBoard([{ taskId: "task_1", tenantId: "tenant_a" }, { taskId: "task_2", tenantId: "tenant_b" }]),
    });
    const operator = makeOperator({ tenantId: "tenant_a" });
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.taskBoard.length, 1);
    assert.equal(snapshot.taskBoard[0].taskId, "task_1");
});
test("buildSnapshot returns empty arrays when no data sources provided", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.deepEqual(snapshot.taskBoard, []);
    assert.deepEqual(snapshot.approvalQueue, []);
    assert.deepEqual(snapshot.workerPanel, []);
    assert.deepEqual(snapshot.incidentTimeline, []);
    assert.deepEqual(snapshot.tenantPanel, []);
});
test("buildSnapshot sets moduleCoverage to available when data exists", () => {
    const service = new OperatorConsoleBackendService({
        listWorkers: () => makeWorkerPanel([{ workerId: "worker_1" }]),
        listTenants: () => [{ tenantId: "tenant_1", organizationId: "org_1", isolationMode: "shared" }],
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
    assert.equal(workerModule?.status, "available");
    const tenantModule = snapshot.moduleCoverage.find((m) => m.moduleId === "tenant_management");
    assert.equal(tenantModule?.status, "available");
});
test("buildSnapshot sets moduleCoverage to empty when no data exists", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    const workerModule = snapshot.moduleCoverage.find((m) => m.moduleId === "worker_management");
    assert.equal(workerModule?.status, "empty");
    const incidentModule = snapshot.moduleCoverage.find((m) => m.moduleId === "incident_timeline");
    assert.equal(incidentModule?.status, "empty");
});
test("buildSnapshot includes critical approval finding", () => {
    const service = new OperatorConsoleBackendService({
        listPendingApprovals: () => makeApprovalQueue([{ riskLevel: "critical" }]),
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
});
test("buildSnapshot includes offline worker finding", () => {
    const service = new OperatorConsoleBackendService({
        listWorkers: () => makeWorkerPanel([{ workerId: "worker_1", status: "offline", activeExecutionCount: 1 }]),
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("offline worker")));
});
test("buildSnapshot includes critical incident finding", () => {
    const service = new OperatorConsoleBackendService({
        listIncidents: () => makeIncidentTimeline([{ severity: "critical" }]),
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});
test("buildSnapshot includes blocked tasks finding", () => {
    const service = new OperatorConsoleBackendService({
        listTasks: () => makeTaskBoard([{ status: "blocked" }]),
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});
test("planHumanTakeoverAction returns action plan for valid input", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator({ roles: ["operator", "break_glass"] });
    const plan = service.planHumanTakeoverAction({
        actionId: "action_1",
        actionType: "skip_step",
        taskId: "task_001",
        operator,
        reasonCode: "manual_intervention",
    });
    assert.equal(plan.actionId, "action_1");
    assert.equal(plan.actionType, "skip_step");
    assert.equal(plan.taskId, "task_001");
    assert.equal(plan.operatorId, "op_001");
    assert.equal(plan.requiresBreakGlass, false);
    assert.equal(plan.auditPayload.reasonCode, "manual_intervention");
});
test("planHumanTakeoverAction throws for empty taskId", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator();
    assert.throws(() => {
        service.planHumanTakeoverAction({
            actionId: "action_1",
            actionType: "skip_step",
            taskId: "",
            operator,
            reasonCode: "manual_intervention",
        });
    }, (error) => {
        return error instanceof Error && error.message.includes("task_id_required");
    });
});
test("planHumanTakeoverAction throws for empty reasonCode", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator();
    assert.throws(() => {
        service.planHumanTakeoverAction({
            actionId: "action_1",
            actionType: "skip_step",
            taskId: "task_001",
            operator,
            reasonCode: "",
        });
    }, (error) => {
        return error instanceof Error && error.message.includes("reason_required");
    });
});
test("planHumanTakeoverAction throws for operator without operatorId", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator({ operatorId: "" });
    assert.throws(() => {
        service.planHumanTakeoverAction({
            actionId: "action_1",
            actionType: "skip_step",
            taskId: "task_001",
            operator,
            reasonCode: "manual_intervention",
        });
    }, (error) => {
        return error instanceof Error && error.message.includes("operator_id_required");
    });
});
test("planHumanTakeoverAction requires break_glass role for break_glass actions", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator({ roles: ["operator"] }); // No break_glass role
    const plan = service.planHumanTakeoverAction({
        actionId: "action_1",
        actionType: "skip_step",
        taskId: "task_001",
        operator,
        reasonCode: "manual_intervention",
    });
    assert.equal(plan.requiresBreakGlass, true);
});
test("planHumanTakeoverAction requires policy evaluation for high risk actions", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator({ roles: ["operator", "break_glass"] });
    const plan = service.planHumanTakeoverAction({
        actionId: "action_1",
        actionType: "finish_task",
        taskId: "task_001",
        operator,
        reasonCode: "manual_intervention",
    });
    assert.equal(plan.requiresPolicyEvaluation, true);
});
test("planHumanTakeoverAction includes before and after state refs", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = makeOperator({ roles: ["operator"] });
    const plan = service.planHumanTakeoverAction({
        actionId: "action_1",
        actionType: "modify_next_input",
        taskId: "task_001",
        operator,
        reasonCode: "manual_intervention",
        beforeStateRef: "step_3_output",
        afterStateRef: "step_4_input",
    });
    assert.equal(plan.auditPayload.beforeStateRef, "step_3_output");
    assert.equal(plan.auditPayload.afterStateRef, "step_4_input");
});
test("ConsoleModuleId type accepts all expected values", () => {
    const moduleIds = [
        "worker_management",
        "queue_management",
        "tenant_management",
        "approval_management",
        "audit_search",
        "feature_flag_management",
        "incident_timeline",
        "oapeflir_loop_management",
        "rollout_management",
        "feedback_learning_management",
    ];
    assert.equal(moduleIds.length, 10);
});
test("OperatorControlActionType type accepts all expected values", () => {
    const actionTypes = [
        "take_over_task",
        "modify_next_input",
        "skip_step",
        "retry_step",
        "switch_model",
        "switch_worker",
        "attach_artifact",
        "inject_feedback",
        "create_improvement_candidate",
        "advance_rollout",
        "rollback_rollout",
        "finish_task",
    ];
    assert.equal(actionTypes.length, 12);
});
test("incidentTimeline is sorted by createdAt desc and limited to 50", () => {
    const incidents = [];
    for (let i = 0; i < 60; i++) {
        incidents.push({
            incidentId: `incident_${i}`,
            taskId: null,
            tenantId: null,
            severity: "info",
            summary: `incident ${i}`,
            createdAt: new Date(2026, 3, 20, 10, i).toISOString(), // Each minute apart
        });
    }
    const service = new OperatorConsoleBackendService({
        listIncidents: () => incidents,
    });
    const operator = makeOperator();
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.incidentTimeline.length, 50);
    // Verify sorted descending
    for (let i = 0; i < snapshot.incidentTimeline.length - 1; i++) {
        assert.ok(snapshot.incidentTimeline[i].createdAt >= snapshot.incidentTimeline[i + 1].createdAt);
    }
});
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
//# sourceMappingURL=index.test.js.map