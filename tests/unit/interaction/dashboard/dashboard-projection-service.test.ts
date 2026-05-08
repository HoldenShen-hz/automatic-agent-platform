import assert from "node:assert/strict";
import test from "node:test";

import {
  DashboardProjectionService,
  createDashboardProjectionService,
  type DashboardDelta,
  type DashboardChange,
  type DashboardProjectionState,
} from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

function createMockProjectionRecord(name: string, entityRef: string, state: Record<string, unknown>) {
  return {
    projectionName: name,
    entityRef,
    state,
    lastUpdatedAt: "2026-04-01T00:00:00.000Z",
  };
}

test("DashboardProjectionService creates with default config", () => {
  const service = new DashboardProjectionService();
  assert.ok(service instanceof DashboardProjectionService);
});

test("DashboardProjectionService creates with custom config", () => {
  const service = new DashboardProjectionService({
    projectionNames: ["custom_projection"],
    emitDebounceMs: 200,
  });
  assert.ok(service instanceof DashboardProjectionService);
});

test("processProjectionUpdate derives task change", () => {
  const service = new DashboardProjectionService();
  const record = createMockProjectionRecord("task_summary", "task-123", { taskStatus: "done" });

  const delta = service.processProjectionUpdate(record);

  assert.ok(delta !== null);
  assert.equal(delta.changes.length, 1);
  assert.equal(delta.changes[0]!.changeType, "task_completed");
  assert.equal(delta.changes[0]!.entityId, "task-123");
});

test("processProjectionUpdate derives incident change", () => {
  const service = new DashboardProjectionService();
  const record = createMockProjectionRecord("incident_summary", "incident-456", { resolved: true });

  const delta = service.processProjectionUpdate(record);

  assert.ok(delta !== null);
  assert.equal(delta.changes[0]!.changeType, "incident_resolved");
});

test("processProjectionUpdate returns null when no change", () => {
  const service = new DashboardProjectionService();
  const record = createMockProjectionRecord("unknown_projection", "entity-1", {});

  const delta = service.processProjectionUpdate(record);

  assert.equal(delta, null);
});

test("processEvent derives task status change", () => {
  const service = new DashboardProjectionService();
  const payload = { taskId: "task-789", status: "done" };

  const delta = service.processEvent("task:status_changed", payload);

  assert.ok(delta !== null);
  assert.equal(delta.changes[0]!.changeType, "task_completed");
  assert.equal(delta.changes[0]!.entityId, "task-789");
});

test("processEvent returns null for unknown event type", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("unknown:event", {});

  assert.equal(delta, null);
});

test("getPendingDeltas returns all pending deltas", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-2", { taskStatus: "failed" }));

  const pending = service.getPendingDeltas();

  assert.equal(pending.length, 2);
});

test("consumePendingDeltas clears and returns deltas", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  const consumed = service.consumePendingDeltas();

  assert.equal(consumed.length, 1);
  assert.equal(service.getPendingDeltas().length, 0);
});

test("hasPendingDeltas returns true when pending", () => {
  const service = new DashboardProjectionService();
  assert.equal(service.hasPendingDeltas(), false);

  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  assert.equal(service.hasPendingDeltas(), true);
});

test("flush returns and clears pending deltas", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  const flushed = service.flush();

  assert.equal(flushed.length, 1);
  assert.equal(service.hasPendingDeltas(), false);
});

test("clearPendingDeltas clears without emitting", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  service.clearPendingDeltas();

  assert.equal(service.getPendingDeltas().length, 0);
  assert.equal(service.hasPendingDeltas(), false);
});

test("buildStateFromProjections aggregates task counts", () => {
  const service = new DashboardProjectionService();
  const projections = [
    createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }),
    createMockProjectionRecord("task_summary", "task-2", { taskStatus: "done" }),
    createMockProjectionRecord("task_summary", "task-3", { taskStatus: "failed" }),
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalTasks, 3);
  assert.deepEqual(state.tasksByStatus, { done: 2, failed: 1 });
});

test("buildStateFromProjections aggregates incident counts", () => {
  const service = new DashboardProjectionService();
  const projections = [
    createMockProjectionRecord("incident_summary", "inc-1", { priority: "high", resolved: false }),
    createMockProjectionRecord("incident_summary", "inc-2", { priority: "low", resolved: true }),
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalIncidents, 2);
  assert.deepEqual(state.incidentsByPriority, { high: 1, low: 1 });
});

test("buildStateFromProjections emits the full dashboard KPI field set", () => {
  const service = new DashboardProjectionService();
  const projections = [
    createMockProjectionRecord("task_summary", "task-1", {
      taskStatus: "completed",
      durationMs: 100,
      pendingApproval: true,
      costUsd: 25,
    }),
    createMockProjectionRecord("task_summary", "task-2", {
      taskStatus: "failed",
      durationMs: 50,
      costUsd: 10,
    }),
    createMockProjectionRecord("task_summary", "task-3", {
      taskStatus: "in_progress",
      durationMs: 20,
      costUsd: 5,
    }),
    createMockProjectionRecord("incident_summary", "inc-1", {
      priority: "critical",
      resolved: false,
    }),
    createMockProjectionRecord("agent_health", "agent-1", {
      status: "healthy",
    }),
    createMockProjectionRecord("agent_budget", "budget-1", {
      consumedUsd: 40,
    }),
  ];

  const state = service.buildStateFromProjections(projections);

  assert.equal(state.totalTasks, 3);
  assert.equal(state.successRate, 0.3333);
  assert.equal(state.avgDurationMs, 100);
  assert.equal(state.activeAgents, 2);
  assert.equal(state.queueDepth, 1);
  assert.equal(state.errorRate, 0.3333);
  assert.equal(state.p50LatencyMs, 50);
  assert.equal(state.p99LatencyMs, 99);
  assert.equal(state.budgetUtilizationPercent, 8);
  assert.equal(state.approvalPendingCount, 1);
  assert.ok(state.systemHealthScore >= 0);
});

test("createDashboardProjectionService factory creates service", () => {
  const service = createDashboardProjectionService({ emitDebounceMs: 500 });
  assert.ok(service instanceof DashboardProjectionService);
});

test("DashboardDelta contains timestamp and changes", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  const delta = service.consumePendingDeltas()[0]!;

  assert.ok(delta.deltaId.startsWith("delta_"));
  assert.ok(delta.timestamp.length > 0);
  assert.ok(Array.isArray(delta.changes));
  assert.ok(Array.isArray(delta.affectedMetrics));
});

test("affectsMetrics includes correct metric names for task_created", () => {
  const service = new DashboardProjectionService();
  const change: DashboardChange = {
    changeType: "task_created",
    entityId: "task-new",
    newValue: {},
  };
  const metrics = (service as any).deriveAffectedMetrics([change]);

  assert.ok(metrics.includes("totalTasks"));
  assert.ok(metrics.includes("tasksByStatus.pending"));
});
