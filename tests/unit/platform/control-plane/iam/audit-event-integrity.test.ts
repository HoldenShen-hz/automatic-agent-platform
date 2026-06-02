import assert from "node:assert/strict";
import test from "node:test";

import {
  configureAuditIntegrity,
  computeTier1AuditChainHash,
  computeTier1AuditEventChecksum,
  verifyTier1AuditIntegrity,
  __dangerousResetAuditIntegrityConfigForTests,
} from "../../../../../src/platform/five-plane-control-plane/iam/audit-event-integrity.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

test.beforeEach(() => {
  __dangerousResetAuditIntegrityConfigForTests();
  configureAuditIntegrity({
    hmacKey: "audit-integrity-secret-key-32-bytes!",
    isProduction: false,
  });
});

test.afterEach(() => {
  __dangerousResetAuditIntegrityConfigForTests();
});

function createAuditEvent(
  input: Pick<EventRecord, "id" | "taskId" | "sessionId" | "executionId" | "eventType" | "eventTier" | "payloadJson" | "traceId" | "createdAt">,
): EventRecord {
  return {
    ...input,
    schemaVersion: "v4.3",
    aggregateId: input.taskId ?? input.executionId ?? input.id,
    runId: input.executionId ?? input.taskId ?? input.id,
    sequence: 1,
    causationId: null,
    correlationId: input.traceId ?? input.id,
    payloadHash: "sha256:audit",
    idempotencyKey: `idem_${input.id}`,
    replayBehavior: "replay_as_fact",
    principal: "system:test",
    evidenceRefs: [],
  };
}

test("verifyTier1AuditIntegrity accepts an intact Tier 1 event chain", () => {
  const event = createAuditEvent({
    id: "evt-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1" as const,
    payloadJson: "{\"status\":\"running\"}",
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  });
  const eventChecksum = computeTier1AuditEventChecksum(event);
  const chainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum,
    eventId: event.id,
  });

  const report = verifyTier1AuditIntegrity([
    {
      integrityRecord: {
        eventId: event.id,
        chainPosition: 1,
        eventType: event.eventType,
        eventCreatedAt: event.createdAt,
        eventChecksum,
        previousChainHash: null,
        chainHash,
        recordedAt: "2026-04-07T00:00:01.000Z",
        algorithm: "SHA-256",
      },
      event,
    },
  ]);

  assert.equal(report.checked, true);
  assert.equal(report.totalTrackedEvents, 1);
  assert.equal(report.verifiedEvents, 1);
  assert.equal(report.compromisedEvents, 0);
  assert.equal(report.chainBreaks, 0);
  assert.deepEqual(report.findings, []);
});

test("verifyTier1AuditIntegrity reports tampered payload and broken hash chain", () => {
  const firstEvent = createAuditEvent({
    id: "evt-1",
    taskId: "task-1",
    sessionId: null,
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1" as const,
    payloadJson: "{\"status\":\"queued\"}",
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  });
  const firstChecksum = computeTier1AuditEventChecksum(firstEvent);
  const firstChainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: firstChecksum,
    eventId: firstEvent.id,
  });

  const secondEvent = createAuditEvent({
    id: "evt-2",
    taskId: "task-1",
    sessionId: null,
    executionId: "exec-1",
    eventType: "workflow:step_completed",
    eventTier: "tier_1" as const,
    payloadJson: "{\"stepId\":\"analyze_request\"}",
    traceId: "trace-1",
    createdAt: "2026-04-07T00:01:00.000Z",
  });
  const secondChecksum = computeTier1AuditEventChecksum(secondEvent);
  const secondChainHash = computeTier1AuditChainHash({
    chainPosition: 2,
    previousChainHash: firstChainHash,
    eventChecksum: secondChecksum,
    eventId: secondEvent.id,
  });

  const report = verifyTier1AuditIntegrity([
    {
      integrityRecord: {
        eventId: firstEvent.id,
        chainPosition: 1,
        eventType: firstEvent.eventType,
        eventCreatedAt: firstEvent.createdAt,
        eventChecksum: firstChecksum,
        previousChainHash: null,
        chainHash: firstChainHash,
        recordedAt: "2026-04-07T00:00:01.000Z",
        algorithm: "SHA-256",
      },
      event: {
        ...firstEvent,
        payloadJson: "{\"status\":\"tampered\"}",
      },
    },
    {
      integrityRecord: {
        eventId: secondEvent.id,
        chainPosition: 2,
        eventType: secondEvent.eventType,
        eventCreatedAt: secondEvent.createdAt,
        eventChecksum: secondChecksum,
        previousChainHash: "bad-prev-hash",
        chainHash: secondChainHash,
        recordedAt: "2026-04-07T00:01:01.000Z",
        algorithm: "SHA-256",
      },
      event: secondEvent,
    },
  ]);

  assert.equal(report.totalTrackedEvents, 2);
  assert.equal(report.verifiedEvents, 0);
  assert.equal(report.compromisedEvents, 2);
  assert.equal(report.chainBreaks, 2);
  assert.ok(report.findings.includes("audit_event_checksum_mismatch:evt-1"));
  assert.ok(report.findings.includes("audit_chain_prev_hash_mismatch:evt-2"));
});

test("verifyTier1AuditIntegrity handles empty events array", () => {
  const report = verifyTier1AuditIntegrity([]);
  assert.equal(report.checked, true);
  assert.equal(report.totalTrackedEvents, 0);
  assert.equal(report.verifiedEvents, 0);
  assert.equal(report.compromisedEvents, 0);
  assert.equal(report.chainBreaks, 0);
});
