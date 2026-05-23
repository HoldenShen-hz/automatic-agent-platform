import assert from "node:assert/strict";
import test from "node:test";

import * as platformContracts from "../../../../../src/platform/contracts/types/platform-contracts.js";
import type {
  PlatformPrincipal,
  RequestEnvelopeLegacy,
  EvidenceRecord,
  ProjectionUpdate,
} from "../../../../../src/platform/contracts/types/platform-contracts.js";

function createTestPrincipal(overrides: Partial<PlatformPrincipal> = {}): PlatformPrincipal {
  return {
    actorId: "actor-1",
    tenantId: "tenant-1",
    roles: ["operator"],
    ...overrides,
  };
}

test("platform-contracts exports current platform-specific factories", () => {
  assert.equal(typeof platformContracts.createPlatformPrincipal, "function");
  assert.equal(typeof platformContracts.createRequestEnvelope, "function");
  assert.equal(typeof platformContracts.createEvidenceRecord, "function");
  assert.equal(typeof platformContracts.createProjectionUpdate, "function");
});

test("createPlatformPrincipal applies defaults", () => {
  const principal = platformContracts.createPlatformPrincipal({
    actorId: "actor-123",
    tenantId: null,
  });

  assert.equal(principal.actorId, "actor-123");
  assert.equal(principal.tenantId, null);
  assert.deepEqual(principal.roles, []);
});

test("createRequestEnvelope returns the legacy request shape still supported here", () => {
  const envelope: RequestEnvelopeLegacy<{ ok: boolean }> = platformContracts.createRequestEnvelope({
    principal: createTestPrincipal(),
    payload: { ok: true },
    metadata: { retries: 2, approved: false },
  });

  assert.ok(envelope.requestId.startsWith("request_"));
  assert.ok(envelope.idempotencyKey.startsWith("idem_"));
  assert.equal(envelope.tenantId, "tenant-1");
  assert.deepEqual(envelope.payload, { ok: true });
  assert.deepEqual(envelope.metadata, { retries: "2", approved: "false" });
});

test("createRequestEnvelope falls back to global for principals without tenant", () => {
  const envelope = platformContracts.createRequestEnvelope({
    principal: createTestPrincipal({ tenantId: null }),
    payload: {},
  });

  assert.equal(envelope.tenantId, "global");
});

test("createEvidenceRecord returns the platform evidence shape", () => {
  const record: EvidenceRecord = platformContracts.createEvidenceRecord({
    traceId: "trace-123",
    principal: createTestPrincipal(),
    category: "audit",
    targetRef: "task:task-123",
    content: { decision: "approved" },
    metadata: { source: "unit-test" },
  });

  assert.ok(record.recordId.startsWith("evid_"));
  assert.equal(record.category, "audit");
  assert.deepEqual(record.metadata, { source: "unit-test" });
});

test("createProjectionUpdate preserves explicit metadata inputs", () => {
  const update: ProjectionUpdate = platformContracts.createProjectionUpdate({
    projectionId: "proj-123",
    projectionType: "task_status",
    version: 7,
    sourceEvents: ["evt-1"],
    patch: { status: "completed" },
    triggeredBy: "unit-test",
    idempotencyKey: "idem-123",
  });

  assert.equal(update.version, 7);
  assert.deepEqual(update.sourceEvents, ["evt-1"]);
  assert.equal(update.metadata.triggeredBy, "unit-test");
  assert.equal(update.metadata.idempotencyKey, "idem-123");
});
