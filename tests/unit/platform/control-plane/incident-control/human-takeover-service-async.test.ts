import assert from "node:assert/strict";
import test from "node:test";

import {
  type TakeoverRequestEntry,
  type AsyncTakeoverActionType,
  type TakeoverRequestStatus,
  type TakeoverRequestPayload,
  type OpenSessionPayload,
  type CompleteTaskPayload,
  type TakeoverAckStatus,
  type TakeoverLifecycleEvent,
  type TakeoverEventPayload,
  type EscalationLevel,
  type AckResult,
  type TakeoverRequestResult,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/human-takeover-service-async.js";

import {
  TakeoverQueueManager,
  type TakeoverQueueConfig,
} from "../../../../../src/platform/five-plane-control-plane/incident-control/takeover-queue-manager.js";

// =============================================================================
// Type Tests
// =============================================================================

test("AsyncTakeoverActionType accepts all valid action types", () => {
  const types: AsyncTakeoverActionType[] = [
    "open_session",
    "modify_input",
    "switch_worker",
    "retry_execution",
    "set_current_step",
    "write_step_output",
    "skip_current_step",
    "complete_task",
    "acknowledge_takeover",
  ];
  assert.equal(types.length, 9);
});

test("TakeoverRequestStatus accepts all valid statuses", () => {
  const statuses: TakeoverRequestStatus[] = [
    "pending",
    "processing",
    "completed",
    "failed",
    "cancelled",
  ];
  assert.equal(statuses.length, 5);
});

test("EscalationLevel accepts all valid levels", () => {
  const levels: EscalationLevel[] = ["operator", "supervisor", "admin", "auto_close"];
  assert.equal(levels.length, 4);
});

test("TakeoverAckStatus structure is correct", () => {
  const status: TakeoverAckStatus = {
    sessionId: "session-1",
    acknowledgedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-01-01T00:05:00.000Z",
    status: "acknowledged",
    acknowledgedBy: "operator-1",
  };
  assert.equal(status.sessionId, "session-1");
  assert.equal(status.status, "acknowledged");
  assert.equal(status.acknowledgedBy, "operator-1");
});

test("AckResult structure is correct", () => {
  const result: AckResult = {
    sessionId: "session-1",
    acknowledged: true,
    acknowledgedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-01-01T00:05:00.000Z",
    previousStatus: "pending",
  };
  assert.equal(result.acknowledged, true);
  assert.equal(result.previousStatus, "pending");
});

test("TakeoverRequestResult structure is correct", () => {
  const result: TakeoverRequestResult = {
    requestId: "req-1",
    success: true,
    processedAt: "2024-01-01T00:00:00.000Z",
  };
  assert.equal(result.success, true);
  assert.equal(result.requestId, "req-1");
});

test("OpenSessionPayload structure is correct", () => {
  const payload: OpenSessionPayload = {
    type: "open_session",
    reasonCode: "operator_request",
    tenantId: "tenant-1",
  };
  assert.equal(payload.type, "open_session");
  assert.equal(payload.reasonCode, "operator_request");
});

test("CompleteTaskPayload structure is correct", () => {
  const payload: CompleteTaskPayload = {
    type: "complete_task",
    sessionId: "session-1",
    terminalStatus: "done",
    reasonCode: "completed",
  };
  assert.equal(payload.type, "complete_task");
  assert.equal(payload.terminalStatus, "done");
});

// =============================================================================
// TakeoverQueueManager Integration Tests
// =============================================================================

test("TakeoverQueueManager enqueue/dequeue flow", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 100,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  const entry = manager.enqueue({
    taskId: "task-1",
    operatorId: "operator-1",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  assert.ok(entry.requestId);
  assert.equal(entry.status, "pending");
  assert.equal(manager.getQueueDepth(), 1);

  // Find and process
  const found = manager.findPending(entry.requestId);
  assert.ok(found);
  assert.equal(found.taskId, "task-1");

  // Cancel
  const cancelled = manager.cancel(entry.requestId);
  assert.equal(cancelled, true);
  assert.equal(manager.getQueueDepth(), 0);
});

test("TakeoverQueueManager priority ordering", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 100,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  // Add with different priorities
  manager.enqueue({
    taskId: "low-priority",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
    priority: 10,
  });

  manager.enqueue({
    taskId: "high-priority",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
    priority: 1,
  });

  manager.enqueue({
    taskId: "medium-priority",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
    priority: 5,
  });

  const pending = manager.getPendingRequests();
  assert.equal(pending[0]?.taskId, "high-priority");
  assert.equal(pending[1]?.taskId, "medium-priority");
  assert.equal(pending[2]?.taskId, "low-priority");
});

test("TakeoverQueueManager getNextPending returns FIFO for same priority", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 100,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  manager.enqueue({
    taskId: "first",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  manager.enqueue({
    taskId: "second",
    operatorId: "op",
    reasonCode: "test",
    actionType: "modify_input",
    payload: { type: "modify_input", sessionId: "s1", inputJson: "{}", reasonCode: "test" },
  });

  const next = manager.findNextPending();
  assert.equal(next?.taskId, "first");
});

test("TakeoverQueueManager removeEntry removes specific entry", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 100,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  const entry1 = manager.enqueue({
    taskId: "task-1",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  manager.enqueue({
    taskId: "task-2",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  manager.removeEntry(entry1.requestId);

  assert.equal(manager.getQueueDepth(), 1);
  assert.equal(manager.findPending(entry1.requestId), undefined);
  assert.ok(manager.findPending(manager.getPendingRequests()[0]!.requestId));
});

test("TakeoverQueueManager cancel only works on pending requests", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 100,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  const entry = manager.enqueue({
    taskId: "task-1",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  // Mark as processing
  entry.status = "processing";

  const cancelled = manager.cancel(entry.requestId);
  assert.equal(cancelled, false);
  assert.equal(manager.getQueueDepth(), 1);
});

test("TakeoverQueueManager enqueue throws when full", () => {
  const events: Array<{ event: TakeoverLifecycleEvent; payload: unknown }> = [];
  const eventEmitter = {
    emit: <T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) => {
      events.push({ event, payload });
    },
  };

  const config: TakeoverQueueConfig = {
    maxQueueDepth: 2,
    defaultPriority: 5,
  };
  const manager = new TakeoverQueueManager(config, eventEmitter);

  manager.enqueue({
    taskId: "task-1",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  manager.enqueue({
    taskId: "task-2",
    operatorId: "op",
    reasonCode: "test",
    actionType: "open_session",
    payload: { type: "open_session", reasonCode: "test" },
  });

  assert.throws(
    () =>
      manager.enqueue({
        taskId: "task-3",
        operatorId: "op",
        reasonCode: "test",
        actionType: "open_session",
        payload: { type: "open_session", reasonCode: "test" },
      }),
    (err: any) => err.code === "takeover.queue_full",
  );
});

// =============================================================================
// Event Emission Type Coverage
// =============================================================================

test("All TakeoverLifecycleEvent types are valid", () => {
  const eventTypes: TakeoverLifecycleEvent[] = [
    "takeover:session_opened",
    "takeover:acknowledged",
    "takeover:completed",
    "takeover:timeout",
    "takeover:escalated",
    "takeover:cancelled",
    "takeover:request_enqueued",
    "takeover:request_processed",
    "takeover:ack_expired",
  ];
  assert.equal(eventTypes.length, 9);
});

test("TakeoverEventPayload has all required events", () => {
  // Verify each event type has a payload structure
  const sessionOpenedPayload: TakeoverEventPayload["takeover:session_opened"] = {
    sessionId: "s1",
    taskId: "t1",
    operatorId: "op1",
    reasonCode: "test",
    enqueuedAt: "2024-01-01T00:00:00.000Z",
  };
  assert.equal(sessionOpenedPayload.sessionId, "s1");

  const acknowledgedPayload: TakeoverEventPayload["takeover:acknowledged"] = {
    sessionId: "s1",
    taskId: "t1",
    operatorId: "op1",
    acknowledgedAt: "2024-01-01T00:00:00.000Z",
    expiresAt: "2024-01-01T00:05:00.000Z",
  };
  assert.equal(acknowledgedPayload.sessionId, "s1");

  const completedPayload: TakeoverEventPayload["takeover:completed"] = {
    sessionId: "s1",
    taskId: "t1",
    terminalStatus: "done",
    completedAt: "2024-01-01T00:10:00.000Z",
  };
  assert.equal(completedPayload.terminalStatus, "done");

  const timeoutPayload: TakeoverEventPayload["takeover:timeout"] = {
    sessionId: "s1",
    taskId: "t1",
    reason: "expired",
    timedOutAt: "2024-01-01T00:15:00.000Z",
  };
  assert.equal(timeoutPayload.reason, "expired");

  const escalatedPayload: TakeoverEventPayload["takeover:escalated"] = {
    sessionId: "s1",
    taskId: "t1",
    fromLevel: "operator",
    toLevel: "supervisor",
    reason: "timeout",
    escalatedAt: "2024-01-01T00:20:00.000Z",
  };
  assert.equal(escalatedPayload.toLevel, "supervisor");

  const cancelledPayload: TakeoverEventPayload["takeover:cancelled"] = {
    sessionId: "s1",
    taskId: "t1",
    reason: "max_escalation",
    cancelledAt: "2024-01-01T00:25:00.000Z",
  };
  assert.equal(cancelledPayload.reason, "max_escalation");

  const requestEnqueuedPayload: TakeoverEventPayload["takeover:request_enqueued"] = {
    requestId: "r1",
    taskId: "t1",
    actionType: "open_session",
    priority: 5,
  };
  assert.equal(requestEnqueuedPayload.actionType, "open_session");

  const requestProcessedPayload: TakeoverEventPayload["takeover:request_processed"] = {
    requestId: "r1",
    taskId: "t1",
    actionType: "open_session",
    success: true,
  };
  assert.equal(requestProcessedPayload.success, true);

  const ackExpiredPayload: TakeoverEventPayload["takeover:ack_expired"] = {
    sessionId: "s1",
    taskId: "t1",
    expiredAt: "2024-01-01T00:30:00.000Z",
  };
  assert.equal(ackExpiredPayload.sessionId, "s1");
});
