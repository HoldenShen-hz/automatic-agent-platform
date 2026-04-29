/**
 * Integration tests for Platform Contracts - Factory Functions Working Together
 *
 * @see src/platform/contracts/types/platform-contracts.ts
 * @see src/platform/contracts/types/ids.ts
 * @see src/platform/contracts/types/status.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createPlatformPrincipal,
  createRequestEnvelope,
  createEvidenceRecord,
  createProjectionUpdate,
} from "../../../src/platform/contracts/types/platform-contracts.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import type { SessionStatus } from "../../../src/platform/contracts/types/status.js";

// ─────────────────────────────────────────────────────────────────────────────
// Principal and Request Envelope Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: createPlatformPrincipal and createRequestEnvelope work together", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
    roles: ["developer", "reviewer"],
    displayName: "Test User",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { action: "approve", requestId: "req789" },
    tenantId: "tenant456",
  });

  assert.strictEqual(envelope.principal.actorId, "user123");
  assert.strictEqual(envelope.principal.tenantId, "tenant456");
  assert.strictEqual(envelope.tenantId, "tenant456");
  assert.deepStrictEqual((envelope.payload as { action: string }).action, "approve");
});

test("integration: request envelope propagates principal information", () => {
  const principal = createPlatformPrincipal({
    actorId: "actor001",
    tenantId: "tenant002",
    roles: ["admin"],
    authMethod: "oauth2",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { taskId: newId("task") },
  });

  assert.strictEqual(envelope.principal.actorId, principal.actorId);
  assert.strictEqual(envelope.principal.roles[0], "admin");
  assert.strictEqual(envelope.principal.authMethod, "oauth2");
});

// ─────────────────────────────────────────────────────────────────────────────
// Evidence Record and Projection Update Integration
// ─────────────────────────────────────────────────────────────────────────────

test("integration: evidence records can reference projections", () => {
  const principal = createPlatformPrincipal({
    actorId: "system",
    tenantId: "platform",
    roles: ["service"],
  });

  const evidence = createEvidenceRecord({
    traceId: "trace123",
    principal,
    category: "execution",
    targetRef: "task456",
    content: { result: "completed", durationMs: 1500 },
  });

  const projection = createProjectionUpdate({
    projectionId: "proj789",
    projectionType: "TaskExecutionProjection",
    version: 1,
    sourceEvents: [evidence.recordId],
    patch: { lastEvidence: evidence.recordId },
    triggeredBy: "system",
  });

  assert.ok(projection.sourceEvents.includes(evidence.recordId));
  assert.strictEqual(projection.patch.lastEvidence, evidence.recordId);
});

test("integration: multiple evidence records can be tracked in projection", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  const evidence1 = createEvidenceRecord({
    traceId: "trace1",
    principal,
    category: "decision",
    targetRef: "task1",
    content: { type: "approval" },
  });

  const evidence2 = createEvidenceRecord({
    traceId: "trace2",
    principal,
    category: "execution",
    targetRef: "task1",
    content: { type: "start" },
  });

  const projection = createProjectionUpdate({
    projectionId: "proj_multi",
    projectionType: "TaskLifecycleProjection",
    version: 2,
    sourceEvents: [evidence1.recordId, evidence2.recordId],
    patch: { events: [evidence1.recordId, evidence2.recordId] },
    triggeredBy: "system",
  });

  assert.strictEqual(projection.sourceEvents.length, 2);
  assert.strictEqual(projection.version, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Session Lifecycle with Evidence Tracking
// ─────────────────────────────────────────────────────────────────────────────

test("integration: session lifecycle creates evidence at each state transition", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  // Session created
  const sessionId = newId("sess");
  const evidenceCreated = createEvidenceRecord({
    traceId: "trace_session",
    principal,
    category: "decision",
    targetRef: sessionId,
    content: { event: "session_created", status: "open" },
  });

  assert.ok(evidenceCreated.recordId.startsWith("evid_"));

  // Session completed
  const evidenceCompleted = createEvidenceRecord({
    traceId: "trace_session",
    principal,
    category: "decision",
    targetRef: sessionId,
    content: { event: "session_completed", status: "completed" },
  });

  assert.ok(evidenceCompleted.recordId.startsWith("evid_"));
  assert.notStrictEqual(evidenceCreated.recordId, evidenceCompleted.recordId);

  // Projection tracks both
  const projection = createProjectionUpdate({
    projectionId: newId("proj"),
    projectionType: "SessionLifecycleProjection",
    version: 2,
    sourceEvents: [evidenceCreated.recordId, evidenceCompleted.recordId],
    patch: {
      sessionId,
      initialEvent: evidenceCreated.recordId,
      terminalEvent: evidenceCompleted.recordId,
    },
    triggeredBy: "session_manager",
  });

  assert.strictEqual(projection.sourceEvents.length, 2);
});

// ─────────────────────────────────────────────────────────────────────────────
// Full Request Lifecycle
// ─────────────────────────────────────────────────────────────────────────────

test("integration: full request lifecycle from envelope to evidence", () => {
  // 1. Create principal
  const principal = createPlatformPrincipal({
    actorId: "requestor",
    tenantId: "tenant789",
    roles: ["requester"],
  });

  // 2. Create request envelope
  const envelope = createRequestEnvelope({
    principal,
    payload: { requestType: "task_approval", taskId: newId("task") },
    requestId: "req_lifecycle_test",
  });

  assert.strictEqual(envelope.requestId, "req_lifecycle_test");

  // 3. Process request and create evidence
  const evidence = createEvidenceRecord({
    traceId: envelope.traceId,
    principal,
    category: "approval",
    targetRef: envelope.requestId,
    content: {
      requestId: envelope.requestId,
      payload: envelope.payload,
      processedAt: nowIso(),
    },
  });

  assert.strictEqual(evidence.traceId, envelope.traceId);
  assert.strictEqual(evidence.category, "approval");

  // 4. Create projection to track the request
  const projection = createProjectionUpdate({
    projectionId: newId("proj"),
    projectionType: "RequestLifecycleProjection",
    version: 1,
    sourceEvents: [envelope.requestId, evidence.recordId],
    patch: {
      envelopeRequestId: envelope.requestId,
      evidenceRecordId: evidence.recordId,
      processed: true,
    },
    triggeredBy: principal.actorId,
  });

  assert.ok(projection.sourceEvents.includes(envelope.requestId));
  assert.ok(projection.sourceEvents.includes(evidence.recordId));
});

// ─────────────────────────────────────────────────────────────────────────────
// Error Handling with Evidence Records
// ─────────────────────────────────────────────────────────────────────────────

test("integration: failed operations create evidence with error details", () => {
  const principal = createPlatformPrincipal({
    actorId: "service",
    tenantId: "platform",
    roles: ["operator"],
  });

  const evidence = createEvidenceRecord({
    traceId: "trace_error",
    principal,
    category: "compliance",
    targetRef: "task_error",
    content: {
      event: "task_failed",
      error: {
        code: "EXECUTION_TIMEOUT",
        message: "Task execution exceeded maximum duration",
        retryable: false,
      },
    },
  });

  const content = evidence.content as { event: string; error: { code: string; message: string; retryable: boolean } };
  assert.strictEqual(content.event, "task_failed");
  assert.strictEqual(content.error.code, "EXECUTION_TIMEOUT");
  assert.strictEqual(content.error.retryable, false);
});

// ─────────────────────────────────────────────────────────────────────────────
// Metadata Propagation
// ─────────────────────────────────────────────────────────────────────────────

test("integration: metadata propagates through envelope creation", () => {
  const principal = createPlatformPrincipal({
    actorId: "user123",
    tenantId: "tenant456",
  });

  const envelope = createRequestEnvelope({
    principal,
    payload: { data: "test" },
    metadata: { source: "integration_test", version: "1" },
  });

  assert.strictEqual(envelope.metadata.source, "integration_test");
  assert.strictEqual(envelope.metadata.version, "1");
});

test("integration: projection metadata includes rebuild information when applicable", () => {
  const normalProjection = createProjectionUpdate({
    projectionId: "proj1",
    projectionType: "NormalProjection",
    version: 1,
    sourceEvents: [],
    patch: {},
    triggeredBy: "service",
  });

  assert.ok(!("rebuiltAt" in normalProjection.metadata));

  const rebuiltProjection = createProjectionUpdate({
    projectionId: "proj2",
    projectionType: "RebuiltProjection",
    version: 5,
    sourceEvents: ["RebuildTriggered"],
    patch: {},
    triggeredBy: "service",
    rebuiltAt: "2026-01-15T10:00:00.000Z",
  });

  assert.ok("rebuiltAt" in rebuiltProjection.metadata);
  assert.strictEqual(rebuiltProjection.metadata.rebuiltAt, "2026-01-15T10:00:00.000Z");
});
