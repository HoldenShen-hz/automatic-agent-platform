/**
 * Request Envelope Contract Unit Tests
 *
 * Tests the request envelope creation and validation logic.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { createRequestEnvelope } from "../../../../src/platform/contracts/request-envelope/index.js";
import { ValidationError } from "../../../../src/platform/contracts/errors.js";

const principal = {
  principalId: "user_123",
  type: "human" as const,
  tenantId: "tenant_global",
  roles: ["user"],
};

test("request-envelope: createRequestEnvelope generates valid envelope", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    confirmedTaskSpecId: "cts_123",
    taskId: null,
    tenantId: null,
    principal,
    sessionId: null,
    traceId: "trace_123",
    idempotencyKey: "idem_123",
    priority: 0,
    mode: "sync",
    body: { key: "value" },
    sourcePlane: "interaction",
    targetPlane: "orchestration",
    directives: [],
  });

  assert.equal(envelope.requestId, "req_123");
  assert.equal(envelope.confirmedTaskSpecId, "cts_123");
  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.traceId, "trace_123");
  assert.equal(envelope.mode, "sync");
  assert.deepEqual(envelope.body, { key: "value" });
  assert.equal(envelope.sourcePlane, "interaction");
  assert.equal(envelope.targetPlane, "orchestration");
  assert.deepEqual(envelope.directives, []);
  assert.ok(envelope.envelopeId.startsWith("envelope_"));
  assert.ok(envelope.createdAt.length > 0);
});

test("request-envelope: createRequestEnvelope normalizes whitespace-only strings to null", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    confirmedTaskSpecId: "cts_123",
    taskId: "   ",
    tenantId: "",
    principal,
    sessionId: null,
    traceId: "trace_123",
    idempotencyKey: "idem_123",
    priority: 0,
    mode: "async",
    body: {},
    sourcePlane: "  ",
    targetPlane: "\t",
    directives: [],
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.tenantId, null);
  assert.equal(envelope.traceId, "trace_123");
  assert.equal(envelope.sourcePlane, undefined);
  assert.equal(envelope.targetPlane, undefined);
});

test("request-envelope: createRequestEnvelope preserves non-empty strings", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    confirmedTaskSpecId: "cts_123",
    taskId: "task_456",
    tenantId: "tenant_abc",
    principal: { ...principal, tenantId: "tenant_abc" },
    sessionId: "sess_789",
    traceId: "trace_xyz",
    idempotencyKey: "idem_123",
    priority: 3,
    mode: "sync",
    body: {},
    sourcePlane: "interface",
    targetPlane: "control",
    directives: [{ directiveType: "operator_review_required", reason: "risk.high" } as never],
  });

  assert.equal(envelope.taskId, "task_456");
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.sessionId, "sess_789");
  assert.equal(envelope.traceId, "trace_xyz");
  assert.equal(envelope.sourcePlane, "interface");
  assert.equal(envelope.targetPlane, "control");
  assert.equal(envelope.directives?.length, 1);
});

test("request-envelope: createRequestEnvelope throws when requestId is empty", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "",
        confirmedTaskSpecId: "cts_123",
        taskId: null,
        tenantId: null,
        principal,
        sessionId: null,
        traceId: "trace_123",
        idempotencyKey: "idem_123",
        priority: 0,
        mode: "sync",
        body: {},
        directives: [],
      }),
    ValidationError,
  );
});

test("request-envelope: createRequestEnvelope throws when requestId is whitespace", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        requestId: "   \t\n",
        confirmedTaskSpecId: "cts_123",
        taskId: null,
        tenantId: null,
        principal,
        sessionId: null,
        traceId: "trace_123",
        idempotencyKey: "idem_123",
        priority: 0,
        mode: "sync",
        body: {},
        directives: [],
      }),
    ValidationError,
  );
});

test("request-envelope: createRequestEnvelope accepts async mode", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    confirmedTaskSpecId: "cts_123",
    taskId: null,
    tenantId: null,
    principal,
    sessionId: null,
    traceId: "trace_123",
    idempotencyKey: "idem_123",
    priority: 0,
    mode: "async",
    body: {},
    directives: [],
  });

  assert.equal(envelope.mode, "async");
});

test("request-envelope: createRequestEnvelope accepts custom envelopeId and createdAt", () => {
  const envelope = createRequestEnvelope({
    requestId: "req_123",
    confirmedTaskSpecId: "cts_123",
    taskId: null,
    tenantId: null,
    principal,
    sessionId: null,
    traceId: "trace_123",
    idempotencyKey: "idem_123",
    priority: 0,
    mode: "sync",
    body: {},
    directives: [],
    envelopeId: "custom_envelope",
    createdAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(envelope.envelopeId, "custom_envelope");
  assert.equal(envelope.createdAt, "2026-01-01T00:00:00.000Z");
});
