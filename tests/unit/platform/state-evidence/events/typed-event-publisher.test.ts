import assert from "node:assert/strict";
import test from "node:test";

import { TypedEventBusPublisher } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-publisher.js";
import type { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";

// Use a simpler approach - directly test the publisher's behavior
test("TypedEventBusPublisher.publish delegates to bus.publish", () => {
  let publishCalled = false;
  let receivedInput: any = null;

  // Create a mock bus with Function type to avoid signature issues
  const mockBus = {
    publish: ((input: any) => {
      publishCalled = true;
      receivedInput = input;
    }) as any,
  } as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "task:status_changed",
    payload: {
      fromStatus: "queued",
      toStatus: "in_progress",
    },
  });

  assert.equal(publishCalled, true);
  assert.equal(receivedInput.eventType, "task:status_changed");
});

test("TypedEventBusPublisher passes through event type correctly", () => {
  let receivedType: string | undefined = undefined;

  const mockBus = {
    publish: ((input: any) => {
      receivedType = input.eventType;
    }) as any,
  } as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "worker:heartbeat_recorded",
    payload: {
      workerId: "worker_1",
      executionId: null,
      occurredAt: "2024-01-01T00:00:00.000Z",
    },
  });

  assert.equal(receivedType, "worker:heartbeat_recorded");
});

test("TypedEventBusPublisher passes through optional fields", () => {
  let receivedTaskId: string | undefined = undefined;
  let receivedSessionId: string | undefined = undefined;
  let receivedExecutionId: string | undefined = undefined;
  let receivedTraceId: string | undefined = undefined;

  const mockBus = {
    publish: ((input: any) => {
      receivedTaskId = input.taskId;
      receivedSessionId = input.sessionId;
      receivedExecutionId = input.executionId;
      receivedTraceId = input.traceId;
    }) as any,
  } as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "subtask:completed",
    taskId: "task_456",
    sessionId: "session_789",
    executionId: "exec_101",
    traceId: "trace_202",
    payload: {
      subtaskId: "subtask_1",
    },
  });

  assert.equal(receivedTaskId, "task_456");
  assert.equal(receivedSessionId, "session_789");
  assert.equal(receivedExecutionId, "exec_101");
  assert.equal(receivedTraceId, "trace_202");
});

test("TypedEventBusPublisher handles missing optional fields", () => {
  let receivedTaskId: string | undefined = undefined;
  let receivedSessionId: string | undefined = undefined;

  const mockBus = {
    publish: ((input: any) => {
      receivedTaskId = input.taskId;
      receivedSessionId = input.sessionId;
    }) as any,
  } as TypedEventBus;

  const publisher = new TypedEventBusPublisher(mockBus);

  publisher.publish({
    eventType: "division:completed",
    payload: {
      divisionId: "div_123",
      workflowId: "wf_1",
      occurredAt: "2024-01-01T00:00:00.000Z",
    },
  });

  assert.equal(receivedTaskId, undefined);
  assert.equal(receivedSessionId, undefined);
});
