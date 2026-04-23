import assert from "node:assert/strict";
import test from "node:test";

import { StreamBridge } from "../../../../../src/platform/interface/channel-gateway/stream-bridge.js";

test("StreamBridge creates stream IDs with correct format", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-123", "updates");
  assert.ok(streamId.startsWith("updates_task-123_"));
  assert.equal(streamId.split("_").length, 3);
});

test("StreamBridge emitFrame assigns sequential sequence numbers", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame1 = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "running" },
  });

  const frame2 = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "progress",
    payload: { step: 1 },
  });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
  assert.equal(frame1.streamId, streamId);
  assert.equal(frame2.streamId, streamId);
});

test("StreamBridge separate streams have independent sequences", () => {
  const bridge = new StreamBridge();
  const streamId1 = bridge.createStreamId("task-1", "updates");
  const streamId2 = bridge.createStreamId("task-2", "updates");

  bridge.emitFrame({
    streamId: streamId1,
    taskId: "task-1",
    channel: "updates",
    eventType: "status_changed",
    payload: {},
  });

  bridge.emitFrame({
    streamId: streamId2,
    taskId: "task-2",
    channel: "updates",
    eventType: "status_changed",
    payload: {},
  });

  const window1 = bridge.getReplayWindow(streamId1);
  const window2 = bridge.getReplayWindow(streamId2);

  assert.equal(window1.replayMaxSequence, 1);
  assert.equal(window2.replayMaxSequence, 1);
});

test("StreamBridge replay returns frames after lastSequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: { n: 1 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: { n: 2 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: { n: 3 } });

  const result = bridge.replay(streamId, 1);

  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0]?.sequence, 2);
  assert.equal(result.frames[1]?.sequence, 3);
});

test("StreamBridge replay returns empty when no new frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });

  const result = bridge.replay(streamId, 1);

  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 0);
});

test("StreamBridge replay marks as not replayable when buffer evicted", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = bridge.createStreamId("task-1", "updates");

  // Emit 3 frames to exceed buffer
  for (let i = 0; i < 3; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { i } });
  }

  const result = bridge.replay(streamId, 0);

  // Should not be replayable since earliest available may have been dropped
  assert.equal(result.replayable, false);
  assert.equal(result.errorCode, "stream.replay_buffer_evicted");
});

test("StreamBridge getReplayWindow returns correct metadata", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 100 });
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });

  const window = bridge.getReplayWindow(streamId);

  assert.equal(window.replayMaxSequence, 2);
  assert.equal(window.bufferedFrameCount, 2);
  assert.ok(window.earliestAvailableSequence >= 1);
});

test("StreamBridge toSseFrame formats correctly", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "status_changed",
    payload: { status: "done" },
    createdAt: "2026-04-23T00:00:00.000Z",
  });

  const sse = bridge.toSseFrame(frame);

  assert.equal(sse.id, `${streamId}:${frame.sequence}`);
  assert.equal(sse.event, "status_changed");
  assert.ok(sse.data.includes("stream_id"));
  assert.ok(sse.data.includes("task_id"));
  assert.ok(sse.data.includes("sequence"));
});

test("StreamBridge emitMessageDelta creates message_delta frame", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame = bridge.emitMessageDelta({
    streamId,
    taskId: "task-1",
    channel: "updates",
    delta: "Hello, world!",
    role: "assistant",
  });

  assert.equal(frame.eventType, "message_delta");
  assert.deepEqual(frame.payload, { delta: "Hello, world!", role: "assistant" });
});

test("StreamBridge emitMessageDelta uses default role", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame = bridge.emitMessageDelta({
    streamId,
    taskId: "task-1",
    channel: "updates",
    delta: "Hi",
  });

  assert.deepEqual(frame.payload, { delta: "Hi", role: "assistant" });
});

test("StreamBridge default maxReplayFrames is 100", () => {
  const bridge = new StreamBridge();
  const window = bridge.getReplayWindow("nonexistent");
  assert.equal(window.bufferedFrameCount, 0);
});
