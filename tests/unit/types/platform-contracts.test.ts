/**
 * Unit tests for Platform Contracts Factory Functions
 *
 * @see src/platform/contracts/types/platform-contracts.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
  type PlatformPrincipal,
  type RequestEnvelopeLegacy,
  type EvidenceRecord,
  type ProjectionUpdate,
} from "../../../src/platform/contracts/types/platform-contracts.js";

// ─────────────────────────────────────────────────────────────────────────────
// createPlatformPrincipal Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createPlatformPrincipal creates principal with required fields", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  assert.strictEqual(principal.actorId, "user123");
  assert.strictEqual(principal.tenantId, "tenant456");
});

test("createPlatformPrincipal defaults roles to empty array", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: null,
  });

  assert.ok(Array.isArray(principal.roles));
  assert.strictEqual(principal.roles.length, 0);
});

test("createPlatformPrincipal accepts custom roles", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
    roles: ["admin", "developer"],
  });

  assert.strictEqual(principal.roles.length, 2);
  assert.strictEqual(principal.roles[0], "admin");
});

test("createPlatformPrincipal includes optional authMethod when provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
    authMethod: "oauth2",
  });

  assert.strictEqual(principal.authMethod, "oauth2");
});

test("createPlatformPrincipal excludes authMethod when not provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  assert.ok(!("authMethod" in principal));
});

test("createPlatformPrincipal includes optional displayName when provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
    displayName: "John Doe",
  });

  assert.strictEqual(principal.displayName, "John Doe");
});

test("createPlatformPrincipal excludes displayName when not provided", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  assert.ok(!("displayName" in principal));
});

test("createPlatformPrincipal handles null tenantId", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: null as string | null,
  });

  assert.strictEqual(principal.tenantId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// createRequestEnvelope Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createRequestEnvelope creates envelope with generated IDs by default", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.ok(envelope.traceId.startsWith("trace_"));
});

test("createRequestEnvelope uses provided IDs when specified", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    requestId: "custom_request_id",
    idempotencyKey: "custom_idem_key",
    traceId: "custom_trace_id",
  });

  assert.strictEqual(envelope.requestId, "custom_request_id");
  assert.strictEqual(envelope.idempotencyKey, "custom_idem_key");
  assert.strictEqual(envelope.traceId, "custom_trace_id");
});

test("createRequestEnvelope uses tenantId from principal when not provided", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "principal_tenant" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.strictEqual(envelope.tenantId, "principal_tenant");
});

test("createRequestEnvelope uses provided tenantId over principal tenantId", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "principal_tenant" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    tenantId: "override_tenant",
  });

  assert.strictEqual(envelope.tenantId, "override_tenant");
});

test("createRequestEnvelope defaults to global tenant when principal has null tenantId", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: null });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.strictEqual(envelope.tenantId, "global");
});

test("createRequestEnvelope generates timestamp by default", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.ok(envelope.timestamp.includes("T"));
  assert.ok(new Date(envelope.timestamp).getTime() > 0);
});

test("createRequestEnvelope uses provided timestamp when specified", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    timestamp: "2026-01-15T10:00:00.000Z",
  });

  assert.strictEqual(envelope.timestamp, "2026-01-15T10:00:00.000Z");
});

test("createRequestEnvelope stringifies metadata values", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    metadata: { count: 42, active: true },
  });

  assert.strictEqual(envelope.metadata.count, "42");
  assert.strictEqual(envelope.metadata.active, "true");
});

test("createRequestEnvelope defaults metadata to empty object", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
  });

  assert.deepStrictEqual(envelope.metadata, {});
});

test("createRequestEnvelope handles null metadata input", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const envelope = createRequestEnvelope({
    principal,
    payload: {},
    metadata: null,
  });

  assert.deepStrictEqual(envelope.metadata, {});
});

// ─────────────────────────────────────────────────────────────────────────────
// createEvidenceRecord Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createEvidenceRecord creates record with generated recordId by default", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const record = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "decision",
    targetRef: "target456",
    content: { result: "approved" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
});

test("createEvidenceRecord uses provided recordId when specified", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const record = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "execution",
    targetRef: "target789",
    content: { result: "completed" },
    recordId: "custom_evid_123",
  });

  assert.strictEqual(record.recordId, "custom_evid_123");
});

test("createEvidenceRecord includes all required fields", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const record = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "audit",
    targetRef: "targetABC",
    content: { data: "test" },
  });

  assert.strictEqual(record.traceId, "trace123");
  assert.strictEqual(record.principal, principal);
  assert.strictEqual(record.category, "audit");
  assert.strictEqual(record.targetRef, "targetABC");
  assert.deepStrictEqual(record.content, { data: "test" });
  assert.ok(new Date(record.timestamp).getTime() > 0);
});

test("createEvidenceRecord accepts valid category values", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const categories: EvidenceRecord["category"][] = ["decision", "execution", "approval", "audit", "compliance"];

  for (const category of categories) {
    const record = createEvidenceRecord({
      traceId: "trace",
      principal,
      category,
      targetRef: "target",
      content: {},
    });
    assert.strictEqual(record.category, category);
  }
});

test("createEvidenceRecord defaults metadata to empty object", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const record = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "decision",
    targetRef: "target",
    content: {},
  });

  assert.deepStrictEqual(record.metadata, {});
});

test("createEvidenceRecord uses provided metadata", () => {
  const principal = createPlatformPrincipal({ actorId: "user123", tenantId: "tenant456" });
  const record = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "execution",
    targetRef: "target",
    content: {},
    metadata: { source: "test", version: "1" },
  });

  assert.strictEqual(record.metadata.source, "test");
  assert.strictEqual(record.metadata.version, "1");
});

// ─────────────────────────────────────────────────────────────────────────────
// createProjectionUpdate Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createProjectionUpdate creates update with required fields", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TaskProjection",
    version: 1,
    sourceEvents: ["TaskCreated", "TaskStarted"],
    patch: { status: "in_progress" },
    triggeredBy: "user456",
  });

  assert.strictEqual(update.projectionId, "proj123");
  assert.strictEqual(update.projectionType, "TaskProjection");
  assert.strictEqual(update.version, 1);
  assert.deepStrictEqual(update.sourceEvents, ["TaskCreated", "TaskStarted"]);
  assert.deepStrictEqual(update.patch, { status: "in_progress" });
});

test("createProjectionUpdate generates timestamp by default", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });

  assert.ok(update.timestamp.includes("T"));
  assert.ok(new Date(update.timestamp).getTime() > 0);
});

test("createProjectionUpdate generates idempotencyKey by default", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });

  assert.ok(update.metadata.idempotencyKey.startsWith("projupd_"));
});

test("createProjectionUpdate uses provided idempotencyKey", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
    idempotencyKey: "custom_key_123",
  });

  assert.strictEqual(update.metadata.idempotencyKey, "custom_key_123");
});

test("createProjectionUpdate includes optional rebuiltAt in metadata", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 5,
    sourceEvents: ["RebuildTriggered"],
    patch: {},
    triggeredBy: "system",
    rebuiltAt: "2026-01-15T10:00:00.000Z",
  });

  assert.strictEqual(update.metadata.rebuiltAt, "2026-01-15T10:00:00.000Z");
});

test("createProjectionUpdate excludes rebuiltAt when not provided", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "system",
  });

  assert.ok(!("rebuiltAt" in update.metadata));
});

test("createProjectionUpdate always includes triggeredBy in metadata", () => {
  const update = createProjectionUpdate({
    projectionId: "proj123",
    projectionType: "TestProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "user_abc",
  });

  assert.strictEqual(update.metadata.triggeredBy, "user_abc");
});
