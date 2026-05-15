/**
 * Unit tests for ApprovalQueueProjection
 *
 * Tests projection state management for approval queue events.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  approvalQueueProjectionHandler,
  createEmptyApprovalQueueState,
  createApprovalQueueProjectionHandler,
  type ApprovalQueueState,
  type ApprovalQueueStatus,
} from "../../../../../../src/platform/five-plane-state-evidence/events/projections/approval-queue-projection.js";
import type { ProjectionInputEvent } from "../../../../../../src/platform/five-plane-state-evidence/projections/projection-rebuild-service.js";

function makeEvent(
  eventId: string,
  eventType: string,
  taskId: string | null = null,
  payloadJson: string = "{}",
  createdAt: string = "2026-04-19T10:00:00.000Z",
): ProjectionInputEvent {
  return { eventId, eventType, taskId, payloadJson, createdAt };
}

test("createEmptyApprovalQueueState returns correct initial state", () => {
  const state = createEmptyApprovalQueueState();

  assert.equal(state.approvalId, null);
  assert.equal(state.taskId, null);
  assert.equal(state.executionId, null);
  assert.equal(state.status, "requested");
  assert.equal(state.riskLevel, null);
  assert.equal(state.approvalsReceived, 0);
  assert.equal(state.approvalsRequired, 1);
  assert.equal(state.rejectionsReceived, 0);
  assert.equal(state.respondedBy, null);
  assert.equal(state.createdAt, null);
  assert.equal(state.respondedAt, null);
  assert.deepEqual(state.timeline, []);
  assert.equal(state.eventCount, 0);
  assert.deepEqual(state.processedEventIds, []);
  assert.equal(state.firstEventAt, null);
  assert.equal(state.lastEventAt, null);
  assert.equal(state.decisionType, null);
  assert.equal(state.selectedOptionId, null);
  assert.equal(state.inputText, null);
  assert.equal(state.cascadeDeny, false);
});

test("approvalQueueProjectionHandler handles decision:requested", () => {
  const payload = {
    approvalId: "approval_123",
    riskLevel: "high",
    context: { originalRequiredApprovals: 3 },
  };
  const event = makeEvent("evt_req", "decision:requested", "task_approval_1", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.approvalId, "approval_123");
  assert.equal(state.status, "requested");
  assert.equal(state.riskLevel, "high");
  assert.equal(state.approvalsRequired, 3);
  assert.equal(state.firstEventAt, "2026-04-19T10:00:00.000Z");
  assert.equal(state.eventCount, 1);
});

test("approvalQueueProjectionHandler handles decision:responded with confirmed", () => {
  const payload = {
    approvalId: "approval_confirm",
    decisionType: "confirmed",
    respondedBy: "user_1",
    selectedOptionId: "option_a",
  };
  const event = makeEvent("evt_confirm", "decision:responded", "task_confirm", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "confirmed");
  assert.equal(state.approvalsReceived, 1);
  assert.equal(state.respondedBy, "user_1");
  assert.equal(state.decisionType, "confirmed");
  assert.equal(state.selectedOptionId, "option_a");
});

test("approvalQueueProjectionHandler handles decision:responded with rejected", () => {
  const payload = {
    approvalId: "approval_reject",
    decisionType: "rejected",
    respondedBy: "user_2",
  };
  const event = makeEvent("evt_reject", "decision:responded", "task_reject", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "rejected");
  assert.equal(state.rejectionsReceived, 1);
});

test("approvalQueueProjectionHandler handles decision:responded with text_input", () => {
  const payload = {
    approvalId: "approval_text",
    decisionType: "text_input",
    inputText: "User provided text response",
  };
  const event = makeEvent("evt_text", "decision:responded", "task_text", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "text_input");
  assert.equal(state.inputText, "User provided text response");
});

test("approvalQueueProjectionHandler handles decision:partial_approval", () => {
  const payload = {
    approvalId: "approval_partial",
    approvalsReceived: 2,
    requiredApprovals: 3,
  };
  const event = makeEvent("evt_partial", "decision:partial_approval", "task_partial", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "requested");
  assert.equal(state.approvalsReceived, 2);
  assert.equal(state.approvalsRequired, 3);
});

test("approvalQueueProjectionHandler handles decision:approved (multi-party final)", () => {
  const payload = {
    approvalId: "approval_final",
    respondedBy: "approver_final",
  };
  const event = makeEvent("evt_approved", "decision:approved", "task_approved", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "confirmed");
  assert.equal(state.decisionType, "approved");
  assert.equal(state.respondedBy, "approver_final");
});

test("approvalQueueProjectionHandler handles decision:rejected (multi-party final)", () => {
  const payload = {
    approvalId: "approval_denied",
    respondedBy: "approver_denied",
  };
  const event = makeEvent("evt_denied", "decision:rejected", "task_denied", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.status, "rejected");
  assert.equal(state.decisionType, "rejected");
});

test("approvalQueueProjectionHandler handles cascade denial", () => {
  const payload = {
    approvalId: "approval_cascade",
    cascadeDeny: true,
    cascadeSourceApprovalId: "source_approval_123",
    cascadeSessionId: "session_abc",
  };
  const event = makeEvent("evt_cascade", "decision:responded", "task_cascade", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.cascadeDeny, true);
  assert.equal(state.cascadeSourceApprovalId, "source_approval_123");
  assert.equal(state.cascadeSessionId, "session_abc");
});

test("approvalQueueProjectionHandler is idempotent - same event applied twice", () => {
  const event = makeEvent("evt_idem", "decision:requested", "task_idem", '{"approvalId":"idempotent_1"}');

  const state1 = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;
  const state2 = approvalQueueProjectionHandler(state1 as unknown as Record<string, unknown>, event) as unknown as ApprovalQueueState;

  assert.equal(state2.eventCount, 1);
  assert.deepEqual(state2.processedEventIds, ["evt_idem"]);
});

test("approvalQueueProjectionHandler builds timeline in order", () => {
  const events: ProjectionInputEvent[] = [
    makeEvent("evt_1", "decision:requested", "task_timeline", '{"approvalId":"timeline_1"}', "2026-04-19T10:00:00.000Z"),
    makeEvent("evt_2", "decision:responded", "task_timeline", '{"decisionType":"confirmed"}', "2026-04-19T10:01:00.000Z"),
  ];

  let state: Record<string, unknown> | null = null;
  for (const event of events) {
    state = approvalQueueProjectionHandler(state, event);
  }

  const finalState = state as unknown as ApprovalQueueState;
  assert.equal(finalState.timeline.length, 2);
  assert.equal(finalState.timeline[0]!.eventId, "evt_1");
  assert.equal(finalState.timeline[1]!.eventId, "evt_2");
  assert.equal(finalState.eventCount, 2);
});

test("approvalQueueProjectionHandler extracts executionId from payload", () => {
  const payload = { approvalId: "exec_approval", executionId: "exec_from_payload" };
  const event = makeEvent("evt_exec", "decision:requested", "task_exec", JSON.stringify(payload));

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.executionId, "exec_from_payload");
});

test("approvalQueueProjectionHandler handles unknown event types gracefully", () => {
  const event = makeEvent("evt_unknown", "unknown:event", "task_unknown", '{"some":"data"}');

  const state = approvalQueueProjectionHandler(null, event) as unknown as ApprovalQueueState;

  assert.equal(state.eventCount, 1);
  assert.equal(state.timeline.length, 1);
  assert.deepEqual(state.processedEventIds, ["evt_unknown"]);
});

test("createApprovalQueueProjectionHandler returns handler function", () => {
  const handler = createApprovalQueueProjectionHandler();

  assert.equal(typeof handler, "function");
  const event = makeEvent("evt_test", "decision:requested", "task_test", '{"approvalId":"test_handler"}');
  const state = handler(null, event);
  assert.equal((state as unknown as ApprovalQueueState).approvalId, "test_handler");
});