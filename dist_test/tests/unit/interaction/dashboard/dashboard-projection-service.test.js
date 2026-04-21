import assert from "node:assert/strict";
import test from "node:test";
import { DashboardProjectionService, createDashboardProjectionService } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
function createProjectionRecord(overrides = {}) {
    return {
        projectionId: "proj-1",
        sourceEventId: "event-1",
        projectionName: "task_summary",
        entityRef: "task-1",
        state: { taskStatus: "pending" },
        updatedAt: new Date().toISOString(),
        ...overrides,
    };
}
test("DashboardProjectionService registers and returns pending deltas", () => {
    const service = new DashboardProjectionService();
    service.processEvent("task.created", { taskId: "task-1" });
    const pending = service.getPendingDeltas();
    assert.equal(pending.length, 1);
    assert.ok(pending[0]);
    assert.equal(pending[0].changes.length, 1);
});
test("DashboardProjectionService consumes pending deltas", () => {
    const service = new DashboardProjectionService();
    service.processEvent("task.created", { taskId: "task-1" });
    const consumed = service.consumePendingDeltas();
    assert.equal(consumed.length, 1);
    const pending = service.getPendingDeltas();
    assert.equal(pending.length, 0);
});
test("DashboardProjectionService clears pending deltas", () => {
    const service = new DashboardProjectionService();
    service.processEvent("task.created", { taskId: "task-1" });
    service.clearPendingDeltas();
    const pending = service.getPendingDeltas();
    assert.equal(pending.length, 0);
});
test("DashboardProjectionService flush forces immediate emission", () => {
    const service = new DashboardProjectionService({ emitDebounceMs: 1000 });
    service.processEvent("task.created", { taskId: "task-1" });
    assert.ok(service.hasPendingDeltas());
    const flushed = service.flush();
    assert.equal(flushed.length, 1);
    assert.ok(!service.hasPendingDeltas());
});
test("DashboardProjectionService processes task.created event", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("task.created", { taskId: "task-1" });
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "task_created");
    assert.equal(delta.affectedMetrics.includes("totalTasks"), true);
});
test("DashboardProjectionService processes task.completed event", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("task.completed", { taskId: "task-1" });
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "task_completed");
    assert.ok(delta.affectedMetrics.includes("totalTasks"));
});
test("DashboardProjectionService processes task.failed event", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("task.failed", { taskId: "task-1" });
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "task_failed");
    assert.ok(delta.affectedMetrics.includes("incidentCount"));
});
test("DashboardProjectionService processes incident.opened event", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("incident.opened", { incidentId: "inc-1" });
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "incident_opened");
    assert.ok(delta.affectedMetrics.includes("incidentCount"));
});
test("DashboardProjectionService processes incident.resolved event", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("incident.resolved", { incidentId: "inc-1" });
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "incident_resolved");
});
test("DashboardProjectionService ignores unknown event types", () => {
    const service = new DashboardProjectionService();
    const delta = service.processEvent("unknown.event", { data: "test" });
    assert.equal(delta, null);
});
test("DashboardProjectionService processes projection record updates", () => {
    const service = new DashboardProjectionService();
    const record = createProjectionRecord({ projectionName: "task_summary", entityRef: "task-1", state: { taskStatus: "done" } });
    const delta = service.processProjectionUpdate(record);
    assert.ok(delta);
    assert.ok(delta.changes[0]);
    assert.equal(delta.changes[0].changeType, "task_completed");
});
test("DashboardProjectionService derives task change type from state", () => {
    const service = new DashboardProjectionService();
    const doneDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "done" } }));
    assert.ok(doneDelta.changes[0]);
    assert.equal(doneDelta.changes[0].changeType, "task_completed");
    const failedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "failed" } }));
    assert.ok(failedDelta.changes[0]);
    assert.equal(failedDelta.changes[0].changeType, "task_failed");
    const pendingDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "pending" } }));
    assert.ok(pendingDelta.changes[0]);
    assert.equal(pendingDelta.changes[0].changeType, "task_updated");
});
test("DashboardProjectionService derives incident change type from resolved state", () => {
    const service = new DashboardProjectionService();
    const openedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "incident_summary", state: { resolved: false } }));
    assert.ok(openedDelta.changes[0]);
    assert.equal(openedDelta.changes[0].changeType, "incident_opened");
    const resolvedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "incident_summary", state: { resolved: true } }));
    assert.ok(resolvedDelta.changes[0]);
    assert.equal(resolvedDelta.changes[0].changeType, "incident_resolved");
});
test("DashboardProjectionService builds state from projections", () => {
    const service = new DashboardProjectionService();
    const projections = [
        createProjectionRecord({ projectionName: "task_summary", entityRef: "task-1", state: { taskStatus: "done" } }),
        createProjectionRecord({ projectionName: "task_summary", entityRef: "task-2", state: { taskStatus: "pending" } }),
        createProjectionRecord({ projectionName: "incident_summary", entityRef: "inc-1", state: { priority: "high" } }),
        createProjectionRecord({ projectionName: "workflow_summary", entityRef: "wf-1", state: {} }),
    ];
    const state = service.buildStateFromProjections(projections);
    assert.equal(state.totalTasks, 2);
    assert.equal(state.tasksByStatus["done"], 1);
    assert.equal(state.tasksByStatus["pending"], 1);
    assert.equal(state.totalIncidents, 1);
    assert.equal(state.totalWorkflows, 1);
});
test("DashboardProjectionService extracts entityId from various payload fields", () => {
    const service = new DashboardProjectionService();
    const taskDelta = service.processEvent("task.created", { taskId: "task-123" });
    assert.ok(taskDelta.changes[0]);
    assert.equal(taskDelta.changes[0].entityId, "task-123");
    const incidentDelta = service.processEvent("incident.opened", { incidentId: "inc-456" });
    assert.ok(incidentDelta.changes[0]);
    assert.equal(incidentDelta.changes[0].entityId, "inc-456");
    const workflowDelta = service.processEvent("task.updated", { workflowId: "wf-789" });
    assert.ok(workflowDelta.changes[0]);
    assert.equal(workflowDelta.changes[0].entityId, "wf-789");
});
test("DashboardProjectionService createDashboardProjectionService factory works", () => {
    const service = createDashboardProjectionService({ emitDebounceMs: 500 });
    service.processEvent("task.created", { taskId: "task-1" });
    const pending = service.getPendingDeltas();
    assert.equal(pending.length, 1);
});
test("DashboardProjectionService lastEmittedAt is updated after consume", () => {
    const service = new DashboardProjectionService();
    service.processEvent("task.created", { taskId: "task-1" });
    assert.equal(service.hasPendingDeltas(), true);
    service.consumePendingDeltas();
    assert.equal(service.hasPendingDeltas(), false);
});
//# sourceMappingURL=dashboard-projection-service.test.js.map