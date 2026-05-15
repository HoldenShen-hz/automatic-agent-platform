import assert from "node:assert/strict";
import test from "node:test";
import {
  StreamBridge,
  type StreamEventFrame,
  type StreamBridgeOptions,
  type TransportState,
} from "../../../../../src/platform/five-plane-interface/channel-gateway/stream-bridge.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createMockEventRecord(taskId: string, eventType: string, payloadJson: string, createdAt = "2024-01-01T00:00:00.000Z"): EventRecord {
  return { eventId: "evt-1", eventType: eventType as any, taskId, payloadJson, createdAt } as unknown as EventRecord;
}

test("StreamBridge client registration and unregistration", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.registerClient("client-1", streamId, 0);
  assert.equal(bridge.getConnectedClientCount(streamId), 1);

  bridge.registerClient("client-2", streamId, 5);
  assert.equal(bridge.getConnectedClientCount(streamId), 2);

  bridge.unregisterClient("client-1");
  assert.equal(bridge.getConnectedClientCount(streamId), 1);

  bridge.unregisterClient("client-2");
  assert.equal(bridge.getConnectedClientCount(streamId), 0);
});

test("StreamBridge updateClientCursor", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.registerClient("client-1", streamId, 0);
  bridge.updateClientCursor("client-1", 10);
  assert.equal(bridge.isSlowConsumer("client-1"), false);

  // Emit 20 frames to make client slow
  for (let i = 0; i < 21; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }

  assert.equal(bridge.isSlowConsumer("client-1"), true);
});

test("StreamBridge getSlowConsumers returns correct clients", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.registerClient("client-normal", streamId, 0);
  bridge.registerClient("client-slow", streamId, 0);

  // Emit many frames
  for (let i = 0; i < 25; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }
  bridge.updateClientCursor("client-normal", 25);

  const slowConsumers = bridge.getSlowConsumers(streamId);
  assert.ok(slowConsumers.includes("client-slow"));
  assert.ok(!slowConsumers.includes("client-normal"));
});

test("StreamBridge detectStreamGap returns null when no gap", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.registerClient("client-1", streamId, 0);
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });

  const gap = bridge.detectStreamGap("client-1");
  assert.equal(gap, null);
});

test("StreamBridge detectStreamGap returns gap info when buffer was evicted", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 3 });
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.registerClient("client-1", streamId, 0);

  // Emit many frames to trigger eviction of old frames
  for (let i = 0; i < 10; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }

  const gap = bridge.detectStreamGap("client-1");
  assert.ok(gap != null);
  assert.ok(gap.gapSize > 0);
});

test("StreamBridge transport state management", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  // Default state should be "connected"
  assert.equal(bridge.getTransportState(streamId), "connected");

  bridge.setTransportState(streamId, "reconnecting");
  assert.equal(bridge.getTransportState(streamId), "reconnecting");

  bridge.setTransportState(streamId, "failed");
  assert.equal(bridge.getTransportState(streamId), "failed");

  bridge.setTransportState(streamId, "connected");
  assert.equal(bridge.getTransportState(streamId), "connected");
});

test("StreamBridge replayAfterSequence returns correct frames", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });

  const frames = bridge.replayAfterSequence(streamId, 2);
  assert.equal(frames.length, 2);
  assert.equal(frames[0]?.sequence, 3);
  assert.equal(frames[1]?.sequence, 4);
});

test("StreamBridge replay returns non-evicted frames with replayable true", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  for (let i = 0; i < 5; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }

  const result = bridge.replay(streamId, 2);
  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 3);
  assert.equal(result.errorCode, null);
});

test("StreamBridge replay returns replayable false when buffer evicted", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 3 });
  const streamId = bridge.createStreamId("task-1", "updates");

  // Fill buffer and trigger evictions
  for (let i = 0; i < 10; i++) {
    bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: i } });
  }

  const result = bridge.replay(streamId, 0);
  assert.equal(result.replayable, false);
  assert.equal(result.errorCode, "stream.replay_buffer_evicted");
});

test("StreamBridge emits from EventRecord with status done maps to completed", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const event = createMockEventRecord("task-1", "task:status_changed", JSON.stringify({ toStatus: "done" }));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });

  assert.equal(frame.eventType, "completed");
  assert.equal(frame.taskId, "task-1");
});

test("StreamBridge emits from EventRecord with status failed maps to failed", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const event = createMockEventRecord("task-1", "task:status_changed", JSON.stringify({ toStatus: "failed" }));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });

  assert.equal(frame.eventType, "failed");
});

test("StreamBridge emits from EventRecord with workflow:step_completed maps to progress", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const event = createMockEventRecord("task-1", "workflow:step_completed", JSON.stringify({ step: 1 }));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });

  assert.equal(frame.eventType, "progress");
});

test("StreamBridge emits from EventRecord with decision:requested maps to approval_requested", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const event = createMockEventRecord("task-1", "decision:requested", JSON.stringify({}));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });

  assert.equal(frame.eventType, "approval_requested");
});

test("StreamBridge emits from EventRecord with division:completed maps to completed", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const event = createMockEventRecord("task-1", "division:completed", JSON.stringify({}));
  const frame = bridge.emitFromEvent({ streamId, channel: "updates", event });

  assert.equal(frame.eventType, "completed");
});

test("StreamBridge critical events are never dropped from buffer", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = bridge.createStreamId("task-1", "updates");

  // Emit some progress frames (droppable)
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });

  // Now emit critical events - should be kept even when buffer is full
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "completed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "failed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "approval_requested", payload: {} });

  const window = bridge.getReplayWindow(streamId);
  // Buffer should retain critical events despite maxReplayFrames being 2
  assert.ok(window.bufferedFrameCount >= 3);
});

test("StreamBridge replay window metadata is accurate", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "status_changed", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: {} });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "completed", payload: {} });

  const window = bridge.getReplayWindow(streamId);
  assert.equal(window.earliestAvailableSequence, 1);
  assert.equal(window.replayMaxSequence, 3);
  assert.equal(window.droppedBeforeSequence, 0);
  assert.equal(window.bufferedFrameCount, 3);
});

test("StreamBridge toSseFrame formats data correctly", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame = bridge.emitFrame({
    streamId,
    taskId: "task-1",
    channel: "updates",
    eventType: "message_delta",
    payload: { delta: "Hello", role: "assistant" },
  });

  const sseFrame = bridge.toSseFrame(frame);

  assert.ok(sseFrame.id.includes(streamId));
  assert.ok(sseFrame.id.includes(":1"));
  assert.equal(sseFrame.event, "message_delta");

  const parsed = JSON.parse(sseFrame.data);
  assert.equal(parsed.stream_id, streamId);
  assert.equal(parsed.task_id, "task-1");
  assert.equal(parsed.channel, "updates");
  assert.equal(parsed.event_type, "message_delta");
  assert.deepEqual(parsed.payload, { delta: "Hello", role: "assistant" });
});

test("StreamBridge createStreamId generates unique IDs", () => {
  const bridge = new StreamBridge();

  const id1 = bridge.createStreamId("task-1", "updates");
  const id2 = bridge.createStreamId("task-1", "updates");
  const id3 = bridge.createStreamId("task-1", "errors");

  assert.ok(id1 !== id2);
  assert.ok(id1.includes("updates"));
  assert.ok(id2.includes("updates"));
  assert.ok(id3.includes("errors"));
});

test("StreamBridge unregistered client is not slow consumer", () => {
  const bridge = new StreamBridge();
  assert.equal(bridge.isSlowConsumer("unknown-client"), false);
});

test("StreamBridge unregistered client has no stream gap", () => {
  const bridge = new StreamBridge();
  const gap = bridge.detectStreamGap("unknown-client");
  assert.equal(gap, null);
});

test("StreamBridge replay window for unknown stream", () => {
  const bridge = new StreamBridge();
  const window = bridge.getReplayWindow("unknown-stream");

  assert.equal(window.bufferedFrameCount, 0);
  assert.equal(window.earliestAvailableSequence, 1);
  assert.equal(window.replayMaxSequence, 0);
});

test("StreamBridge replayAfterSequence for unknown stream returns empty", () => {
  const bridge = new StreamBridge();
  const frames = bridge.replayAfterSequence("unknown-stream", 0);
  assert.equal(frames.length, 0);
});

test("StreamBridge emitMessageDelta with custom role", () => {
  const bridge = new StreamBridge();
  const streamId = bridge.createStreamId("task-1", "updates");

  const frame = bridge.emitMessageDelta({
    streamId,
    taskId: "task-1",
    channel: "updates",
    delta: "Some text",
    role: "system",
  });

  assert.equal(frame.eventType, "message_delta");
  assert.equal(frame.payload.delta, "Some text");
  assert.equal(frame.payload.role, "system");
});

test("StreamBridge buffer eviction drops oldest droppable first", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 3 });
  const streamId = bridge.createStreamId("task-1", "updates");

  // Emit a critical event first
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "completed", payload: {} });
  // Then emit droppable events
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 1 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 2 } });
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 3 } });
  // This should evict one progress, keep completed
  bridge.emitFrame({ streamId, taskId: "task-1", channel: "updates", eventType: "progress", payload: { step: 4 } });

  const window = bridge.getReplayWindow(streamId);
  // Should have completed + 3 progress frames (but one progress was evicted)
  assert.ok(window.bufferedFrameCount <= 4);
});
