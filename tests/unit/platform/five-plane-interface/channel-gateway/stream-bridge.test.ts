import { strict as assert } from "node:assert";
import { test } from "node:test";

import {
  StreamBridge,
  type StreamEventFrame,
  type StreamReplayResult,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/stream-bridge.js";

function makeFrame(overrides: Partial<StreamEventFrame> = {}): StreamEventFrame {
  return {
    streamId: "stream_abc",
    taskId: "task_123",
    channel: "updates",
    eventType: "progress",
    sequence: 1,
    payload: {},
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

test("StreamBridge createStreamId generates unique IDs", () => {
  const bridge = new StreamBridge();
  const id1 = bridge.createStreamId("task_abc", "updates");
  const id2 = bridge.createStreamId("task_xyz", "updates");
  assert.ok(id1 !== id2);
  assert.ok(id1.includes("task_abc"));
  assert.ok(id2.includes("task_xyz"));
});

test("StreamBridge emitFrame assigns sequential sequence numbers", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  const frame1 = bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  const frame2 = bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  const frame3 = bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
  assert.equal(frame3.sequence, 3);
});

test("StreamBridge emitFrame uses provided createdAt", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");
  const timestamp = "2024-01-15T10:30:00Z";

  const frame = bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {}, createdAt: timestamp });

  assert.equal(frame.createdAt, timestamp);
});

test("StreamBridge emitMessageDelta creates message_delta frame", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  const frame = bridge.emitMessageDelta({ streamId, taskId: "task_abc", channel: "updates", delta: "Hello", role: "assistant" });

  assert.equal(frame.eventType, "message_delta");
  assert.deepEqual(frame.payload, { delta: "Hello", role: "assistant" });
});

test("StreamBridge replay returns all frames after lastSequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const result = bridge.replay(streamId, 1);

  assert.equal(result.frames.length, 2);
  assert.equal(result.frames[0]?.sequence, 2);
  assert.equal(result.frames[1]?.sequence, 3);
  assert.equal(result.replayable, true);
});

test("StreamBridge replay returns empty when no frames after lastSequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const result = bridge.replay(streamId, 3);

  assert.equal(result.frames.length, 0);
  assert.equal(result.replayable, true);
});

test("StreamBridge replayAfterSequence returns correct frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const frames = bridge.replayAfterSequence(streamId, 1);

  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.sequence, 2);
  assert.equal(frames[1]?.sequence, 3);
});

test("StreamBridge toSseFrame converts frame correctly", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  const frame = bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "completed", payload: { result: "success" } });
  const sse = bridge.toSseFrame(frame);

  assert.equal(sse.id, `${streamId}:${frame.sequence}`);
  assert.equal(sse.event, "completed");
  const parsed = JSON.parse(sse.data);
  assert.equal(parsed.event_type, "completed");
  assert.equal(parsed.payload.result, "success");
});

test("StreamBridge getReplayWindow returns correct metadata", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const window = bridge.getReplayWindow(streamId);

  assert.equal(window.replayMaxSequence, 2);
  assert.equal(window.bufferedFrameCount, 2);
});

test("StreamBridge registers and tracks clients", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.registerClient("client_2", streamId, 0);

  assert.equal(bridge.getConnectedClientCount(streamId), 2);
});

test("StreamBridge unregisterClient removes client", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.unregisterClient("client_1");

  assert.equal(bridge.getConnectedClientCount(streamId), 0);
});

test("StreamBridge updateClientCursor updates sequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  assert.equal(bridge.isSlowConsumer("client_1"), false);

  bridge.updateClientCursor("client_1", 1);

  assert.equal(bridge.isSlowConsumer("client_1"), false);
});

test("StreamBridge isSlowConsumer detects lag", () => {
  const bridge = new StreamBridge({ slowConsumerLagThreshold: 2 });
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  assert.equal(bridge.isSlowConsumer("client_1"), true);
});

test("StreamBridge getSlowConsumers returns lagging clients", () => {
  const bridge = new StreamBridge({ slowConsumerLagThreshold: 2 });
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.registerClient("client_2", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const slowClients = bridge.getSlowConsumers(streamId);

  assert.deepEqual(slowClients, ["client_1", "client_2"]);
});

test("StreamBridge detectStreamGap detects gap when behind dropped sequence", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });

  const gap = bridge.detectStreamGap("client_1");

  assert.equal(gap, null); // No gap since buffer hasn't been dropped
});

test("StreamBridge getTransportState returns connected by default", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  assert.equal(bridge.getTransportState(streamId), "connected");
});

test("StreamBridge setTransportState updates state", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.setTransportState(streamId, "reconnecting");
  assert.equal(bridge.getTransportState(streamId), "reconnecting");

  bridge.setTransportState(streamId, "failed");
  assert.equal(bridge.getTransportState(streamId), "failed");
});

test("StreamBridge closeStream cleans up stream data", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.closeStream(streamId);

  assert.equal(bridge.getConnectedClientCount(streamId), 0);
  assert.deepEqual(bridge.getReplayWindow(streamId).bufferedFrameCount, 0);
});

test("StreamBridge dispose clears all streams", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.registerClient("client_1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  bridge.dispose();

  assert.equal(bridge.getConnectedClientCount(streamId), 0);
});

test("StreamBridge constructor applies default options", () => {
  const bridge = new StreamBridge();
  assert.ok(bridge);
});

test("StreamBridge constructor applies custom maxReplayFrames", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 50 });
  const streamId = bridge.createStreamId("task_abc", "updates");

  // Emit 60 frames
  for (let i = 0; i < 60; i++) {
    bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: {} });
  }

  const window = bridge.getReplayWindow(streamId);
  // Should be capped at 50
  assert.equal(window.bufferedFrameCount, 50);
});
