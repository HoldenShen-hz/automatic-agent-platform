import assert from "node:assert/strict";
import test from "node:test";

import { createRequestEnvelope } from "../../../../../src/platform/contracts/request-envelope/index.js";

test("createRequestEnvelope wraps request bodies with canonical metadata", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    traceId: "trace-1",
    mode: "async",
    body: { goal: "deploy agent" },
  });

  assert.equal(envelope.requestId, "request-1");
  assert.equal(envelope.mode, "async");
  assert.deepEqual(envelope.body, { goal: "deploy agent" });
});
