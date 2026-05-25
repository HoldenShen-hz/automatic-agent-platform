import { strict as assert } from "node:assert";
import { test } from "node:test";

import { StreamBridge } from "../../../../../src/platform/five-plane-interface/channel-gateway/stream-bridge.js";

test("StreamBridge replay buffer evicts droppable frames before critical frames", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 3 });
  const streamId = bridge.createStreamId("task_abc", "updates");

  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: { seq: 1 } });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "completed", payload: { seq: 2 } });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "progress", payload: { seq: 3 } });
  bridge.emitFrame({ streamId, taskId: "task_abc", channel: "updates", eventType: "approval_requested", payload: { seq: 4 } });

  const replayed = bridge.replayAfterSequence(streamId, 0);
  assert.equal(replayed.length, 3);
  assert.deepEqual(replayed.map((frame) => frame.eventType), ["completed", "progress", "approval_requested"]);
  assert.equal(replayed.some((frame) => frame.eventType === "completed"), true);
  assert.equal(replayed.some((frame) => frame.eventType === "approval_requested"), true);
});

test("StreamBridge replay buffer drops oldest critical frame when saturation would exceed the cap", () => {
  const bridge = new StreamBridge({ maxReplayFrames: 2 });
  const streamId = bridge.createStreamId("task_critical", "updates");

  bridge.emitFrame({ streamId, taskId: "task_critical", channel: "updates", eventType: "completed", payload: { seq: 1 } });
  bridge.emitFrame({ streamId, taskId: "task_critical", channel: "updates", eventType: "failed", payload: { seq: 2 } });
  bridge.emitFrame({ streamId, taskId: "task_critical", channel: "updates", eventType: "approval_requested", payload: { seq: 3 } });

  const replayed = bridge.replayAfterSequence(streamId, 0);
  assert.equal(replayed.length, 2);
  assert.deepEqual(replayed.map((frame) => frame.eventType), ["failed", "approval_requested"]);
});
