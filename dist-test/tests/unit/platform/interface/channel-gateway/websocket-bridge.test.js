import assert from "node:assert/strict";
import test from "node:test";
test("WebSocketMessageType - ping message", () => {
    const msg = { type: "ping" };
    assert.equal(msg.type, "ping");
});
test("WebSocketMessageType - pong message", () => {
    const msg = { type: "pong" };
    assert.equal(msg.type, "pong");
});
test("WebSocketMessageType - subscribe message", () => {
    const msg = { type: "subscribe", taskId: "task-123" };
    assert.equal(msg.type, "subscribe");
    assert.equal(msg.taskId, "task-123");
});
test("WebSocketMessageType - unsubscribe message", () => {
    const msg = { type: "unsubscribe", taskId: "task-123" };
    assert.equal(msg.type, "unsubscribe");
    assert.equal(msg.taskId, "task-123");
});
test("WebSocketMessageType - subscribed acknowledgement", () => {
    const msg = { type: "subscribed", taskId: "task-123" };
    assert.equal(msg.type, "subscribed");
    assert.equal(msg.taskId, "task-123");
});
test("WebSocketMessageType - unsubscribed acknowledgement", () => {
    const msg = { type: "unsubscribed", taskId: "task-123" };
    assert.equal(msg.type, "unsubscribed");
    assert.equal(msg.taskId, "task-123");
});
test("WebSocketMessageType - error message", () => {
    const msg = { type: "error", code: "test_error", message: "Test error" };
    assert.equal(msg.type, "error");
    assert.equal(msg.code, "test_error");
    assert.equal(msg.message, "Test error");
});
test("WebSocketMessageType - task_update message", () => {
    const event = {
        eventType: "status_changed",
        taskId: "task-123",
        status: "completed",
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    const msg = { type: "task_update", taskId: "task-123", event };
    assert.equal(msg.type, "task_update");
    assert.equal(msg.taskId, "task-123");
    assert.equal(msg.event.eventType, "status_changed");
});
test("TaskWebSocketEvent - status_changed variant", () => {
    const event = {
        eventType: "status_changed",
        taskId: "task-123",
        status: "in_progress",
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "status_changed");
    assert.equal(event.taskId, "task-123");
    assert.equal(event.status, "in_progress");
});
test("TaskWebSocketEvent - progress variant", () => {
    const event = {
        eventType: "progress",
        taskId: "task-123",
        progress: 50,
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "progress");
    assert.equal(event.progress, 50);
});
test("TaskWebSocketEvent - completed variant", () => {
    const event = {
        eventType: "completed",
        taskId: "task-123",
        result: { output: "done" },
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "completed");
    assert.deepEqual(event.result, { output: "done" });
});
test("TaskWebSocketEvent - failed variant", () => {
    const event = {
        eventType: "failed",
        taskId: "task-123",
        error: "Something went wrong",
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "failed");
    assert.equal(event.error, "Something went wrong");
});
test("TaskWebSocketEvent - message_delta variant", () => {
    const event = {
        eventType: "message_delta",
        taskId: "task-123",
        delta: { content: "Hello" },
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "message_delta");
    assert.deepEqual(event.delta, { content: "Hello" });
});
test("TaskWebSocketEvent - artifact_ready variant", () => {
    const event = {
        eventType: "artifact_ready",
        taskId: "task-123",
        artifactId: "artifact-456",
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "artifact_ready");
    assert.equal(event.artifactId, "artifact-456");
});
test("TaskWebSocketEvent - approval_requested variant", () => {
    const event = {
        eventType: "approval_requested",
        taskId: "task-123",
        approvalId: "approval-789",
        timestamp: "2026-04-15T00:00:00.000Z",
    };
    assert.equal(event.eventType, "approval_requested");
    assert.equal(event.approvalId, "approval-789");
});
//# sourceMappingURL=websocket-bridge.test.js.map