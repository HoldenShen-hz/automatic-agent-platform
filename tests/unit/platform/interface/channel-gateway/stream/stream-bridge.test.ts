import assert from "node:assert/strict";
import test from "node:test";

import type {
  StreamChannel,
  StreamEvent,
  StreamEventFrame,
  StreamBridgeOptions,
  StreamReplayWindow,
  StreamReplayResult,
  SseFrame,
  ProgressChunk,
  FinalChunk,
  ErrorChunk,
} from "../../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
import { StreamBridge } from "../../../../../../src/platform/interface/channel-gateway/stream-bridge.js";

test("StreamEventFrame structure", () => {
  const frame: StreamEventFrame = {
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "updates",
    eventType: "status_changed",
    sequence: 1,
    payload: { toStatus: "in_progress" },
    createdAt: "2026-04-14T00:00:00.000Z",
  };

  assert.equal(frame.streamId, "stream_abc");
  assert.equal(frame.taskId, "task_123");
  assert.equal(frame.channel, "updates");
  assert.equal(frame.eventType, "status_changed");
  assert.equal(frame.sequence, 1);
  assert.equal(frame.createdAt, "2026-04-14T00:00:00.000Z");
});

test("StreamEventFrame eventType includes all variants", () => {
  const eventTypes: StreamEventFrame["eventType"][] = [
    "status_changed",
    "progress",
    "message_delta",
    "artifact_ready",
    "approval_requested",
    "completed",
    "failed",
    "stream_gap",
  ];

  for (const eventType of eventTypes) {
    const frame: StreamEventFrame = {
      streamId: "stream_abc",
      taskId: "task_123",
      channel: "updates",
      eventType,
      sequence: 1,
      payload: {},
      createdAt: "2026-04-14T00:00:00.000Z",
    };
    assert.ok(frame.eventType === eventType);
  }
});

test("gateway streaming compatibility aliases remain available", () => {
  const channel: StreamChannel = "updates";
  const event: StreamEvent = {
    streamId: "stream_compat",
    taskId: "task_compat",
    channel,
    eventType: "progress",
    sequence: 1,
    payload: {},
    createdAt: "2026-04-14T00:00:00.000Z",
  };
  const progress: ProgressChunk = { ...event, eventType: "progress" };
  const finalChunk: FinalChunk = { ...event, eventType: "completed" };
  const errorChunk: ErrorChunk = { ...event, eventType: "failed" };

  assert.equal(progress.channel, "updates");
  assert.equal(finalChunk.eventType, "completed");
  assert.equal(errorChunk.eventType, "failed");
});

test("StreamBridgeOptions structure with optional maxReplayFrames", () => {
  const options: StreamBridgeOptions = {
    maxReplayFrames: 50,
  };

  assert.equal(options.maxReplayFrames, 50);
});

test("StreamBridgeOptions allows empty options", () => {
  const options: StreamBridgeOptions = {};
  assert.equal(options.maxReplayFrames, undefined);
});

test("StreamReplayWindow structure", () => {
  const window: StreamReplayWindow = {
    earliestAvailableSequence: 1,
    replayMaxSequence: 100,
    droppedBeforeSequence: 0,
    bufferedFrameCount: 50,
  };

  assert.equal(window.earliestAvailableSequence, 1);
  assert.equal(window.replayMaxSequence, 100);
  assert.equal(window.droppedBeforeSequence, 0);
  assert.equal(window.bufferedFrameCount, 50);
});

test("StreamReplayResult structure with replayable true", () => {
  const result: StreamReplayResult = {
    replayable: true,
    frames: [
      {
        streamId: "stream_abc",
        taskId: "task_123",
        channel: "updates",
        eventType: "progress",
        sequence: 2,
        payload: {},
        createdAt: "2026-04-14T00:00:01.000Z",
      },
    ],
    replayMaxSequence: 5,
    earliestAvailableSequence: 1,
    droppedBeforeSequence: 0,
    errorCode: null,
  };

  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 1);
  assert.equal(result.replayMaxSequence, 5);
  assert.equal(result.errorCode, null);
});

test("StreamReplayResult structure with replayable false", () => {
  const result: StreamReplayResult = {
    replayable: false,
    frames: [],
    replayMaxSequence: 200,
    earliestAvailableSequence: 150,
    droppedBeforeSequence: 149,
    errorCode: "stream.replay_buffer_evicted",
  };

  assert.equal(result.replayable, false);
  assert.equal(result.frames.length, 0);
  assert.equal(result.errorCode, "stream.replay_buffer_evicted");
});

test("SseFrame structure", () => {
  const frame: SseFrame = {
    id: "stream_abc:5",
    event: "status_changed",
    data: '{"stream_id":"stream_abc","sequence":5}',
  };

  assert.equal(frame.event, "status_changed");
  assert.equal(frame.data, '{"stream_id":"stream_abc","sequence":5}');
  assert.equal(frame.id, "stream_abc:5");
});

test("SseFrame event matches StreamEventFrame eventType", () => {
  const frame: SseFrame = {
    id: "stream_abc:1",
    event: "completed",
    data: "{}",
  };

  assert.equal(frame.event, "completed");
});

// StreamBridge class tests

test("StreamBridge creates instance with default options", () => {
  const bridge = new StreamBridge();
  assert.ok(bridge instanceof StreamBridge);
});

test("StreamBridge creates instance with custom maxReplayFrames", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 50 });
  assert.ok(bridge instanceof StreamBridge);
});

test("StreamBridge.createStreamId returns a string with channel and taskId", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_123", "updates");

  assert.ok(typeof streamId === "string");
  assert.ok(streamId.includes("updates"));
  assert.ok(streamId.includes("task_123"));
});

test("StreamBridge.emitFrame returns frame with sequence 1 for new stream", () => {
  const bridge = new StreamBridge();
  const frame = bridge.emitFrame({
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "updates",
    eventType: "status_changed",
    payload: { toStatus: "in_progress" },
  });

  assert.equal(frame.sequence, 1);
  assert.equal(frame.streamId, "stream_abc");
  assert.equal(frame.taskId, "task_123");
  assert.equal(frame.eventType, "status_changed");
});

test("StreamBridge.emitFrame increments sequence for same stream", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_abc";

  const frame1 = bridge.emitFrame({
    streamId,
    taskId: "task_123",
    channel: "updates",
    eventType: "status_changed",
    payload: {},
  });

  const frame2 = bridge.emitFrame({
    streamId,
    taskId: "task_123",
    channel: "updates",
    eventType: "progress",
    payload: {},
  });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
});

test("StreamBridge.emitFrame uses provided createdAt", () => {
  const bridge = new StreamBridge();
  const createdAt = "2026-04-14T12:00:00.000Z";

  const frame = bridge.emitFrame({
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "updates",
    eventType: "progress",
    payload: {},
    createdAt,
  });

  assert.equal(frame.createdAt, createdAt);
});

test("StreamBridge.emitMessageDelta emits message_delta frame", () => {
  const bridge = new StreamBridge();

  const frame = bridge.emitMessageDelta({
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "output",
    delta: "Hello, world!",
  });

  assert.equal(frame.eventType, "message_delta");
  assert.equal(frame.payload["delta"], "Hello, world!");
  assert.equal(frame.payload["role"], "assistant");
});

test("StreamBridge.emitMessageDelta uses provided role", () => {
  const bridge = new StreamBridge();

  const frame = bridge.emitMessageDelta({
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "output",
    delta: "System message",
    role: "system",
  });

  assert.equal(frame.payload["role"], "system");
});

test("StreamBridge.replay returns empty frames for new stream", () => {
  const bridge = new StreamBridge();
  const result = bridge.replay("stream_abc", 0);

  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 0);
  assert.equal(result.replayMaxSequence, 0);
  assert.equal(result.errorCode, null);
});

test("StreamBridge.replay returns frames after lastSequence", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_abc";

  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });

  const result = bridge.replay(streamId, 1);

  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0]?.sequence, 2);
  assert.equal(result.frames[1]?.sequence, 3);
});

test("StreamBridge.replay returns replayable=false when buffer evicted", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = "stream_abc";

  // Emit 3 status_changed frames (all droppable), buffer holds only 2
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "status_changed", payload: {} });

  // Request replay from sequence 0 (before any dropped frames)
  const result = bridge.replay(streamId, 0);
  assert.equal(result.replayable, false);
  assert.equal(result.errorCode, "stream.replay_buffer_evicted");
});

test("StreamBridge.getReplayWindow returns correct window for empty stream", () => {
  const bridge = new StreamBridge();
  const window = bridge.getReplayWindow("stream_new");

  assert.equal(window.replayMaxSequence, 0);
  assert.equal(window.droppedBeforeSequence, 0);
  assert.equal(window.bufferedFrameCount, 0);
});

test("StreamBridge.getReplayWindow returns correct window after emitting frames", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_abc";

  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });

  const window = bridge.getReplayWindow(streamId);
  assert.equal(window.replayMaxSequence, 2);
  assert.equal(window.bufferedFrameCount, 2);
  assert.equal(window.droppedBeforeSequence, 0);
  assert.equal(window.earliestAvailableSequence, 1);
});

test("StreamBridge.replayAfterSequence returns matching frames", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_abc";

  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "completed", payload: {} });

  const frames = bridge.replayAfterSequence(streamId, 1);
  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.sequence, 2);
  assert.equal(frames[1]?.sequence, 3);
});

test("StreamBridge.toSseFrame converts frame to SSE format", () => {
  const bridge = new StreamBridge();

  const frame = bridge.emitFrame({
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "updates",
    eventType: "completed",
    payload: { result: "done" },
  });

  const sseFrame = bridge.toSseFrame(frame);
  assert.equal(sseFrame.id, "stream_abc:1");
  assert.equal(sseFrame.event, "completed");
  assert.ok(typeof sseFrame.data === "string");

  const parsedData = JSON.parse(sseFrame.data) as Record<string, unknown>;
  assert.equal(parsedData["stream_id"], "stream_abc");
  assert.equal(parsedData["task_id"], "task_123");
  assert.equal(parsedData["event_type"], "completed");
  assert.equal(parsedData["sequence"], 1);
});

test("StreamBridge sequences are independent per stream", () => {
  const bridge = new StreamBridge();

  const frame1 = bridge.emitFrame({ streamId: "stream_A", taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });
  const frame2 = bridge.emitFrame({ streamId: "stream_B", taskId: "task_2", channel: "updates", eventType: "progress", payload: {} });
  const frame3 = bridge.emitFrame({ streamId: "stream_A", taskId: "task_1", channel: "updates", eventType: "progress", payload: {} });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 1);
  assert.equal(frame3.sequence, 2);
});

test("StreamBridge retains critical frames when buffer full", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = "stream_abc";

  // Emit: status_changed (droppable), completed (critical), status_changed (droppable)
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "completed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_1", channel: "updates", eventType: "status_changed", payload: {} });

  const window = bridge.getReplayWindow(streamId);
  // Buffer should retain 2 frames; the first droppable was evicted
  assert.equal(window.bufferedFrameCount, 2);

  const frames = bridge.replayAfterSequence(streamId, 0);
  // completed (critical) should be retained
  const hasCompleted = frames.some((f) => f.eventType === "completed");
  assert.ok(hasCompleted, "completed frame should be retained in buffer");
});
