import test from "node:test";
import assert from "node:assert/strict";
import {
  StreamBridge,
  type StreamEventFrame,
  type StreamBridgeOptions,
  type StreamReplayResult,
} from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockEventRecord(taskId: string, eventType: string, payloadJson: string, createdAt = "2024-01-01T00:00:00.000Z"): EventRecord {
  return { eventId: "evt-1", eventType: eventType as any, taskId, payloadJson, createdAt } as unknown as EventRecord;
}

test("StreamBridge creates stream with default options", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  assert.ok(streamId.includes("updates"));
  assert.ok(streamId.includes("task-1"));
});

test("StreamBridge emits frames with auto-incrementing sequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const frame1 = bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: { status: "running" } });
  const frame2 = bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 1 } });
  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
  assert.equal(frame1.streamId, streamId);
  assert.equal(frame2.streamId, streamId);
});

test("StreamBridge emits message_delta frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const frame = bridge.emitMessageDelta({ streamId, taskId: "task-1", channel: "updates", delta: "Hello world" });
  assert.equal(frame.eventType, "message_delta");
  assert.equal(frame.payload.delta, "Hello world");
  assert.equal(frame.payload.role, "assistant");
});

test("StreamBridge replays frames after sequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });
  const frame3 = bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  assert.equal(frame3.sequence, 3);

  const result = bridge.replay(streamId, 1);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0]?.sequence, 2);
  assert.equal(result.frames[1]?.sequence, 3);
  assert.ok(result.replayable);
});

test("StreamBridge handles replay for evicted buffer", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = bridge.createStreamId("task-1", "updates");
  // Emit 5 frames - buffer will evict old ones
  for (let i = 0; i < 5; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }
  const result = bridge.replay(streamId, 0);
  assert.ok(!result.replayable);
  assert.equal(result.errorCode, "stream.replay_buffer_evicted");
});

test("StreamBridge converts frame to SSE format", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const frame = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "completed",
    payload: { result: "success" },
  });
  const sseFrame = bridge.toSseFrame(frame);
  assert.ok(sseFrame.id.includes(streamId));
  assert.equal(sseFrame.event, "completed");
  assert.ok(sseFrame.data.includes("task-1"));
});

test("StreamBridge emits from EventRecord", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const event = createMockEventRecord("task-1", "task:status_changed", JSON.stringify({ toStatus: "done" }));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });
  assert.equal(frame.eventType, "completed");
  assert.equal(frame.taskId, "task-1");
});

test("StreamBridge gets replay window metadata", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });
  const window = bridge.getReplayWindow(streamId);
  assert.equal(window.bufferedFrameCount, 2);
  assert.equal(window.earliestAvailableSequence, 1);
  assert.equal(window.replayMaxSequence, 2);
});

test("StreamBridge uses custom createdAt timestamp", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const customTime = "2024-06-15T10:30:00.000Z";
  const frame = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "status_changed",
    payload: {},
    createdAt: customTime,
  });
  assert.equal(frame.createdAt, customTime);
});

test("StreamBridge reuses streamId for multiple frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");
  const frame1 = bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  const frame2 = bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  assert.equal(frame2.sequence, frame1.sequence + 1);
});
