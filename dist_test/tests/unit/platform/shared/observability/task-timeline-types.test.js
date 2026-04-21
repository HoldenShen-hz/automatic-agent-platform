import assert from "node:assert/strict";
import test from "node:test";
test("TaskTimelineEntry structure is correct", () => {
    const entry = {
        id: "entry_123",
        kind: "event",
        occurredAt: "2026-04-14T00:00:00.000Z",
        title: "task:created",
        summary: "Task was created",
        data: {},
    };
    assert.equal(entry.id, "entry_123");
    assert.equal(entry.kind, "event");
    assert.equal(entry.title, "task:created");
});
test("TaskTimelineEntry kind accepts all valid values", () => {
    const kinds = ["event", "step_output", "approval", "artifact", "dispatch", "remote_log"];
    assert.equal(kinds.length, 6);
});
test("TaskTimelineEntry allows optional trace fields", () => {
    const entry = {
        id: "entry_123",
        kind: "remote_log",
        occurredAt: "2026-04-14T00:00:00.000Z",
        title: "remote_log:error",
        summary: "Remote error occurred",
        traceId: "trace_abc",
        spanId: "span_xyz",
        parentSpanId: "parent_span",
        correlationId: "corr_123",
        data: { workerId: "worker_1" },
    };
    assert.equal(entry.traceId, "trace_abc");
    assert.equal(entry.spanId, "span_xyz");
    assert.equal(entry.parentSpanId, "parent_span");
    assert.equal(entry.correlationId, "corr_123");
});
test("TaskTimelineEntry allows optional status field", () => {
    const entry = {
        id: "entry_123",
        kind: "dispatch",
        occurredAt: "2026-04-14T00:00:00.000Z",
        title: "dispatch:sent",
        summary: "Task dispatched to worker",
        status: "sent",
        data: {},
    };
    assert.equal(entry.status, "sent");
});
test("TaskTimelineEntry allows null for trace fields", () => {
    const entry = {
        id: "entry_123",
        kind: "event",
        occurredAt: "2026-04-14T00:00:00.000Z",
        title: "task:created",
        summary: "Task was created",
        traceId: null,
        spanId: null,
        data: {},
    };
    assert.equal(entry.traceId, null);
    assert.equal(entry.spanId, null);
});
test("TaskTimelineEntry data can contain arbitrary fields", () => {
    const entry = {
        id: "entry_123",
        kind: "step_output",
        occurredAt: "2026-04-14T00:00:00.000Z",
        title: "step:completed",
        summary: "Step completed successfully",
        data: {
            stepId: "step_1",
            toolName: "read",
            success: true,
            durationMs: 150,
            outputSize: 1024,
        },
    };
    assert.equal(entry.data["stepId"], "step_1");
    assert.equal(entry.data["toolName"], "read");
    assert.equal(entry.data["success"], true);
});
//# sourceMappingURL=task-timeline-types.test.js.map