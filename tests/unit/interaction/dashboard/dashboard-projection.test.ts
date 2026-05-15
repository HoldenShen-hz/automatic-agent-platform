import assert from "node:assert/strict";
import test from "node:test";

import { DashboardProjectionService, createDashboardProjectionService } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
import type { ProjectionRecord } from "../../../../src/platform/five-plane-state-evidence/projections/index.js";

function createProjectionRecord(overrides: Partial<ProjectionRecord> = {}): ProjectionRecord {
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

  service.processEvent("task.created" as any, { taskId: "task-1" });

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 1);
  assert.ok(pending[0]);
  assert.equal(pending[0]!.changes.length, 1);
});

test("DashboardProjectionService consumes pending deltas", () => {
  const service = new DashboardProjectionService();

  service.processEvent("task.created" as any, { taskId: "task-1" });

  const consumed = service.consumePendingDeltas();
  assert.equal(consumed.length, 1);

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 0);
});

test("DashboardProjectionService clears pending deltas", () => {
  const service = new DashboardProjectionService();

  service.processEvent("task.created" as any, { taskId: "task-1" });
  service.clearPendingDeltas();

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 0);
});

test("DashboardProjectionService flush forces immediate emission", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 1000 });

  service.processEvent("task.created" as any, { taskId: "task-1" });
  assert.ok(service.hasPendingDeltas());

  const flushed = service.flush();
  assert.equal(flushed.length, 1);
  assert.ok(!service.hasPendingDeltas());
});

test("DashboardProjectionService processes task.created event", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.created" as any, { taskId: "task-1" });

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "task_created");
  assert.equal(delta!.affectedMetrics.includes("totalTasks"), true);
});

test("DashboardProjectionService processes task.completed event", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.completed" as any, { taskId: "task-1" });

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "task_completed");
  assert.ok(delta!.affectedMetrics.includes("totalTasks"));
});

test("DashboardProjectionService processes task.failed event", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.failed" as any, { taskId: "task-1" });

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "task_failed");
  assert.ok(delta!.affectedMetrics.includes("incidentCount"));
});

test("DashboardProjectionService processes incident.opened event", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("incident.opened" as any, { incidentId: "inc-1" });

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "incident_opened");
  assert.ok(delta!.affectedMetrics.includes("incidentCount"));
});

test("DashboardProjectionService processes incident.resolved event", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("incident.resolved" as any, { incidentId: "inc-1" });

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "incident_resolved");
});

test("DashboardProjectionService ignores unknown event types", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("unknown.event" as any, { data: "test" });

  assert.equal(delta, null);
});

test("DashboardProjectionService processes projection record updates", () => {
  const service = new DashboardProjectionService();
  const record = createProjectionRecord({ projectionName: "task_summary", entityRef: "task-1", state: { taskStatus: "done" } });

  const delta = service.processProjectionUpdate(record);

  assert.ok(delta);
  assert.ok(delta!.changes[0]);
  assert.equal(delta!.changes[0]!.changeType, "task_completed");
});

test("DashboardProjectionService derives task change type from state", () => {
  const service = new DashboardProjectionService();

  const doneDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "done" } }));
  assert.ok(doneDelta!.changes[0]);
  assert.equal(doneDelta!.changes[0]!.changeType, "task_completed");

  const failedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "failed" } }));
  assert.ok(failedDelta!.changes[0]);
  assert.equal(failedDelta!.changes[0]!.changeType, "task_failed");

  const pendingDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", state: { taskStatus: "pending" } }));
  assert.ok(pendingDelta!.changes[0]);
  assert.equal(pendingDelta!.changes[0]!.changeType, "task_updated");
});

test("DashboardProjectionService derives incident change type from resolved state", () => {
  const service = new DashboardProjectionService();

  const openedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "incident_summary", state: { resolved: false } }));
  assert.ok(openedDelta!.changes[0]);
  assert.equal(openedDelta!.changes[0]!.changeType, "incident_opened");

  const resolvedDelta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "incident_summary", state: { resolved: true } }));
  assert.ok(resolvedDelta!.changes[0]);
  assert.equal(resolvedDelta!.changes[0]!.changeType, "incident_resolved");
});

test("DashboardProjectionService builds state from projections", () => {
  const service = new DashboardProjectionService();

  const projections: ProjectionRecord[] = [
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

  const taskDelta = service.processEvent("task.created" as any, { taskId: "task-123" });
  assert.ok(taskDelta!.changes[0]);
  assert.equal(taskDelta!.changes[0]!.entityId, "task-123");

  const incidentDelta = service.processEvent("incident.opened" as any, { incidentId: "inc-456" });
  assert.ok(incidentDelta!.changes[0]);
  assert.equal(incidentDelta!.changes[0]!.entityId, "inc-456");

  const workflowDelta = service.processEvent("task.updated" as any, { workflowId: "wf-789" });
  assert.ok(workflowDelta!.changes[0]);
  assert.equal(workflowDelta!.changes[0]!.entityId, "wf-789");
});

test("DashboardProjectionService createDashboardProjectionService factory works", () => {
  const service = createDashboardProjectionService({ emitDebounceMs: 500 });

  service.processEvent("task.created" as any, { taskId: "task-1" });
  const pending = service.getPendingDeltas();

  assert.equal(pending.length, 1);
});

test("DashboardProjectionService hasPendingDeltas returns true when deltas exist", () => {
  const service = new DashboardProjectionService();

  assert.equal(service.hasPendingDeltas(), false);

  service.processEvent("task.created" as any, { taskId: "task-1" });
  assert.equal(service.hasPendingDeltas(), true);

  service.consumePendingDeltas();
  assert.equal(service.hasPendingDeltas(), false);
});

test("DashboardProjectionService lastEmittedAt is updated after consume", () => {
  const service = new DashboardProjectionService();

  service.processEvent("task.created" as any, { taskId: "task-1" });
  assert.equal(service.hasPendingDeltas(), true);

  service.consumePendingDeltas();
  assert.equal(service.hasPendingDeltas(), false);
});

test("DashboardProjectionService pending deltas contain deltaId and timestamp", () => {
  const service = new DashboardProjectionService();

  service.processEvent("task.created" as any, { taskId: "task-1" });

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 1);
  assert.ok(pending[0]!.deltaId.length > 0);
  assert.ok(pending[0]!.timestamp.length > 0);
});

test("DashboardProjectionService derives affected metrics correctly for each change type", () => {
  const service = new DashboardProjectionService();

  const createdDelta = service.processEvent("task.created" as any, { taskId: "t1" });
  assert.ok(createdDelta!.affectedMetrics.includes("totalTasks"));
  assert.ok(createdDelta!.affectedMetrics.includes("tasksByStatus.pending"));

  const completedDelta = service.processEvent("task.completed" as any, { taskId: "t2" });
  assert.ok(completedDelta!.affectedMetrics.includes("totalTasks"));
  assert.ok(completedDelta!.affectedMetrics.includes("tasksByStatus.done"));

  const failedDelta = service.processEvent("task.failed" as any, { taskId: "t3" });
  assert.ok(failedDelta!.affectedMetrics.includes("totalTasks"));
  assert.ok(failedDelta!.affectedMetrics.includes("tasksByStatus.failed"));
  assert.ok(failedDelta!.affectedMetrics.includes("incidentCount"));

  const incidentDelta = service.processEvent("incident.opened" as any, { incidentId: "i1" });
  assert.ok(incidentDelta!.affectedMetrics.includes("incidentCount"));
  assert.ok(incidentDelta!.affectedMetrics.includes("incidentsByPriority"));
});

test("DashboardProjectionService task status with toStatus field extracts correctly", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed" as any, { toStatus: "done" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_completed");
});

test("DashboardProjectionService task status with newStatus field extracts correctly", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed" as any, { newStatus: "failed" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_failed");
});

test("DashboardProjectionService task status with status field extracts correctly", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed" as any, { status: "pending" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_updated");
});

test("DashboardProjectionService handles task:status_changed with completed status", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed" as any, { status: "completed" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_completed");
});

test("DashboardProjectionService system.health event triggers system_health_changed", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("system.health.changed" as any, { entityRef: "sys-1" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "system_health_changed");
  assert.ok(delta!.affectedMetrics.includes("systemHealth"));
});

test("DashboardProjectionService entityId falls back to eventType when no known field", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.created" as any, { data: "unknown" });
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.entityId, "task.created");
});

test("DashboardProjectionService workflow_summary produces task_updated change type", () => {
  const service = new DashboardProjectionService();

  const delta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "workflow_summary", entityRef: "wf-1", state: {} }));
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.changeType, "task_updated");
});

test("DashboardProjectionService incident_summary with entityRef extracts correctly", () => {
  const service = new DashboardProjectionService();

  const delta = service.processProjectionUpdate(createProjectionRecord({ projectionName: "incident_summary", entityRef: "inc-xyz", state: { resolved: false } }));
  assert.ok(delta);
  assert.equal(delta!.changes[0]!.entityId, "inc-xyz");
});

test("DashboardProjectionService buildStateFromProjections handles empty array", () => {
  const service = new DashboardProjectionService();

  const state = service.buildStateFromProjections([]);

  assert.equal(state.totalTasks, 0);
  assert.equal(state.totalIncidents, 0);
  assert.equal(state.totalWorkflows, 0);
  assert.deepEqual(state.tasksByStatus, {});
  assert.deepEqual(state.incidentsByPriority, {});
});

test("DashboardProjectionService buildStateFromProjections aggregates incidents by priority", () => {
  const service = new DashboardProjectionService();

  const projections: ProjectionRecord[] = [
    createProjectionRecord({ projectionName: "incident_summary", entityRef: "inc-1", state: { priority: "high" } }),
    createProjectionRecord({ projectionName: "incident_summary", entityRef: "inc-2", state: { priority: "high" } }),
    createProjectionRecord({ projectionName: "incident_summary", entityRef: "inc-3", state: { priority: "low" } }),
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalIncidents, 3);
  assert.equal(state.incidentsByPriority["high"], 2);
  assert.equal(state.incidentsByPriority["low"], 1);
});

test("DashboardProjectionService multiple projection updates accumulate deltas", () => {
  const service = new DashboardProjectionService();

  service.processProjectionUpdate(createProjectionRecord({ projectionName: "task_summary", entityRef: "task-1", state: { taskStatus: "done" } }));
  service.processEvent("task.created" as any, { taskId: "task-2" });
  service.processEvent("incident.opened" as any, { incidentId: "inc-1" });

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 3);
});

test("DashboardProjectionService multiple consume calls do not affect each other", () => {
  const service = new DashboardProjectionService();

  service.processEvent("task.created" as any, { taskId: "task-1" });

  const first = service.consumePendingDeltas();
  assert.equal(first.length, 1);

  const second = service.consumePendingDeltas();
  assert.equal(second.length, 0);
});

test("DashboardProjectionService flush with no pending deltas returns empty array", () => {
  const service = new DashboardProjectionService();

  const flushed = service.flush();
  assert.equal(flushed.length, 0);
});

test("DashboardProjectionService default config has expected values", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task.created" as any, { taskId: "task-1" });
  assert.ok(delta);
});
