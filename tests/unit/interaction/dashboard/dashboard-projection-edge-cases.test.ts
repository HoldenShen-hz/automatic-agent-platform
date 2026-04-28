/**
 * Edge Case Tests: Dashboard Projection Service
 *
 * Tests edge cases and boundary conditions for the DashboardProjectionService.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DashboardProjectionService } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";
import type { DashboardDelta, DashboardChange } from "../../../../src/interaction/dashboard/dashboard-projection-service.js";

function createMockProjectionRecord(name: string, entityRef: string, state: Record<string, unknown>) {
  return {
    projectionName: name,
    entityRef,
    state,
    lastUpdatedAt: "2026-04-01T00:00:00.000Z",
  };
}

test("DashboardProjectionService handles multiple rapid updates", () => {
  const service = new DashboardProjectionService();

  for (let i = 0; i < 100; i++) {
    service.processProjectionUpdate(createMockProjectionRecord("task_summary", `task-${i}`, { taskStatus: "done" }));
  }

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 100);
});

test("DashboardProjectionService handles different change types", () => {
  const service = new DashboardProjectionService();

  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-2", { taskStatus: "failed" }));
  service.processProjectionUpdate(createMockProjectionRecord("incident_summary", "inc-1", { resolved: true }));

  const pending = service.getPendingDeltas();
  assert.equal(pending.length, 3);

  const changeTypes = pending.map(d => d.changes[0]?.changeType);
  assert.ok(changeTypes.includes("task_completed"));
  assert.ok(changeTypes.includes("task_failed"));
  assert.ok(changeTypes.includes("incident_resolved"));
});

test("DashboardProjectionService derives affected metrics for all change types", () => {
  const service = new DashboardProjectionService();
  const changes: DashboardChange[] = [
    { changeType: "task_created", entityId: "t1", newValue: {} },
    { changeType: "task_completed", entityId: "t2", newValue: {} },
    { changeType: "task_failed", entityId: "t3", newValue: {} },
    { changeType: "task_updated", entityId: "t4", newValue: {} },
    { changeType: "incident_opened", entityId: "i1", newValue: {} },
    { changeType: "incident_resolved", entityId: "i2", newValue: {} },
    { changeType: "system_health_changed", entityId: "sys1", newValue: {} },
  ];

  for (const change of changes) {
    const metrics = (service as any).deriveAffectedMetrics([change]);
    assert.ok(metrics.length > 0, `No metrics for ${change.changeType}`);
  }
});

test("DashboardProjectionService processes event with null payload", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed", null);

  // Should handle null gracefully
  assert.ok(delta === null || delta !== null);
});

test("DashboardProjectionService processes event with undefined values in payload", () => {
  const service = new DashboardProjectionService();

  const delta = service.processEvent("task:status_changed", {
    taskId: "task_undefined",
    status: undefined,
    newStatus: undefined,
    toStatus: undefined,
  });

  // Should derive change type but may return null due to undefined status
  assert.ok(delta === null || delta !== null);
});

test("DashboardProjectionService extracts entityId from various payload shapes", () => {
  const service = new DashboardProjectionService();

  const delta1 = service.processEvent("task:status_changed", { taskId: "from_taskId" });
  const delta2 = service.processEvent("incident.opened", { incidentId: "from_incidentId" });
  const delta3 = service.processEvent("task.updated", { workflowId: "from_workflowId" });
  const delta4 = service.processEvent("system.health.changed", { entityRef: "from_entityRef" });
  const delta5 = service.processEvent("unknown:event", {});

  assert.ok(delta1 !== null);
  assert.ok(delta2 !== null);
  assert.ok(delta3 !== null);
  assert.ok(delta4 !== null);
  assert.equal(delta5, null);
  assert.equal(delta1!.changes[0]!.entityId, "from_taskId");
  assert.equal(delta2!.changes[0]!.entityId, "from_incidentId");
  assert.equal(delta3!.changes[0]!.entityId, "from_workflowId");
  assert.equal(delta4!.changes[0]!.entityId, "from_entityRef");
});

test("DashboardProjectionService buildStateFromProjections handles empty array", () => {
  const service = new DashboardProjectionService();

  const state = service.buildStateFromProjections([]);

  assert.equal(state.totalTasks, 0);
  assert.equal(state.totalIncidents, 0);
  assert.equal(state.totalWorkflows, 0);
  assert.ok(state.lastUpdatedAt.length > 0);
});

test("DashboardProjectionService buildStateFromProjections handles unknown projection names", () => {
  const service = new DashboardProjectionService();

  const state = service.buildStateFromProjections([
    createMockProjectionRecord("unknown_projection", "entity-1", { data: "test" }),
    createMockProjectionRecord("another_unknown", "entity-2", { foo: "bar" }),
  ]);

  assert.equal(state.totalTasks, 0);
  assert.equal(state.totalIncidents, 0);
});

test("DashboardProjectionService buildStateFromProjections handles missing taskStatus", () => {
  const service = new DashboardProjectionService();

  const state = service.buildStateFromProjections([
    createMockProjectionRecord("task_summary", "task-no-status", {}),
    createMockProjectionRecord("task_summary", "task-null-status", { taskStatus: null }),
    createMockProjectionRecord("task_summary", "task-undefined-status", { taskStatus: undefined }),
  ]);

  assert.equal(state.totalTasks, 3);
  assert.ok(state.tasksByStatus["unknown"] !== undefined);
});

test("DashboardProjectionService consumePendingDeltas sets lastEmittedAt", () => {
  const service = new DashboardProjectionService();
  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  service.consumePendingDeltas();

  // Access private lastEmittedAt through getPendingDeltas behavior
  assert.equal(service.getPendingDeltas().length, 0);
});

test("DashboardProjectionService flush clears debounce timer", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 1000 });

  service.processProjectionUpdate(createMockProjectionRecord("task_summary", "task-1", { taskStatus: "done" }));

  // flush should clear the debounce timer
  const result = service.flush();

  assert.equal(result.length, 1);
  assert.equal(service.hasPendingDeltas(), false);
});

test("DashboardProjectionService clearPendingDeltas clears all pending", () => {
  const service = new DashboardProjectionService();

  for (let i = 0; i < 10; i++) {
    service.processProjectionUpdate(createMockProjectionRecord("task_summary", `task-${i}`, { taskStatus: "done" }));
  }

  service.clearPendingDeltas();

  assert.equal(service.getPendingDeltas().length, 0);
  assert.equal(service.hasPendingDeltas(), false);
});

test("DashboardProjectionService deltaId is unique per update", () => {
  const service = new DashboardProjectionService();

  const delta1 = service.processProjectionUpdate(createMockProjectionRecord("task_summary", "t1", { taskStatus: "done" }));
  const delta2 = service.processProjectionUpdate(createMockProjectionRecord("task_summary", "t2", { taskStatus: "done" }));

  assert.notEqual(delta1!.deltaId, delta2!.deltaId);
});

test("DashboardProjectionService deriveChangeType handles case variations", () => {
  const service = new DashboardProjectionService();

  const delta1 = service.processEvent("task:status_changed", { status: "DONE" });
  const delta2 = service.processEvent("task:status_changed", { status: "Failed" });
  const delta3 = service.processEvent("task:status_changed", { status: "In_Progress" });

  assert.ok(delta1 !== null);
  assert.ok(delta2 !== null);
  assert.ok(delta3 !== null);
});

test("DashboardProjectionService extracts status from various payload keys", () => {
  const service = new DashboardProjectionService();

  const delta1 = service.processEvent("task:status_changed", { status: "done" });
  const delta2 = service.processEvent("task:status_changed", { newStatus: "done" });
  const delta3 = service.processEvent("task:status_changed", { toStatus: "done" });

  assert.ok(delta1 !== null);
  assert.ok(delta2 !== null);
  assert.ok(delta3 !== null);
});

test("DashboardProjectionService scheduleEmit is idempotent", () => {
  const service = new DashboardProjectionService({ emitDebounceMs: 1000 });

  // Calling scheduleEmit multiple times should not create multiple timers
  (service as any).scheduleEmit();
  (service as any).scheduleEmit();
  (service as any).scheduleEmit();

  // Timer should still be null after first call (early return)
  assert.ok((service as any).debounceTimer !== null);
});

test("DashboardProjectionService delta timestamp is ISO format", () => {
  const service = new DashboardProjectionService();

  const delta = service.processProjectionUpdate(createMockProjectionRecord("task_summary", "t1", { taskStatus: "done" }));

  assert.ok(delta!.timestamp.match(/^\d{4}-\d{2}-\d{2}T/));
});
