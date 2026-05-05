import test from "node:test";
import assert from "node:assert/strict";

import {
  workflowRunProjectionHandler,
  createEmptyWorkflowRunState,
  createWorkflowRunProjectionHandler,
  type WorkflowRunState,
  type ProjectionInputEvent,
} from "../../../../../../src/platform/state-evidence/events/projections/workflow-run-projection.js";

/**
 * Helper to create a projection input event
 */
function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-04-19T10:00:00.000Z",
): ProjectionInputEvent {
  return {
    eventId,
    eventType,
    taskId,
    payloadJson,
    createdAt,
  };
}

test("workflowRunProjectionHandler initializes state correctly", () => {
  const event = makeEvent("evt_1", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.workflowId, "task_1");
  assert.equal(state.taskId, "task_1");
  assert.equal(state.status, "running");
  assert.equal(state.eventCount, 1);
  assert.deepEqual(state.processedEventIds, ["evt_1"]);
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
});

test("workflowRunProjectionHandler handles workflow:step_completed", () => {
  const event = makeEvent(
    "evt_step_1",
    "workflow:step_completed",
    "task_1",
    '{"stepId":"step_1","status":"completed"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.deepEqual(state.completedSteps, ["step_1"]);
  assert.equal(state.eventCount, 1);
});

test("workflowRunProjectionHandler handles division:completed", () => {
  const event = makeEvent(
    "evt_div_1",
    "division:completed",
    "task_1",
    '{"divisionId":"div_1","reasonCode":"success"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "running");
  assert.equal(state.divisions.length, 1);
  assert.equal(state.divisions[0]!.divisionId, "div_1");
  assert.equal(state.divisions[0]!.status, "completed");
  assert.equal(state.divisions[0]!.reasonCode, "success");
});

test("workflowRunProjectionHandler handles division:failed", () => {
  // First, apply a division:completed to set status to running
  const completedEvent = makeEvent(
    "evt_div_1",
    "division:completed",
    "task_1",
    '{"divisionId":"div_1"}',
  );
  const stateAfterCompleted = workflowRunProjectionHandler(null, completedEvent) as unknown as WorkflowRunState;
  assert.equal(stateAfterCompleted.status, "running");

  // Now apply division:failed - status should remain running
  const failedEvent = makeEvent(
    "evt_div_fail",
    "division:failed",
    "task_1",
    '{"divisionId":"div_2","reasonCode":"error"}',
  );
  const state = workflowRunProjectionHandler(stateAfterCompleted as unknown as Record<string, unknown>, failedEvent) as unknown as WorkflowRunState;

  // Division failure doesn't immediately fail workflow - it stays running
  // because the workflow aggregates all divisions before determining final status
  assert.equal(state.status, "running");
  assert.equal(state.divisions.length, 2);
  assert.equal(state.divisions[1]!.divisionId, "div_2");
  assert.equal(state.divisions[1]!.status, "failed");
  assert.equal(state.divisions[1]!.reasonCode, "error");
});

test("workflowRunProjectionHandler handles subtask:completed", () => {
  const event = makeEvent(
    "evt_subtask_1",
    "subtask:completed",
    "task_1",
    '{"stepId":"step_sub_1","subtaskId":"subtask_1","status":"completed"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.deepEqual(state.completedSteps, ["step_sub_1"]);
  assert.equal(state.status, "running");
  assert.equal(state.eventCount, 1);
});

test("workflowRunProjectionHandler handles subtask:failed", () => {
  const event = makeEvent(
    "evt_subtask_fail",
    "subtask:failed",
    "task_1",
    '{"stepId":"step_sub_2","subtaskId":"subtask_2","reasonCode":"failed"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "failed");
  assert.ok(state.failedAt !== null);
  assert.ok(state.error !== null);
  assert.equal(state.error!.code, "failed");
  assert.equal(state.error!.failedStepId, "step_sub_2");
});

test("workflowRunProjectionHandler handles task:status_changed to completed", () => {
  const event = makeEvent(
    "evt_status",
    "task:status_changed",
    "task_1",
    '{"fromStatus":"running","toStatus":"completed","reasonCode":"done"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "completed");
  assert.ok(state.completedAt !== null);
});

test("workflowRunProjectionHandler handles task:status_changed to failed", () => {
  const event = makeEvent(
    "evt_fail",
    "task:status_changed",
    "task_1",
    '{"fromStatus":"running","toStatus":"failed","reasonCode":"error","reasonDetail":"Something went wrong"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "failed");
  assert.ok(state.failedAt !== null);
  assert.ok(state.error !== null);
  assert.equal(state.error!.code, "error");
  assert.equal(state.error!.message, "Something went wrong");
});

test("workflowRunProjectionHandler is idempotent - same event applied twice", () => {
  const event = makeEvent(
    "evt_idempotent",
    "workflow:step_completed",
    "task_1",
    '{"stepId":"step_1"}',
  );

  const state1 = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;
  const state2 = workflowRunProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as WorkflowRunState;

  // Should only count once
  assert.equal(state2.eventCount, 1);
  assert.deepEqual(state2.processedEventIds, ["evt_idempotent"]);
  assert.deepEqual(state2.completedSteps, ["step_1"]);
});

test("workflowRunProjectionHandler is replay-safe - events in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_1", "workflow:step_completed", "task_1", '{"stepId":"step_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "workflow:step_completed", "task_1", '{"stepId":"step_2"}', "2026-04-19T10:01:00.000Z"),
    makeEvent("evt_3", "division:completed", "task_1", '{"divisionId":"div_1"}', "2026-04-19T10:02:00.000Z"),
    makeEvent("evt_4", "task:status_changed", "task_1", '{"toStatus":"completed"}', "2026-04-19T10:03:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = workflowRunProjectionHandler(state, event);
  }

  const finalState = state as unknown as WorkflowRunState;
  assert.equal(finalState.eventCount, 4);
  assert.deepEqual(finalState.completedSteps, ["step_1", "step_2"]);
  assert.equal(finalState.divisions.length, 1);
  assert.equal(finalState.status, "completed");
  assert.equal(finalState.timeline.length, 4);
  assert.equal(finalState.timeline[0]!.eventId, "evt_1");
  assert.equal(finalState.timeline[3]!.eventId, "evt_4");
});

test("workflowRunProjectionHandler deduplicates event_ids", () => {
  const event = makeEvent("evt_dedup", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');

  // Apply same event 3 times
  const state1 = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;
  const state2 = workflowRunProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as WorkflowRunState;
  const state3 = workflowRunProjectionHandler(state2 as unknown as Record<string, unknown>, event) as unknown as WorkflowRunState;

  // Should only count once
  assert.equal(state3.eventCount, 1);
  assert.deepEqual(state3.processedEventIds, ["evt_dedup"]);
  assert.deepEqual(state3.completedSteps, ["step_1"]);
});

test("workflowRunProjectionHandler bounds processedEventIds with watermark eviction", () => {
  let state: Record<string, unknown> | null = null;

  for (let i = 0; i < 10_050; i += 1) {
    state = workflowRunProjectionHandler(
      state,
      makeEvent(`evt_watermark_${i}`, "workflow:step_completed", "task_1", `{"stepId":"step_${i}"}`),
    );
  }

  const finalState = state as unknown as WorkflowRunState;
  assert.equal(finalState.eventCount, 10_050);
  assert.ok(finalState.processedEventIds.length <= 10_000);
  assert.ok(finalState.processedEventIds.includes("evt_watermark_10049"));
  assert.ok(finalState.completedSteps.includes("step_10049"));
});

test("workflowRunProjectionHandler accumulates timeline in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_a", "workflow:step_completed", "task_1", '{"stepId":"step_a"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_b", "workflow:step_completed", "task_1", '{"stepId":"step_b"}', "2026-04-19T10:01:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = workflowRunProjectionHandler(state, event);
  }

  const finalState = state as unknown as WorkflowRunState;
  assert.equal(finalState.timeline.length, 2);
  assert.equal(finalState.timeline[0]!.eventId, "evt_a");
  assert.equal(finalState.timeline[1]!.eventId, "evt_b");
  assert.equal(finalState.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(finalState.lastEventAt, "2026-04-19T10:01:00.000Z");
});

test("workflowRunProjectionHandler tracks failed steps", () => {
  const event = makeEvent(
    "evt_fail_step",
    "subtask:failed",
    "task_1",
    '{"stepId":"step_bad","subtaskId":"subtask_bad","reasonCode":"error"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.deepEqual(state.failedSteps, ["step_bad"]);
  assert.equal(state.status, "failed");
});

test("createEmptyWorkflowRunState returns correct initial state", () => {
  const state = createEmptyWorkflowRunState();

  assert.equal(state.workflowId, null);
  assert.equal(state.taskId, null);
  assert.equal(state.status, "pending");
  assert.deepEqual(state.timeline, []);
  assert.deepEqual(state.completedSteps, []);
  assert.deepEqual(state.failedSteps, []);
  assert.equal(state.eventCount, 0);
  assert.deepEqual(state.processedEventIds, []);
  assert.equal(state.firstEventAt, null);
  assert.equal(state.lastEventAt, null);
  assert.equal(state.error, null);
  assert.deepEqual(state.divisions, []);
  assert.equal(state.completedAt, null);
  assert.equal(state.failedAt, null);
});

test("createWorkflowRunProjectionHandler returns handler function", () => {
  const handler = createWorkflowRunProjectionHandler();

  assert.equal(typeof handler, "function");
  const event = makeEvent("evt_test", "workflow:step_completed", "task_test", '{"stepId":"step_1"}');
  const state = handler(null, event);
  assert.equal((state as unknown as WorkflowRunState).workflowId, "task_test");
});

test("workflowRunProjectionHandler handles unknown event types gracefully", () => {
  const event = makeEvent("evt_unknown", "unknown:event_type", "task_1", '{"some":"data"}');

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  // Should still update basic tracking
  assert.equal(state.eventCount, 1);
  assert.equal(state.timeline.length, 1);
  assert.deepEqual(state.processedEventIds, ["evt_unknown"]);
});

test("workflowRunProjectionHandler extracts workflowId from payload when available", () => {
  const event = makeEvent(
    "evt_wf",
    "workflow:step_completed",
    "task_1",
    '{"workflowId":"wf_123","stepId":"step_1"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.workflowId, "wf_123");
  assert.equal(state.taskId, "task_1");
});

test("workflowRunProjectionHandler handles task:status_changed to cancelled", () => {
  const event = makeEvent(
    "evt_cancel",
    "task:status_changed",
    "task_1",
    '{"fromStatus":"running","toStatus":"cancelled"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "cancelled");
  assert.ok(state.failedAt !== null);
});

test("workflowRunProjectionHandler handles task:status_changed to paused", () => {
  const event = makeEvent(
    "evt_pause",
    "task:status_changed",
    "task_1",
    '{"fromStatus":"running","toStatus":"paused"}',
  );

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.equal(state.status, "paused");
});

test("workflowRunProjectionHandler preserves existing state when handling events", () => {
  const event1 = makeEvent("evt_1", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');
  const event2 = makeEvent("evt_2", "division:completed", "task_1", '{"divisionId":"div_1"}');

  const state1 = workflowRunProjectionHandler(null, event1) as unknown as WorkflowRunState;
  const state2 = workflowRunProjectionHandler(state1 as unknown as Record<string, unknown>, event2) as unknown as WorkflowRunState;

  // Both should be preserved
  assert.deepEqual(state2.completedSteps, ["step_1"]);
  assert.equal(state2.divisions.length, 1);
  assert.equal(state2.divisions[0]?.divisionId, "div_1");
  assert.equal(state2.eventCount, 2);
});

test("workflowRunProjectionHandler handles payload without stepId", () => {
  const event = makeEvent("evt_no_step", "workflow:step_completed", "task_1", '{"some":"data"}');

  const state = workflowRunProjectionHandler(null, event) as unknown as WorkflowRunState;

  assert.deepEqual(state.completedSteps, []);
  assert.equal(state.eventCount, 1);
  assert.equal(state.timeline[0]?.stepId, null);
});
