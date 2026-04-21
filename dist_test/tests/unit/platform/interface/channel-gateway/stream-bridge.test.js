import test from "node:test";
import assert from "node:assert/strict";
import { StreamBridge } from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
test("stream bridge emits monotonic sequence and supports replay", () => {
    const bridge = new StreamBridge();
    const streamId = bridge.createStreamId("task-1", "cli");
    const frame1 = bridge.emitFromEvent({
        streamId,
        channel: "cli",
        event: {
            id: "evt-1",
            taskId: "task-1",
            sessionId: null,
            executionId: "exec-1",
            eventType: "task:status_changed",
            eventTier: "tier_1",
            payloadJson: JSON.stringify({ toStatus: "in_progress" }),
            traceId: "trace-1",
            createdAt: new Date().toISOString(),
        },
    });
    const frame2 = bridge.emitFromEvent({
        streamId,
        channel: "cli",
        event: {
            id: "evt-2",
            taskId: "task-1",
            sessionId: null,
            executionId: "exec-1",
            eventType: "workflow:step_completed",
            eventTier: "tier_1",
            payloadJson: JSON.stringify({ stepId: "analyze_request" }),
            traceId: "trace-1",
            createdAt: new Date().toISOString(),
        },
    });
    assert.equal(frame1.sequence, 1);
    assert.equal(frame2.sequence, 2);
    assert.deepEqual(bridge.replayAfterSequence(streamId, 1).map((frame) => frame.sequence), [2]);
});
test("stream bridge emits message deltas and serializes SSE frames", () => {
    const bridge = new StreamBridge();
    const streamId = bridge.createStreamId("task-delta", "cli");
    const frame = bridge.emitMessageDelta({
        streamId,
        taskId: "task-delta",
        channel: "cli",
        delta: "partial answer",
    });
    assert.equal(frame.eventType, "message_delta");
    assert.equal(frame.sequence, 1);
    const sse = bridge.toSseFrame(frame);
    assert.equal(sse.id, `${streamId}:1`);
    assert.equal(sse.event, "message_delta");
    assert.match(sse.data, /"event_type":"message_delta"/);
});
test("stream bridge reports replay buffer eviction while preserving terminal frames", () => {
    const bridge = new StreamBridge({ maxReplayFrames: 3 });
    const streamId = bridge.createStreamId("task-replay", "cli");
    bridge.emitMessageDelta({ streamId, taskId: "task-replay", channel: "cli", delta: "chunk-1" });
    bridge.emitMessageDelta({ streamId, taskId: "task-replay", channel: "cli", delta: "chunk-2" });
    bridge.emitMessageDelta({ streamId, taskId: "task-replay", channel: "cli", delta: "chunk-3" });
    bridge.emitFrame({
        streamId,
        taskId: "task-replay",
        channel: "cli",
        eventType: "completed",
        payload: { status: "done" },
    });
    const replay = bridge.replay(streamId, 0);
    const window = bridge.getReplayWindow(streamId);
    assert.equal(replay.replayable, false);
    assert.equal(replay.errorCode, "stream.replay_buffer_evicted");
    assert.equal(window.bufferedFrameCount, 3);
    assert.equal(window.droppedBeforeSequence >= 1, true);
    assert.equal(bridge.replayAfterSequence(streamId, window.earliestAvailableSequence - 1).at(-1)?.eventType, "completed");
});
//# sourceMappingURL=stream-bridge.test.js.map