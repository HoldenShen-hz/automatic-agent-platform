import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestEnvelope,
  type RequestEnvelope,
} from "../../../../../src/platform/contracts/request-envelope/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

test("createRequestEnvelope generates an envelopeId when not provided", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    traceId: "trace-1",
    mode: "async",
    body: { goal: "deploy agent" },
  });

  assert.ok(envelope.envelopeId.startsWith("envelope_"));
});

test("createRequestEnvelope uses provided envelopeId", () => {
  const envelope = createRequestEnvelope({
    envelopeId: "custom-envelope-id",
    requestId: "request-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    traceId: "trace-1",
    mode: "async",
    body: { goal: "deploy agent" },
  });

  assert.equal(envelope.envelopeId, "custom-envelope-id");
});

test("createRequestEnvelope sets createdAt to nowIso when not provided", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    traceId: "trace-1",
    mode: "async",
    body: { goal: "deploy agent" },
  });

  assert.ok(envelope.createdAt.includes("T"));
});

test("createRequestEnvelope uses provided createdAt timestamp", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: "task-1",
    tenantId: "tenant-1",
    sessionId: "session-1",
    traceId: "trace-1",
    mode: "async",
    body: { goal: "deploy agent" },
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(envelope.createdAt, "2026-01-01T00:00:00.000Z");
});

test("createRequestEnvelope throws when requestId is empty", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "",
        taskId: "task-1",
        tenantId: "tenant-1",
        sessionId: "session-1",
        traceId: "trace-1",
        mode: "sync",
        body: {},
      }),
    ValidationError,
  );
});

test("createRequestEnvelope throws when requestId is only whitespace", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "   ",
        taskId: "task-1",
        tenantId: "tenant-1",
        sessionId: "session-1",
        traceId: "trace-1",
        mode: "sync",
        body: {},
      }),
    ValidationError,
  );
});

test("createRequestEnvelope normalizes empty strings to null for nullable fields", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: "",
    tenantId: "",
    sessionId: "",
    traceId: "",
    mode: "sync",
    body: {},
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.traceId, null);
});

test("createRequestEnvelope accepts sync mode", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "sync",
    body: { query: "test" },
  });

  assert.equal(envelope.mode, "sync");
  assert.deepEqual(envelope.body, { query: "test" });
});

test("createRequestEnvelope accepts async mode", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "async",
    body: { goal: "deploy" },
  });

  assert.equal(envelope.mode, "async");
});

test("createRequestEnvelope accepts typed body", () => {
  const envelope = createRequestEnvelope<{ name: string; age: number }>({
    requestId: "request-1",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "sync",
    body: { name: "Alice", age: 30 },
  });

  assert.equal(envelope.body.name, "Alice");
  assert.equal(envelope.body.age, 30);
});

test("RequestEnvelope interface accepts all fields", () => {
  const envelope: RequestEnvelope<{ test: string }> = {
    envelopeId: "env-123",
    requestId: "req-456",
    confirmedTaskSpecId: "cts-789",
    taskId: "task-789",
    tenantId: "tenant-1",
    principal: {
      principalId: "user-1",
      type: "human",
      tenantId: "tenant-1",
      roles: ["operator"],
    },
    sessionId: "session-1",
    traceId: "trace-1",
    idempotencyKey: "idem-1",
    priority: 1,
    mode: "sync",
    body: { test: "data" },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(envelope.envelopeId, "env-123");
  assert.equal(envelope.requestId, "req-456");
  assert.equal(envelope.taskId, "task-789");
  assert.equal(envelope.tenantId, "tenant-1");
  assert.equal(envelope.mode, "sync");
});

test("createRequestEnvelope allows null for all optional string fields", () => {
  const envelope = createRequestEnvelope({
    requestId: "request-1",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "sync",
    body: {},
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.traceId, null);
});
