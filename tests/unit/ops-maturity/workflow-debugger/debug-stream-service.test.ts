import assert from "node:assert/strict";
import test from "node:test";

import { WorkflowDebugStreamService } from "../../../../src/ops-maturity/workflow-debugger/debug-stream-service.js";

test("WorkflowDebugStreamService opens websocket debug subscriptions on canonical path", () => {
  const service = new WorkflowDebugStreamService();
  const subscription = service.openSubscription("wf-123", "subscriber-1", "2026-05-01T00:00:00.000Z");

  assert.equal(subscription.streamPath, "/ws/v1/debug/wf-123");
  assert.equal(subscription.protocol, "websocket");
  assert.equal(service.listSubscriptions("wf-123").length, 1);
});

test("WorkflowDebugStreamService buffers published debug events per workflow", () => {
  const service = new WorkflowDebugStreamService();
  service.publish({
    workflowId: "wf-123",
    eventType: "breakpoint_hit",
    payload: { breakpointId: "bp-1" },
    emittedAt: "2026-05-01T00:00:00.000Z",
  });

  assert.equal(service.getBufferedEvents("wf-123").length, 1);
  assert.equal(service.getBufferedEvents("wf-123")[0]?.eventType, "breakpoint_hit");
});
