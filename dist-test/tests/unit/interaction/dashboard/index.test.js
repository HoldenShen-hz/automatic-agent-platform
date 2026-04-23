import assert from "node:assert/strict";
import test from "node:test";
import { DashboardAggregationService } from "../../../../src/interaction/dashboard/index.js";
function makeTask(taskId, taskStatus, divisionId = "general_ops") {
    return {
        taskId,
        title: `Task ${taskId}`,
        priority: "normal",
        taskStatus,
        workflowStatus: taskStatus === "done" ? "completed" : "running",
        divisionId,
        currentStepIndex: 0,
        sessionStatus: "open",
        latestEventAt: "2026-04-19T00:00:00.000Z",
        updatedAt: "2026-04-19T00:00:00.000Z",
    };
}
function makeSystemSituation(overrides = {}) {
    return {
        healthStatus: "degraded",
        providerHealth: {
            status: "degraded",
            successRate: 0.92,
            recentCalls: 50,
        },
        resourceUtilization: {
            memoryRssMb: 512,
            cpuPercent: 45,
            activeProcesses: 8,
        },
        queueBacklog: {
            size: 3,
            degraded: true,
        },
        eventBusBacklog: {
            tier1PendingAcks: 1,
        },
        findings: ["queue backlog elevated"],
        observedAt: Date.parse("2026-04-19T00:00:00.000Z"),
        ...overrides,
    };
}
test("DashboardAggregationService builds operator dashboard with attention queue and cost warning", () => {
    const suggestions = [
        {
            itemType: "suggestion",
            priority: "normal",
            title: "建议优化广告预算",
            description: "CTR 下降，建议调整预算结构。",
            actionOptions: ["open_suggestion"],
            createdAt: "2026-04-19T00:01:00.000Z",
            domainId: "advertising",
        },
    ];
    const service = new DashboardAggregationService({
        taskSource: {
            list: () => [
                makeTask("task_1", "failed", "engineering_ops"),
                makeTask("task_2", "pending", "finance"),
                makeTask("task_3", "done", "engineering_ops"),
            ],
        },
        systemSource: {
            build: () => makeSystemSituation(),
        },
        currentTime: () => "2026-04-19T00:02:00.000Z",
        costBurnUsd: 12,
        forecastCostUsd: 10,
        suggestions,
        activeGoals: [{ goalId: "goal_1", progressPercent: 60 }],
    });
    const dashboard = service.buildOperatorDashboard();
    assert.equal(dashboard.dailySummary.tasksFailed, 1);
    assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "incident"));
    assert.ok(dashboard.attentionQueue.some((item) => item.itemType === "budget_warning"));
    assert.equal(dashboard.proactiveSuggestions.length, 1);
});
test("DashboardAggregationService snapshot reflects backlog and incidents", async () => {
    const service = new DashboardAggregationService({
        taskSource: {
            list: () => [
                makeTask("task_1", "in_progress"),
                makeTask("task_2", "failed"),
                makeTask("task_3", "done"),
            ],
        },
        systemSource: {
            build: () => makeSystemSituation({ healthStatus: "ok" }),
        },
        currentTime: () => "2026-04-19T00:00:00.000Z",
    });
    const snapshot = await service.getSnapshot();
    assert.equal(snapshot.workflowBacklog, 2);
    assert.equal(snapshot.incidentCount, 1);
    assert.equal(snapshot.budgetAlerts, 0);
});
test("DashboardAggregationService builds fleet dashboard grouped by division", () => {
    const service = new DashboardAggregationService({
        taskSource: {
            list: () => [
                makeTask("task_1", "in_progress", "engineering_ops"),
                makeTask("task_2", "failed", "engineering_ops"),
                makeTask("task_3", "pending", "finance"),
            ],
        },
        systemSource: {
            build: () => makeSystemSituation({ healthStatus: "unhealthy" }),
        },
    });
    const dashboard = service.buildFleetDashboard();
    assert.equal(dashboard.platformHealth.overall, 58);
    assert.equal(dashboard.departmentOverview.length, 2);
    assert.ok(dashboard.departmentOverview.some((item) => item.departmentId === "engineering_ops"));
});
//# sourceMappingURL=index.test.js.map