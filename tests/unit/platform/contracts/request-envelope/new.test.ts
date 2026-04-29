import assert from "node:assert/strict";
import test from "node:test";

import {
  createRequestEnvelope,
  type RequestEnvelope,
} from "../../../../../src/platform/contracts/request-envelope/index.js";
import { ValidationError } from "../../../../../src/platform/contracts/errors.js";

function createBaseInput() {
  return {
    requestId: "req_123",
    confirmedTaskSpecId: "taskspec_123",
    tenantId: "tenant_abc",
    principal: {
      principalId: "principal_123",
      tenantId: "tenant_abc",
      roles: ["operator"] as const,
    },
    traceId: "trace_xyz",
    idempotencyKey: "idem_123",
    priority: 10,
    taskId: "task_456",
    sessionId: "sess_789",
    mode: "sync" as const,
    body: { action: "test" },
  };
}

test("createRequestEnvelope builds a valid request envelope", () => {
  const envelope = createRequestEnvelope(createBaseInput());

  assert.equal(envelope.requestId, "req_123");
  assert.equal(envelope.confirmedTaskSpecId, "taskspec_123");
  assert.equal(envelope.taskId, "task_456");
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.principal.principalId, "principal_123");
  assert.equal(envelope.sessionId, "sess_789");
  assert.equal(envelope.traceId, "trace_xyz");
  assert.equal(envelope.idempotencyKey, "idem_123");
  assert.equal(envelope.priority, 10);
  assert.equal(envelope.mode, "sync");
  assert.deepEqual(envelope.body, { action: "test" });
  assert.ok(envelope.envelopeId.startsWith("envelope_"));
  assert.ok(envelope.createdAt.includes("T"));
});

test("createRequestEnvelope generates envelopeId when not provided", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    taskId: null,
    sessionId: null,
    mode: "async",
    body: {},
  });

  assert.ok(envelope.envelopeId.startsWith("envelope_"));
});

test("createRequestEnvelope uses provided envelopeId", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    envelopeId: "custom_envelope_123",
    taskId: null,
    sessionId: null,
    body: {},
  });

  assert.equal(envelope.envelopeId, "custom_envelope_123");
});

test("createRequestEnvelope sets createdAt to nowIso when not provided", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    taskId: null,
    sessionId: null,
    body: {},
  });

  assert.ok(envelope.createdAt.includes("T"));
});

test("createRequestEnvelope uses provided createdAt timestamp", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    taskId: null,
    sessionId: null,
    body: {},
    createdAt: "2026-06-15T12:30:00.000Z",
  });

  assert.equal(envelope.createdAt, "2026-06-15T12:30:00.000Z");
});

test("createRequestEnvelope throws when requestId is empty", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        ...createBaseInput(),
        requestId: "",
        body: {},
      }),
    ValidationError,
  );
});

test("createRequestEnvelope throws when requestId is only whitespace", () => {
  assert.throws(
    () =>
      createRequestEnvelope({
        ...createBaseInput(),
        requestId: "   ",
        body: {},
      }),
    ValidationError,
  );
});

test("createRequestEnvelope normalizes whitespace-only strings to null", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    taskId: "  ",
    sessionId: "\n",
    body: {},
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.traceId, "trace_xyz");
});

test("createRequestEnvelope accepts sync mode", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    requestId: "req_sync",
    taskId: null,
    sessionId: null,
    body: {},
  });

  assert.equal(envelope.mode, "sync");
});

test("createRequestEnvelope accepts async mode", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    requestId: "req_async",
    taskId: null,
    sessionId: null,
    mode: "async",
    body: {},
  });

  assert.equal(envelope.mode, "async");
});

test("createRequestEnvelope accepts complex body objects", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    requestId: "req_complex",
    taskId: null,
    sessionId: null,
    body: {
      nested: {
        data: [1, 2, 3],
        flag: true,
      },
      timestamp: "2026-04-26T00:00:00.000Z",
    },
  });

  assert.deepEqual(envelope.body, {
    nested: {
      data: [1, 2, 3],
      flag: true,
    },
    timestamp: "2026-04-26T00:00:00.000Z",
  });
});

test("createRequestEnvelope accepts all null optional fields", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    requestId: "req_minimal",
    taskId: null,
    sessionId: null,
    body: {},
  });

  assert.equal(envelope.taskId, null);
  assert.equal(envelope.sessionId, null);
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.traceId, "trace_xyz");
});

test("createRequestEnvelope preserves non-empty string values with whitespace", () => {
  const envelope = createRequestEnvelope({
    ...createBaseInput(),
    requestId: "req_whitespace",
    taskId: " task_id ",
    sessionId: " session_id ",
    body: {},
  });

  // Non-empty strings with whitespace should be preserved
  assert.equal(envelope.taskId, " task_id ");
  assert.equal(envelope.sessionId, " session_id ");
  assert.equal(envelope.tenantId, "tenant_abc");
  assert.equal(envelope.traceId, "trace_xyz");
});

test("RequestEnvelope interface accepts all fields", () => {
  const envelope: RequestEnvelope = {
    envelopeId: "env_123",
    requestId: "req_456",
    confirmedTaskSpecId: "taskspec_456",
    principal: {
      principalId: "principal_456",
      tenantId: "tenant_abc",
      roles: ["operator"],
    },
    idempotencyKey: "idem_456",
    priority: 1,
    taskId: "task_789",
    tenantId: "tenant_abc",
    sessionId: "sess_xyz",
    traceId: "trace_uvw",
    mode: "async",
    body: { key: "value" },
    createdAt: "2026-01-01T00:00:00.000Z",
  };

  assert.equal(envelope.envelopeId, "env_123");
  assert.equal(envelope.requestId, "req_456");
  assert.equal(envelope.mode, "async");
});

test("RequestEnvelope supports typed body", () => {
  interface CustomBody {
    operation: string;
    parameters: Record<string, string>;
  }

  const envelope = createRequestEnvelope<CustomBody>({
    ...createBaseInput(),
    requestId: "req_typed",
    taskId: null,
    sessionId: null,
    body: {
      operation: "deploy",
      parameters: { env: "prod", region: "us-east-1" },
    },
  });

  const typedBody = envelope.body as CustomBody;
  assert.equal(typedBody.operation, "deploy");
  assert.deepEqual(typedBody.parameters, { env: "prod", region: "us-east-1" });
});

test("createRequestEnvelope generates unique envelopeId each call", () => {
  const envelopes = new Set<string>();
  for (let i = 0; i < 100; i++) {
    const envelope = createRequestEnvelope({
      ...createBaseInput(),
      requestId: `req_${i}`,
      taskId: null,
      sessionId: null,
      body: {},
    });
    envelopes.add(envelope.envelopeId);
  }

  assert.equal(envelopes.size, 100, "All envelope IDs should be unique");
});
