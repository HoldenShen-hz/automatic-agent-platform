/**
 * Unit tests for StreamBridge.emitFromEvent method
 * Tests the emitFromEvent method that maps internal EventRecord to StreamEventFrame
 */

import assert from "node:assert/strict";
import test from "node:test";

import { StreamBridge } from "../../../../../../src/platform/interface/channel-gateway/stream-bridge.js";
import type { EventRecord } from "../../../../../../src/platform/contracts/types/domain/session-types.js";
import { EventTier } from "../../../../../../src/platform/contracts/types/domain/session-types.js";

function makeEventRecord(overrides: Partial<EventRecord> = {}): EventRecord {
  return {
    id: "evt_001",
    taskId: "task_abc",
    sessionId: "sess_001",
    executionId: "exec_001",
    eventType: "task:status_changed",
    eventTier: "tier_2" as EventTier,
    payloadJson: '{"toStatus":"in_progress"}',
    traceId: null,
    createdAt: "2026-04-20T10:00:00.000Z",
    ...overrides,
  };
}

test("StreamBridge.emitFromEvent maps task:status_changed to status_changed eventType", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "task:status_changed",
    payloadJson: '{"toStatus":"in_progress"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "status_changed");
  assert.equal(frame.taskId, "task_abc");
  assert.equal(frame.streamId, "stream_test");
  assert.equal(frame.channel, "updates");
});

test("StreamBridge.emitFromEvent maps task:status_changed with toStatus=done to completed", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "task:status_changed",
    payloadJson: '{"toStatus":"done"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "completed");
});

test("StreamBridge.emitFromEvent maps task:status_changed with toStatus=failed to failed", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "task:status_changed",
    payloadJson: '{"toStatus":"failed"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "failed");
});

test("StreamBridge.emitFromEvent maps workflow:step_completed to progress", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "workflow:step_completed",
    payloadJson: '{"step":"step_1","result":"ok"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "progress");
});

test("StreamBridge.emitFromEvent maps decision:requested to approval_requested", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "decision:requested",
    payloadJson: '{"approvalId":"approval_123"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "approval_requested");
});

test("StreamBridge.emitFromEvent maps division:completed to completed", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "division:completed",
    payloadJson: '{"divisionId":"div_001"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "completed");
});

test("StreamBridge.emitFromEvent maps unknown event types to progress", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "unknown:event_type",
    payloadJson: '{"data":"value"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.eventType, "progress");
});

test("StreamBridge.emitFromEvent parses payloadJson into payload", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "task:status_changed",
    payloadJson: '{"toStatus":"in_progress","reason":"manual"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.deepEqual(frame.payload, { toStatus: "in_progress", reason: "manual" });
});

test("StreamBridge.emitFromEvent uses event createdAt timestamp", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    createdAt: "2026-04-20T15:30:00.000Z",
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.createdAt, "2026-04-20T15:30:00.000Z");
});

test("StreamBridge.emitFromEvent uses unknown_task when taskId is null", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    taskId: null,
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_test",
    channel: "updates",
    event,
  });

  assert.equal(frame.taskId, "unknown_task");
});

test("StreamBridge.emitFromEvent increments sequence per stream", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_seq_test";
  const event1 = makeEventRecord({ id: "evt_001" });
  const event2 = makeEventRecord({ id: "evt_002" });

  const frame1 = bridge.emitFromEvent({ streamId, channel: "updates", event: event1 });
  const frame2 = bridge.emitFromEvent({ streamId, channel: "updates", event: event2 });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 2);
});

test("StreamBridge.emitFromEvent independent sequences per stream", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord();

  const frame1 = bridge.emitFromEvent({ streamId: "stream_A", channel: "updates", event });
  const frame2 = bridge.emitFromEvent({ streamId: "stream_B", channel: "updates", event });
  const frame3 = bridge.emitFromEvent({ streamId: "stream_A", channel: "updates", event });

  assert.equal(frame1.sequence, 1);
  assert.equal(frame2.sequence, 1);
  assert.equal(frame3.sequence, 2);
});

test("StreamBridge.emitFromEvent frames are available for replay", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_replay_test";
  const event = makeEventRecord();

  bridge.emitFromEvent({ streamId, channel: "updates", event });

  const result = bridge.replay(streamId, 0);
  assert.equal(result.replayable, true);
  assert.equal(result.frames.length, 1);
  assert.equal(result.frames[0]?.sequence, 1);
});

test("StreamBridge.emitFromEvent frames are included in replayAfterSequence", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_after_seq_test";
  const event1 = makeEventRecord({ id: "evt_001" });
  const event2 = makeEventRecord({ id: "evt_002" });

  bridge.emitFromEvent({ streamId, channel: "updates", event: event1 });
  bridge.emitFromEvent({ streamId, channel: "updates", event: event2 });

  const frames = bridge.replayAfterSequence(streamId, 1);
  assert.equal(frames.length, 1);
  assert.equal(frames[0]?.sequence, 2);
});

test("StreamBridge.emitFromEvent frames appear in getReplayWindow", () => {
  const bridge = new StreamBridge();
  const streamId = "stream_window_test";
  const event = makeEventRecord();

  bridge.emitFromEvent({ streamId, channel: "updates", event });

  const window = bridge.getReplayWindow(streamId);
  assert.equal(window.bufferedFrameCount, 1);
  assert.equal(window.replayMaxSequence, 1);
  assert.equal(window.earliestAvailableSequence, 1);
});

test("StreamBridge.emitFromEvent frames can be converted to SSE format", () => {
  const bridge = new StreamBridge();
  const event = makeEventRecord({
    eventType: "task:status_changed",
    payloadJson: '{"toStatus":"done"}',
  });

  const frame = bridge.emitFromEvent({
    streamId: "stream_sse_test",
    channel: "updates",
    event,
  });

  const sseFrame = bridge.toSseFrame(frame);
  assert.equal(sseFrame.event, "completed");
  assert.ok(sseFrame.id.includes("stream_sse_test"));
  assert.ok(sseFrame.data.includes("task_abc"));
});
