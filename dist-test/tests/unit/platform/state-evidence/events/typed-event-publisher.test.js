import assert from "node:assert/strict";
import test from "node:test";
import { TypedEventBusPublisher } from "../../../../../src/platform/state-evidence/events/typed-event-publisher.js";
// Use a simpler approach - directly test the publisher's behavior
test("TypedEventBusPublisher.publish delegates to bus.publish", () => {
    let publishCalled = false;
    let receivedInput = null;
    // Create a mock bus with Function type to avoid signature issues
    const mockBus = {
        publish: ((input) => {
            publishCalled = true;
            receivedInput = input;
        }),
    };
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
    let receivedType = undefined;
    const mockBus = {
        publish: ((input) => {
            receivedType = input.eventType;
        }),
    };
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
    let receivedTaskId = undefined;
    let receivedSessionId = undefined;
    let receivedExecutionId = undefined;
    let receivedTraceId = undefined;
    const mockBus = {
        publish: ((input) => {
            receivedTaskId = input.taskId;
            receivedSessionId = input.sessionId;
            receivedExecutionId = input.executionId;
            receivedTraceId = input.traceId;
        }),
    };
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
    let receivedTaskId = undefined;
    let receivedSessionId = undefined;
    const mockBus = {
        publish: ((input) => {
            receivedTaskId = input.taskId;
            receivedSessionId = input.sessionId;
        }),
    };
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
//# sourceMappingURL=typed-event-publisher.test.js.map