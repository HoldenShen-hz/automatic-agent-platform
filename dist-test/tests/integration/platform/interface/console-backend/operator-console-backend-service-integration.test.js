import assert from "node:assert/strict";
import test from "node:test";
import { OperatorConsoleBackendService } from "../../../../../src/platform/interface/console-backend/index.js";
test("OperatorConsoleBackendService builds snapshot with no data sources", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.operator.operatorId, "op-1");
    assert.equal(snapshot.generatedAt.length > 0, true);
    assert.deepEqual(snapshot.taskBoard, []);
    assert.deepEqual(snapshot.approvalQueue, []);
    assert.deepEqual(snapshot.workerPanel, []);
    assert.deepEqual(snapshot.tenantPanel, []);
    assert.deepEqual(snapshot.incidentTimeline, []);
    assert.deepEqual(snapshot.findings, []);
});
test("OperatorConsoleBackendService filters task board by tenant scope", () => {
    const service = new OperatorConsoleBackendService({
        listTasks: () => [
            { taskId: "task-1", tenantId: "tenant-a", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
            { taskId: "task-2", tenantId: "tenant-b", workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        ],
    });
    // Operator with tenant scope should only see their tenant's tasks
    const operator = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-a" };
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.taskBoard.length, 1);
    assert.equal(snapshot.taskBoard[0]?.taskId, "task-1");
    // Operator without tenant scope sees all tasks
    const globalOperator = { operatorId: "op-2", roles: ["admin"] };
    const globalSnapshot = service.buildSnapshot(globalOperator);
    assert.equal(globalSnapshot.taskBoard.length, 2);
});
test("OperatorConsoleBackendService filters approval queue by tenant scope", () => {
    const service = new OperatorConsoleBackendService({
        listPendingApprovals: () => [
            { approvalId: "appr-1", taskId: "task-1", tenantId: "tenant-a", riskLevel: "high", reason: "High risk action", createdAt: "2026-04-23T00:00:00.000Z" },
            { approvalId: "appr-2", taskId: "task-2", tenantId: "tenant-b", riskLevel: "medium", reason: "Medium risk", createdAt: "2026-04-23T00:00:00.000Z" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"], tenantId: "tenant-b" };
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.approvalQueue.length, 1);
    assert.equal(snapshot.approvalQueue[0]?.approvalId, "appr-2");
});
test("OperatorConsoleBackendService builds module coverage correctly", () => {
    const service = new OperatorConsoleBackendService({
        listWorkers: () => [
            { workerId: "w-1", status: "online", activeExecutionCount: 2, queueDepth: 5 },
        ],
        listTasks: () => [
            { taskId: "t-1", tenantId: null, workspaceId: null, status: "running", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        ],
        listPendingApprovals: () => [
            { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "low", reason: "test", createdAt: "2026-04-23T00:00:00.000Z" },
        ],
        listIncidents: () => [
            { incidentId: "i-1", taskId: "t-1", tenantId: null, severity: "info", summary: "test", createdAt: "2026-04-23T00:00:00.000Z" },
        ],
        listTenants: () => [
            { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    const moduleCoverage = snapshot.moduleCoverage;
    assert.ok(moduleCoverage.some((m) => m.moduleId === "worker_management" && m.status === "available"));
    assert.ok(moduleCoverage.some((m) => m.moduleId === "queue_management" && m.status === "available"));
    assert.ok(moduleCoverage.some((m) => m.moduleId === "approval_management" && m.status === "available"));
    assert.ok(moduleCoverage.some((m) => m.moduleId === "incident_timeline" && m.status === "available"));
    assert.ok(moduleCoverage.some((m) => m.moduleId === "oapeflir_loop_management" && m.status === "available"));
});
test("OperatorConsoleBackendService generates critical findings", () => {
    const service = new OperatorConsoleBackendService({
        listPendingApprovals: () => [
            { approvalId: "a-1", taskId: "t-1", tenantId: null, riskLevel: "critical", reason: "Critical action", createdAt: "2026-04-23T00:00:00.000Z" },
        ],
        listIncidents: () => [
            { incidentId: "i-1", taskId: "t-1", tenantId: null, severity: "critical", summary: "System down", createdAt: "2026-04-23T00:00:00.000Z" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("critical approval")));
    assert.ok(snapshot.findings.some((f) => f.includes("critical incident")));
});
test("OperatorConsoleBackendService detects offline worker with active executions", () => {
    const service = new OperatorConsoleBackendService({
        listWorkers: () => [
            { workerId: "w-offline", status: "offline", activeExecutionCount: 3, queueDepth: 0 },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("offline worker still owns active executions")));
});
test("OperatorConsoleBackendService detects blocked tasks", () => {
    const service = new OperatorConsoleBackendService({
        listTasks: () => [
            { taskId: "t-blocked", tenantId: null, workspaceId: null, status: "blocked", riskLevel: "low", updatedAt: "2026-04-23T00:00:00.000Z" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.findings.some((f) => f.includes("blocked tasks")));
});
test("OperatorConsoleBackendService plans human takeover action", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const plan = service.planHumanTakeoverAction({
        actionId: "action-1",
        actionType: "take_over_task",
        taskId: "task-123",
        operator,
        reasonCode: "manual_intervention_needed",
    });
    assert.equal(plan.actionId, "action-1");
    assert.equal(plan.actionType, "take_over_task");
    assert.equal(plan.taskId, "task-123");
    assert.equal(plan.operatorId, "op-1");
    assert.equal(plan.requiresPolicyEvaluation, false);
    assert.equal(plan.requiresBreakGlass, false);
});
test("OperatorConsoleBackendService flags high-risk actions as requiring policy evaluation", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const highRiskActions = [
        "switch_worker",
        "attach_artifact",
        "advance_rollout",
        "rollback_rollout",
        "finish_task",
    ];
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
test("OperatorConsoleBackendService flags break-glass actions without role", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] }; // No break_glass role
    const breakGlassActions = [
        "skip_step",
        "switch_worker",
        "finish_task",
        "rollback_rollout",
    ];
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
    // With break_glass role, should not require break-glass
    const authorizedOperator = { operatorId: "op-2", roles: ["viewer", "break_glass"] };
    const plan = service.planHumanTakeoverAction({
        actionId: "action-skip",
        actionType: "skip_step",
        taskId: "task-123",
        operator: authorizedOperator,
        reasonCode: "test",
    });
    assert.equal(plan.requiresBreakGlass, false);
});
test("OperatorConsoleBackendService validates task id required", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    assert.throws(() => service.planHumanTakeoverAction({
        actionId: "a-1",
        actionType: "take_over_task",
        taskId: "",
        operator,
        reasonCode: "test",
    }), (error) => error instanceof Error
        && "code" in error
        && error.code === "console.task_id_required"
        && error.message === "Operator action requires a task id.");
});
test("OperatorConsoleBackendService validates reason required", () => {
    const service = new OperatorConsoleBackendService({});
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    assert.throws(() => service.planHumanTakeoverAction({
        actionId: "a-1",
        actionType: "take_over_task",
        taskId: "task-123",
        operator,
        reasonCode: "",
    }), (error) => error instanceof Error
        && "code" in error
        && error.code === "console.reason_required"
        && error.message === "Operator action requires a reason code.");
});
test("OperatorConsoleBackendService validates operator id required", () => {
    const service = new OperatorConsoleBackendService({});
    assert.throws(() => service.buildSnapshot({
        operatorId: "",
        roles: ["viewer"],
    }), (error) => error instanceof Error
        && "code" in error
        && error.code === "console.operator_id_required"
        && error.message === "Operator id is required.");
});
test("OperatorConsoleBackendService sorts incident timeline by recency", () => {
    const service = new OperatorConsoleBackendService({
        listIncidents: () => [
            { incidentId: "i-old", taskId: null, tenantId: null, severity: "info", summary: "Old incident", createdAt: "2026-04-20T00:00:00.000Z" },
            { incidentId: "i-new", taskId: null, tenantId: null, severity: "info", summary: "New incident", createdAt: "2026-04-23T00:00:00.000Z" },
            { incidentId: "i-mid", taskId: null, tenantId: null, severity: "info", summary: "Mid incident", createdAt: "2026-04-22T00:00:00.000Z" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    // Should be sorted newest first and limited to 50
    assert.equal(snapshot.incidentTimeline[0]?.incidentId, "i-new");
    assert.equal(snapshot.incidentTimeline[1]?.incidentId, "i-mid");
    assert.equal(snapshot.incidentTimeline[2]?.incidentId, "i-old");
});
test("OperatorConsoleBackendService limits incident timeline to 50 entries", () => {
    const service = new OperatorConsoleBackendService({
        listIncidents: () => Array.from({ length: 100 }, (_, i) => ({
            incidentId: `i-${i}`,
            taskId: null,
            tenantId: null,
            severity: "info",
            summary: `Incident ${i}`,
            createdAt: new Date(Date.now() - i * 1000).toISOString(),
        })),
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.ok(snapshot.incidentTimeline.length <= 50);
});
test("OperatorConsoleBackendService includes tenant info from data source", () => {
    const service = new OperatorConsoleBackendService({
        listTenants: () => [
            { tenantId: "tenant-1", organizationId: "org-1", isolationMode: "standard" },
            { tenantId: "tenant-2", organizationId: "org-2", isolationMode: "isolated" },
        ],
    });
    const operator = { operatorId: "op-1", roles: ["viewer"] };
    const snapshot = service.buildSnapshot(operator);
    assert.equal(snapshot.tenantPanel.length, 2);
    assert.ok(snapshot.tenantPanel.some((t) => t.tenantId === "tenant-1"));
    assert.ok(snapshot.tenantPanel.some((t) => t.tenantId === "tenant-2"));
});
//# sourceMappingURL=operator-console-backend-service-integration.test.js.map