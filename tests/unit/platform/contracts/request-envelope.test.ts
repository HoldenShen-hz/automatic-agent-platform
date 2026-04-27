/**
 * Request Envelope Contract Unit Tests
 *
 * Tests the request envelope creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRequestEnvelope } from "../../../../src/platform/contracts/request-envelope/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

test("request-envelope: createRequestEnvelope generates valid envelope", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "sync",
    body: { key: "value" },
  });

  assert.equal(envelope.requestId, "req_123");
  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.traceId, null);
  assert.equal(envelope.mode, "sync");
  assert.deepEqual(envelope.body, { key: "value" });
  assert.ok(envelope.envelopeId.startsWith("envelope_"));
  assert.ok(envelope.createdAt.length > 0);
});

test("request-envelope: createRequestEnvelope normalizes whitespace-only strings to null", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    taskId: "   ",
    tenantId: "",
    sessionId: null,
    traceId: "  \t  ",
    mode: "async",
    body: {},
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.traceId, null);
});

test("request-envelope: createRequestEnvelope preserves non-empty strings", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    taskId: "task_456",
    tenantId: "tenant_abc",
    sessionId: "sess_789",
    traceId: "trace_xyz",
    mode: "sync",
    body: {},
  });

  assert.equal(envelope.taskId, "task_456");
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.sessionId, "sess_789");
  assert.equal(envelope.traceId, "trace_xyz");
});

test("request-envelope: createRequestEnvelope throws when requestId is empty", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "",
        taskId: null,
        tenantId: null,
        sessionId: null,
        traceId: null,
        mode: "sync",
        body: {},
      }),
    ValidationError,
  );
});

test("request-envelope: createRequestEnvelope throws when requestId is whitespace", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "   \t\n",
        taskId: null,
        tenantId: null,
        sessionId: null,
        traceId: null,
        mode: "sync",
        body: {},
      }),
    ValidationError,
  );
});

test("request-envelope: createRequestEnvelope accepts async mode", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "async",
    body: {},
  });

  assert.equal(envelope.mode, "async");
});

test("request-envelope: createRequestEnvelope accepts custom envelopeId and createdAt", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    taskId: null,
    tenantId: null,
    sessionId: null,
    traceId: null,
    mode: "sync",
    body: {},
    envelopeId: "custom_envelope",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(envelope.envelopeId, "custom_envelope");
  assert.equal(envelope.createdAt, "2026-01-01T00:00:00.000Z");
});
