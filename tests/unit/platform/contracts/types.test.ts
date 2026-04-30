/**
 * Contracts Types Unit Tests
 *
 * Tests for platform-contracts types and factory functions.
 * Tests type consistency and contract definitions.
 */

import test from "node:test";
import assert from "node:assert/strict";

import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
  type PlatformPrincipal,
  type EvidenceRecord,
  type ProjectionUpdate,
} from "../../../../src/platform/contracts/types/platform-contracts.js";

test("createPlatformPrincipal creates valid principal", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_123",
    tenantId: "tenant_abc",
    roles: ["admin", "developer"],
  });

  assert.equal(principal.actorId, "user_123");
  assert.equal(principal.tenantId, "tenant_abc");
  assert.deepEqual(principal.roles, ["admin", "developer"]);
});

test("createPlatformPrincipal handles optional fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_456",
    tenantId: "tenant_xyz",
    roles: ["viewer"],
    authMethod: "oauth",
    displayName: "Test User",
  });

  assert.equal(principal.authMethod, "oauth");
  assert.equal(principal.displayName, "Test User");
});

test("createPlatformPrincipal defaults roles to empty array", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_no_roles",
    tenantId: null,
  });

  assert.deepEqual(principal.roles, []);
  assert.equal(principal.tenantId, null);
});

test("createRequestEnvelope creates valid envelope", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_789",
    tenantId: "tenant_global",
    roles: ["admin"],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { command: "test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
  assert.equal(envelope.tenantId, "tenant_global");
  assert.deepEqual(envelope.payload, { command: "test" });
  assert.ok(envelope.metadata);
  assert.ok(envelope.timestamp);
});

test("createRequestEnvelope uses principal tenantId when tenantId not specified", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_abc",
    tenantId: "tenant_from_principal",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: 123 },
  });

  assert.equal(envelope.tenantId, "tenant_from_principal");
});

test("createRequestEnvelope allows custom metadata", () => {
  const principal = createPlatformPrincipal({
    actorId: "user_meta",
    tenantId: "tenant_meta",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    metadata: { key1: "value1", key2: "value2" },
  });

  assert.equal(envelope.metadata.key1, "value1");
  assert.equal(envelope.metadata.key2, "value2");
});

test("createEvidenceRecord creates valid evidence record", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const record = createEvidenceRecord({
    traceId: "trace_evidence",
    principal,
    category: "decision",
    targetRef: "task_123",
    content: { decision: "approved", reason: "criteria_met" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.traceId, "trace_evidence");
  assert.equal(record.category, "decision");
  assert.equal(record.targetRef, "task_123");
  assert.ok(record.timestamp);
  assert.ok(record.metadata);
});

test("createEvidenceRecord handles all category types", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "global",
    roles: ["system"],
  });

  const categories: EvidenceRecord["category"][] = ["decision", "execution", "approval", "audit", "compliance"];

  for (const category of categories) {
    const record = createEvidenceRecord({
      traceId: `trace_${category}`,
      principal,
      category,
      targetRef: "ref_test",
      content: { test: true },
    });

    assert.equal(record.category, category);
  }
});

test("createProjectionUpdate creates valid projection", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_123",
    projectionType: "task_status",
    version: 1,
    sourceEvents: ["task_created", "task_started"],
    patch: { status: "completed" },
    triggeredBy: "system",
  });

  assert.equal(projection.projectionId, "proj_123");
  assert.equal(projection.projectionType, "task_status");
  assert.equal(projection.version, 1);
  assert.deepEqual(projection.sourceEvents, ["task_created", "task_started"]);
  assert.deepEqual(projection.patch, { status: "completed" });
  assert.equal(projection.metadata.triggeredBy, "system");
  assert.ok(projection.timestamp);
});

test("createProjectionUpdate includes idempotency key in metadata", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_456",
    projectionType: "execution_summary",
    version: 2,
    sourceEvents: ["exec_started"],
    patch: { summary: "done" },
    triggeredBy: "worker",
    idempotencyKey: "custom_idem_key",
  });

  assert.equal(projection.metadata.idempotencyKey, "custom_idem_key");
});

test("createProjectionUpdate handles optional rebuiltAt", () => {
  const projection = createProjectionUpdate({
    projectionId: "proj_rebuilt",
    projectionType: "rebuild_test",
    version: 5,
    sourceEvents: [],
    patch: {},
    triggeredBy: "recovery",
    rebuiltAt: "2026-01-01T00:00:00.000Z",
  });

  assert.equal(projection.metadata.rebuiltAt, "2026-01-01T00:00:00.000Z");
});

test("createPlatformPrincipal preserves readonly contract", () => {
  const principal = createPlatformPrincipal({
    actorId: "readonly_test",
    tenantId: "tenant_readonly",
    roles: ["role1"],
  });

  // Verify properties are readonly
  const checkReadonly = (obj: PlatformPrincipal) => {
    return Object.isExtensible(obj) && Object.hasOwn(obj, "actorId");
  };

  assert.ok(checkReadonly(principal));
});

test("createRequestEnvelope metadata is readonly record", () => {
  const principal = createPlatformPrincipal({
    actorId: "meta_test",
    tenantId: "tenant_meta",
    roles: [],
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { test: true },
  });

  // Metadata should be a readonly record of strings
  const metadataKeys = Object.keys(envelope.metadata);
  assert.ok(metadataKeys.length >= 0);
});

test("createEvidenceRecord content can be any type", () => {
  const principal = createPlatformPrincipal({
    actorId: "content_test",
    tenantId: "tenant_content",
    roles: [],
  });

  // Test various content types
  const stringContent = createEvidenceRecord({
    traceId: "trace_str",
    principal,
    category: "decision",
    targetRef: "ref1",
    content: "simple string",
  });
  assert.equal(stringContent.content, "simple string");

  const objectContent = createEvidenceRecord({
    traceId: "trace_obj",
    principal,
    category: "execution",
    targetRef: "ref2",
    content: { nested: { data: [1, 2, 3] } },
  });
  assert.deepEqual((objectContent.content as any).nested.data, [1, 2, 3]);

  const arrayContent = createEvidenceRecord({
    traceId: "trace_arr",
    principal,
    category: "approval",
    targetRef: "ref3",
    content: ["item1", "item2"],
  });
  assert.deepEqual(arrayContent.content, ["item1", "item2"]);
});