import assert from "node:assert/strict";
import test from "node:test";
import { workflowTimelineProjectionHandler, createEmptyWorkflowTimelineState, createWorkflowTimelineProjectionHandler, } from "../../../../../../src/platform/state-evidence/events/projections/workflow-timeline-projection.js";
/**
 * Helper to create a projection input event
 */
function makeEvent(eventId, eventType, taskId = null, payloadJson = "{}", createdAt = "2026-04-19T10:00:00.000Z") {
    return {
        eventId,
        eventType,
        taskId,
        payloadJson,
        createdAt,
    };
}
test("workflowTimelineProjectionHandler initializes state correctly", () => {
    const event = makeEvent("evt_1", "workflow:started", "task_1", '{"workflowId":"wf_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.workflowId, "wf_1");
    assert.equal(state.taskId, "task_1");
    assert.equal(state.status, "running");
    assert.equal(state.eventCount, 1);
    assert.deepEqual(state.processedEventIds, ["evt_1"]);
    assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.lastEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles workflow_run.created", () => {
    const event = makeEvent("evt_wf_created", "workflow_run.created", "task_1", '{"workflowId":"wf_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "running");
    assert.equal(state.workflowId, "wf_1");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles workflow:started", () => {
    const event = makeEvent("evt_started", "workflow:started", "task_1", '{"workflowId":"wf_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "running");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles workflow:step_completed", () => {
    const event = makeEvent("evt_step_completed", "workflow:step_completed", "task_1", '{"stepId":"step_1","status":"completed"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.completedSteps["step_1"], "2026-04-19T10:00:00.000Z");
    assert.equal(state.status, "running");
});
test("workflowTimelineProjectionHandler handles workflow:step_completed when pending", () => {
    const event = makeEvent("evt_step_pending", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "running");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles workflow:step_failed", () => {
    const event = makeEvent("evt_step_failed", "workflow:step_failed", "task_1", '{"stepId":"step_1","reasonCode":"error","errorMessage":"Step failed"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "failed");
    assert.equal(state.failedAt, "2026-04-19T10:00:00.000Z");
    assert.deepEqual(state.failedSteps, { step_1: "2026-04-19T10:00:00.000Z" });
    assert.ok(state.error !== null);
    assert.equal(state.error.code, "error");
    assert.equal(state.error.message, "Step failed");
    assert.equal(state.error.failedStepId, "step_1");
});
test("workflowTimelineProjectionHandler handles division:completed", () => {
    const event = makeEvent("evt_division_completed", "division:completed", "task_1", '{"divisionId":"div_1","reasonCode":"success"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.divisionOutcomes["div_1"].divisionId, "div_1");
    assert.equal(state.divisionOutcomes["div_1"].status, "completed");
    assert.equal(state.divisionOutcomes["div_1"].reasonCode, "success");
});
test("workflowTimelineProjectionHandler handles division:failed", () => {
    const event = makeEvent("evt_division_failed", "division:failed", "task_1", '{"divisionId":"div_1","reasonCode":"error"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.divisionOutcomes["div_1"].divisionId, "div_1");
    assert.equal(state.divisionOutcomes["div_1"].status, "failed");
    assert.equal(state.divisionOutcomes["div_1"].reasonCode, "error");
});
test("workflowTimelineProjectionHandler handles subtask:completed", () => {
    const event = makeEvent("evt_subtask_completed", "subtask:completed", "task_1", '{"stepId":"step_1","subtaskId":"subtask_1","reasonCode":"done"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.subtaskOutcomes.length, 1);
    assert.equal(state.subtaskOutcomes[0].subtaskId, "subtask_1");
    assert.equal(state.subtaskOutcomes[0].status, "completed");
    assert.equal(state.subtaskOutcomes[0].reasonCode, "done");
    assert.equal(state.completedSteps["step_1"], "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles subtask:failed", () => {
    const event = makeEvent("evt_subtask_failed", "subtask:failed", "task_1", '{"stepId":"step_1","subtaskId":"subtask_1","reasonCode":"error"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.subtaskOutcomes.length, 1);
    assert.equal(state.subtaskOutcomes[0].subtaskId, "subtask_1");
    assert.equal(state.subtaskOutcomes[0].status, "failed");
    assert.equal(state.subtaskOutcomes[0].reasonCode, "error");
});
test("workflowTimelineProjectionHandler handles task:status_changed to completed", () => {
    const event = makeEvent("evt_status_completed", "task:status_changed", "task_1", '{"fromStatus":"running","toStatus":"completed"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "completed");
    assert.equal(state.completedAt, "2026-04-19T10:00:00.000Z");
    assert.equal(state.statusTransitions.length, 1);
    assert.equal(state.statusTransitions[0].fromStatus, "running");
    assert.equal(state.statusTransitions[0].toStatus, "completed");
});
test("workflowTimelineProjectionHandler handles task:status_changed to failed", () => {
    const event = makeEvent("evt_status_failed", "task:status_changed", "task_1", '{"fromStatus":"running","toStatus":"failed","reasonCode":"error","reasonDetail":"Something went wrong"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "failed");
    assert.equal(state.failedAt, "2026-04-19T10:00:00.000Z");
    assert.ok(state.error !== null);
    assert.equal(state.error.code, "error");
    assert.equal(state.error.message, "Something went wrong");
});
test("workflowTimelineProjectionHandler handles task:status_changed to cancelled", () => {
    const event = makeEvent("evt_status_cancelled", "task:status_changed", "task_1", '{"fromStatus":"running","toStatus":"cancelled"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "cancelled");
});
test("workflowTimelineProjectionHandler handles task:status_changed to in_progress", () => {
    const event = makeEvent("evt_status_in_progress", "task:status_changed", "task_1", '{"fromStatus":"pending","toStatus":"in_progress"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "running");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles task:status_changed to running", () => {
    const event = makeEvent("evt_status_running", "task:status_changed", "task_1", '{"fromStatus":"pending","toStatus":"running"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "running");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles task:status_changed to awaiting_decision", () => {
    const event = makeEvent("evt_status_awaiting", "task:status_changed", "task_1", '{"fromStatus":"running","toStatus":"awaiting_decision"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "awaiting_decision");
});
test("workflowTimelineProjectionHandler handles workflow_run.failed", () => {
    const event = makeEvent("evt_wf_failed", "workflow_run.failed", "task_1", '{"reasonCode":"wf_error","errorMessage":"Workflow failed"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "failed");
    assert.equal(state.failedAt, "2026-04-19T10:00:00.000Z");
    assert.ok(state.error !== null);
    assert.equal(state.error.code, "wf_error");
    assert.equal(state.error.message, "Workflow failed");
});
test("workflowTimelineProjectionHandler handles workflow_run.completed", () => {
    const event = makeEvent("evt_wf_completed", "workflow_run.completed", "task_1", '{"workflowId":"wf_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "completed");
    assert.equal(state.completedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler is idempotent - same event applied twice", () => {
    const event = makeEvent("evt_idempotent", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');
    const state1 = workflowTimelineProjectionHandler(null, event);
    const state2 = workflowTimelineProjectionHandler(state1, event);
    // Should only count once
    assert.equal(state2.eventCount, 1);
    assert.deepEqual(state2.processedEventIds, ["evt_idempotent"]);
});
test("workflowTimelineProjectionHandler is replay-safe - events in order", () => {
    const events = [
        makeEvent("evt_1", "workflow:started", "task_1", '{"workflowId":"wf_1"}', "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_2", "workflow:step_completed", "task_1", '{"stepId":"step_1"}', "2026-04-19T10:01:00.000Z"),
        makeEvent("evt_3", "task:status_changed", "task_1", '{"toStatus":"completed"}', "2026-04-19T10:02:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = workflowTimelineProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.eventCount, 3);
    assert.equal(finalState.status, "completed");
    assert.equal(finalState.events.length, 3);
    assert.equal(finalState.events[0].eventId, "evt_1");
    assert.equal(finalState.events[2].eventId, "evt_3");
    assert.equal(finalState.firstEventAt, "2026-04-19T10:00:00.000Z");
    assert.equal(finalState.lastEventAt, "2026-04-19T10:02:00.000Z");
});
test("workflowTimelineProjectionHandler deduplicates event_ids", () => {
    const event = makeEvent("evt_dedup", "workflow:step_completed", "task_1", '{"stepId":"step_1"}');
    // Apply same event 3 times
    const state1 = workflowTimelineProjectionHandler(null, event);
    const state2 = workflowTimelineProjectionHandler(state1, event);
    const state3 = workflowTimelineProjectionHandler(state2, event);
    // Should only count once
    assert.equal(state3.eventCount, 1);
    assert.deepEqual(state3.processedEventIds, ["evt_dedup"]);
});
test("workflowTimelineProjectionHandler accumulates events in order", () => {
    const events = [
        makeEvent("evt_a", "workflow:step_completed", "task_1", '{"stepId":"step_a"}', "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_b", "workflow:step_completed", "task_1", '{"stepId":"step_b"}', "2026-04-19T10:01:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = workflowTimelineProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.events.length, 2);
    assert.equal(finalState.events[0].eventId, "evt_a");
    assert.equal(finalState.events[1].eventId, "evt_b");
});
test("workflowTimelineProjectionHandler extracts workflowId from workflowRunId payload", () => {
    const event = makeEvent("evt_wf_run_id", "workflow:started", "task_1", '{"workflowRunId":"run_123"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.workflowId, "run_123");
});
test("workflowTimelineProjectionHandler uses taskId when workflowId not in payload", () => {
    const event = makeEvent("evt_task_id", "workflow:started", "task_1", '{}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.workflowId, "task_1");
});
test("workflowTimelineProjectionHandler extracts executionId from payload", () => {
    const event = makeEvent("evt_exec_id", "workflow:step_completed", "task_1", '{"executionId":"exec_xyz"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.executionId, "exec_xyz");
});
test("workflowTimelineProjectionHandler handles unknown event types gracefully", () => {
    const event = makeEvent("evt_unknown", "unknown:event_type", "task_1", '{"some":"data"}');
    const state = workflowTimelineProjectionHandler(null, event);
    // Should still update basic tracking and transition from pending to running
    assert.equal(state.eventCount, 1);
    assert.equal(state.events.length, 1);
    assert.equal(state.status, "running");
    assert.equal(state.startedAt, "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler handles unknown event when not pending", () => {
    const startedEvent = makeEvent("evt_started", "workflow:started", "task_1", '{"workflowId":"wf_1"}');
    const stateAfterStarted = workflowTimelineProjectionHandler(null, startedEvent);
    assert.equal(stateAfterStarted.status, "running");
    const unknownEvent = makeEvent("evt_unknown", "unknown:event_type", "task_1", '{"some":"data"}');
    const state = workflowTimelineProjectionHandler(stateAfterStarted, unknownEvent);
    // Status should remain running, not transition again
    assert.equal(state.eventCount, 2);
    assert.equal(state.status, "running");
});
test("createEmptyWorkflowTimelineState returns correct initial state", () => {
    const state = createEmptyWorkflowTimelineState();
    assert.equal(state.workflowId, null);
    assert.equal(state.taskId, null);
    assert.equal(state.executionId, null);
    assert.equal(state.status, "pending");
    assert.deepEqual(state.events, []);
    assert.deepEqual(state.completedSteps, {});
    assert.deepEqual(state.failedSteps, {});
    assert.deepEqual(state.divisionOutcomes, {});
    assert.deepEqual(state.decisionPoints, []);
    assert.deepEqual(state.subtaskOutcomes, []);
    assert.deepEqual(state.statusTransitions, []);
    assert.equal(state.eventCount, 0);
    assert.deepEqual(state.processedEventIds, []);
    assert.equal(state.firstEventAt, null);
    assert.equal(state.lastEventAt, null);
    assert.equal(state.startedAt, null);
    assert.equal(state.completedAt, null);
    assert.equal(state.failedAt, null);
    assert.equal(state.error, null);
});
test("createWorkflowTimelineProjectionHandler returns handler function", () => {
    const handler = createWorkflowTimelineProjectionHandler();
    assert.equal(typeof handler, "function");
    const event = makeEvent("evt_test", "workflow:started", "task_test", '{"workflowId":"wf_test"}');
    const state = handler(null, event);
    assert.equal(state.workflowId, "wf_test");
});
test("workflowTimelineProjectionHandler event entry contains correct fields", () => {
    const event = makeEvent("evt_fields", "workflow:step_completed", "task_1", '{"stepId":"step_1","executionId":"exec_1"}', "2026-04-19T10:00:00.000Z");
    const state = workflowTimelineProjectionHandler(null, event);
    const entry = state.events[0];
    assert.equal(entry.eventId, "evt_fields");
    assert.equal(entry.eventType, "workflow:step_completed");
    assert.equal(entry.timestamp, "2026-04-19T10:00:00.000Z");
    assert.equal(entry.stepId, "step_1");
    assert.equal(entry.taskId, "task_1");
    assert.equal(entry.executionId, "exec_1");
});
test("workflowTimelineProjectionHandler event entry excludes traceContext from details", () => {
    const event = makeEvent("evt_trace", "workflow:step_completed", "task_1", '{"stepId":"step_1","traceContext":{"traceId":"abc"}}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.deepEqual(state.events[0].details, { stepId: "step_1" });
});
test("workflowTimelineProjectionHandler status transition entry contains correct fields", () => {
    const event = makeEvent("evt_transition", "task:status_changed", "task_1", '{"fromStatus":"running","toStatus":"completed","reasonCode":"done","actorId":"user_1"}');
    const state = workflowTimelineProjectionHandler(null, event);
    const transition = state.statusTransitions[0];
    assert.equal(transition.fromStatus, "running");
    assert.equal(transition.toStatus, "completed");
    assert.equal(transition.timestamp, "2026-04-19T10:00:00.000Z");
    assert.equal(transition.reasonCode, "done");
    assert.equal(transition.actorId, "user_1");
});
test("workflowTimelineProjectionHandler tracks multiple completed steps", () => {
    const events = [
        makeEvent("evt_1", "workflow:step_completed", "task_1", '{"stepId":"step_1"}', "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_2", "workflow:step_completed", "task_1", '{"stepId":"step_2"}', "2026-04-19T10:01:00.000Z"),
        makeEvent("evt_3", "workflow:step_completed", "task_1", '{"stepId":"step_3"}', "2026-04-19T10:02:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = workflowTimelineProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(Object.keys(finalState.completedSteps).length, 3);
    assert.equal(finalState.completedSteps["step_1"], "2026-04-19T10:00:00.000Z");
    assert.equal(finalState.completedSteps["step_2"], "2026-04-19T10:01:00.000Z");
    assert.equal(finalState.completedSteps["step_3"], "2026-04-19T10:02:00.000Z");
});
test("workflowTimelineProjectionHandler tracks multiple failed steps", () => {
    const event1 = makeEvent("evt_1", "workflow:step_failed", "task_1", '{"stepId":"step_1"}');
    const event2 = makeEvent("evt_2", "workflow:step_failed", "task_1", '{"stepId":"step_2"}');
    let state = null;
    state = workflowTimelineProjectionHandler(state, event1);
    state = workflowTimelineProjectionHandler(state, event2);
    const finalState = state;
    assert.equal(Object.keys(finalState.failedSteps).length, 2);
});
test("workflowTimelineProjectionHandler tracks multiple division outcomes", () => {
    const event1 = makeEvent("evt_1", "division:completed", "task_1", '{"divisionId":"div_1"}');
    const event2 = makeEvent("evt_2", "division:failed", "task_1", '{"divisionId":"div_2"}');
    let state = null;
    state = workflowTimelineProjectionHandler(state, event1);
    state = workflowTimelineProjectionHandler(state, event2);
    const finalState = state;
    assert.equal(finalState.divisionOutcomes["div_1"].status, "completed");
    assert.equal(finalState.divisionOutcomes["div_2"].status, "failed");
});
test("workflowTimelineProjectionHandler tracks multiple subtask outcomes", () => {
    const event1 = makeEvent("evt_1", "subtask:completed", "task_1", '{"subtaskId":"sub_1"}');
    const event2 = makeEvent("evt_2", "subtask:failed", "task_1", '{"subtaskId":"sub_2"}');
    let state = null;
    state = workflowTimelineProjectionHandler(state, event1);
    state = workflowTimelineProjectionHandler(state, event2);
    const finalState = state;
    assert.equal(finalState.subtaskOutcomes.length, 2);
    assert.equal(finalState.subtaskOutcomes[0].status, "completed");
    assert.equal(finalState.subtaskOutcomes[1].status, "failed");
});
test("workflowTimelineProjectionHandler handles step without stepId in payload", () => {
    const event = makeEvent("evt_no_step", "workflow:step_completed", "task_1", '{"some":"data"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.events[0].stepId, null);
    assert.equal(state.eventCount, 1);
});
test("workflowTimelineProjectionHandler handles invalid JSON payload gracefully", () => {
    const event = makeEvent("evt_invalid", "workflow:started", "task_1", "not valid json");
    const state = workflowTimelineProjectionHandler(null, event);
    // Should still process the event with empty details
    assert.equal(state.eventCount, 1);
    assert.equal(state.events.length, 1);
    assert.deepEqual(state.events[0].details, null);
});
test("workflowTimelineProjectionHandler preserves state across multiple events", () => {
    const events = [
        makeEvent("evt_1", "workflow:started", "task_1", '{"workflowId":"wf_1"}', "2026-04-19T10:00:00.000Z"),
        makeEvent("evt_2", "workflow:step_completed", "task_1", '{"stepId":"step_1"}', "2026-04-19T10:01:00.000Z"),
        makeEvent("evt_3", "division:completed", "task_1", '{"divisionId":"div_1"}', "2026-04-19T10:02:00.000Z"),
    ];
    let state = null;
    for (const event of events) {
        state = workflowTimelineProjectionHandler(state, event);
    }
    const finalState = state;
    assert.equal(finalState.workflowId, "wf_1");
    assert.equal(finalState.status, "running");
    assert.equal(Object.keys(finalState.completedSteps).length, 1);
    assert.equal(Object.keys(finalState.divisionOutcomes).length, 1);
    assert.equal(finalState.events.length, 3);
    assert.equal(finalState.eventCount, 3);
});
test("workflowTimelineProjectionHandler task:status_changed without fromStatus still creates transition", () => {
    const event = makeEvent("evt_partial_transition", "task:status_changed", "task_1", '{"toStatus":"completed"}');
    const state = workflowTimelineProjectionHandler(null, event);
    // Should still update status
    assert.equal(state.status, "completed");
    // But transition array should be empty since fromStatus is missing
    assert.equal(state.statusTransitions.length, 0);
});
test("workflowTimelineProjectionHandler task:status_changed without toStatus does not create transition", () => {
    const event = makeEvent("evt_no_to", "task:status_changed", "task_1", '{"fromStatus":"running"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.status, "pending");
    assert.equal(state.statusTransitions.length, 0);
});
test("workflowTimelineProjectionHandler division without divisionId does not create outcome", () => {
    const event = makeEvent("evt_no_division_id", "division:completed", "task_1", '{"some":"data"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.deepEqual(state.divisionOutcomes, {});
});
test("workflowTimelineProjectionHandler subtask:completed marks step as completed", () => {
    const event = makeEvent("evt_subtask_mark", "subtask:completed", "task_1", '{"stepId":"step_x","subtaskId":"sub_x"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.completedSteps["step_x"], "2026-04-19T10:00:00.000Z");
});
test("workflowTimelineProjectionHandler subtask:failed does not mark step as completed", () => {
    const event = makeEvent("evt_subtask_fail_mark", "subtask:failed", "task_1", '{"stepId":"step_y","subtaskId":"sub_y"}');
    const state = workflowTimelineProjectionHandler(null, event);
    assert.equal(state.completedSteps["step_y"], undefined);
});
//# sourceMappingURL=workflow-timeline-projection.test.js.map