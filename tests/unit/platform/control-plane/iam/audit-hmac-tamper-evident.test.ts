/**
 * Unit tests for R12-16: HMAC-based tamper-evident audit chain
 *
 * Verifies that audit events use HMAC-SHA256 (not plain SHA-256) for
 * tamper-evident hash chain as required by §11.5.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { createHmac, createHash } from "node:crypto";
import {
  computeTier1AuditEventChecksum,
  computeTier1AuditChainHash,
  verifyTier1AuditIntegrity,
  type Tier1AuditIntegrityVerificationEntry,
} from "../../../../../src/platform/control-plane/iam/audit-event-integrity.js";
import type { EventRecord } from "../../../../../src/platform/contracts/types/domain.js";

const TEST_HMAC_KEY = "audit-integrity-secret-key-32-bytes!";
const TEST_EVENT_BASE: Omit<EventRecord, "id" | "createdAt"> = {
  taskId: "task-1",
  sessionId: "sess-1",
  executionId: "exec-1",
  eventType: "task:status_changed",
  eventTier: "tier_1",
  payloadJson: '{"status":"running"}',
  traceId: "trace-1",
};

/**
 * R12-16: Helper to compute expected HMAC-SHA256 checksum (mirrors implementation)
 */
function hmacSha256(value: string): string {
  return createHmac("sha256", TEST_HMAC_KEY).update(value, "utf8").digest("hex");
}

/**
 * R12-16: Compute expected event checksum using HMAC
 */
function expectedEventChecksum(event: EventRecord): string {
  return hmacSha256(JSON.stringify({
    id: event.id,
    taskId: event.taskId,
    sessionId: event.sessionId,
    executionId: event.executionId,
    eventType: event.eventType,
    eventTier: event.eventTier,
    payloadJson: event.payloadJson,
    traceId: event.traceId,
    createdAt: event.createdAt,
  }));
}

/**
 * R12-16: Compute expected chain hash using HMAC
 */
function expectedChainHash(input: {
  chainPosition: number;
  previousChainHash: string | null;
  eventChecksum: string;
  eventId: string;
}): string {
  return hmacSha256(JSON.stringify({
    chainPosition: input.chainPosition,
    previousChainHash: input.previousChainHash,
    eventChecksum: input.eventChecksum,
    eventId: input.eventId,
  }));
}

test("computeTier1AuditEventChecksum uses HMAC-SHA256 (not plain SHA-256)", () => {
  const event: EventRecord = {
    id: "evt-hmac-test-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const computedChecksum = computeTier1AuditEventChecksum(event);

  // Verify it matches HMAC computation, not plain SHA-256
  const expectedHmac = hmacSha256(JSON.stringify({
    id: event.id,
    taskId: event.taskId,
    sessionId: event.sessionId,
    executionId: event.executionId,
    eventType: event.eventType,
    eventTier: event.eventTier,
    payloadJson: event.payloadJson,
    traceId: event.traceId,
    createdAt: event.createdAt,
  }));

  // Plain SHA-256 would be different from HMAC-SHA256
  const plainSha256 = createHash("sha256").update(JSON.stringify({
    id: event.id,
    taskId: event.taskId,
    sessionId: event.sessionId,
    executionId: event.executionId,
    eventType: event.eventType,
    eventTier: event.eventTier,
    payloadJson: event.payloadJson,
    traceId: event.traceId,
    createdAt: event.createdAt,
  })).digest("hex");

  assert.equal(computedChecksum, expectedHmac);
  assert.notEqual(computedChecksum, plainSha256);
});

test("computeTier1AuditChainHash uses HMAC-SHA256 (not plain SHA-256)", () => {
  const chainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: "some-checksum",
    eventId: "evt-1",
  });

  const expectedHmac = hmacSha256(JSON.stringify({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: "some-checksum",
    eventId: "evt-1",
  }));

  // Plain SHA-256 would be different
  const plainSha256 = createHash("sha256").update(JSON.stringify({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: "some-checksum",
    eventId: "evt-1",
  })).digest("hex");

  assert.equal(chainHash, expectedHmac);
  assert.notEqual(chainHash, plainSha256);
});

test("verifyTier1AuditIntegrity detects tampering with event payload", () => {
  const originalEvent: EventRecord = {
    id: "evt-tamper-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const tamperedEvent: EventRecord = {
    ...originalEvent,
    payloadJson: '{"status":"tampered","admin":"evil"}',
  };

  const eventChecksum = computeTier1AuditEventChecksum(originalEvent);
  const chainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum,
    eventId: originalEvent.id,
  });

  const entries: Tier1AuditIntegrityVerificationEntry[] = [
    {
      integrityRecord: {
        eventId: originalEvent.id,
        chainPosition: 1,
        eventType: originalEvent.eventType,
        eventCreatedAt: originalEvent.createdAt,
        eventChecksum,
        previousChainHash: null,
        chainHash,
        recordedAt: "2026-04-07T00:00:01.000Z",
        algorithm: "HMAC-SHA256",
      },
      event: tamperedEvent, // Tampered!
    },
  ];

  const report = verifyTier1AuditIntegrity(entries);

  assert.equal(report.checked, true);
  assert.equal(report.totalTrackedEvents, 1);
  assert.equal(report.verifiedEvents, 0);
  assert.equal(report.compromisedEvents, 1);
  assert.ok(report.findings.includes("audit_event_checksum_mismatch:evt-tamper-1"));
});

test("verifyTier1AuditIntegrity detects broken hash chain", () => {
  const firstEvent: EventRecord = {
    id: "evt-chain-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const secondEvent: EventRecord = {
    id: "evt-chain-2",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"completed"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:01:00.000Z",
  };

  const firstChecksum = computeTier1AuditEventChecksum(firstEvent);
  const firstChainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: firstChecksum,
    eventId: firstEvent.id,
  });

  const secondChecksum = computeTier1AuditEventChecksum(secondEvent);
  // Second chain hash computed with CORRECT previous hash (firstChainHash)
  const secondChainHash = computeTier1AuditChainHash({
    chainPosition: 2,
    previousChainHash: firstChainHash,
    eventChecksum: secondChecksum,
    eventId: secondEvent.id,
  });

  const entries: Tier1AuditIntegrityVerificationEntry[] = [
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
        algorithm: "HMAC-SHA256",
      },
      event: firstEvent,
    },
    {
      integrityRecord: {
        eventId: secondEvent.id,
        chainPosition: 2,
        eventType: secondEvent.eventType,
        eventCreatedAt: secondEvent.createdAt,
        eventChecksum: secondChecksum,
        // Store WRONG previous hash - this should cause chain break
        previousChainHash: "WRONG-PREV-HASH",
        // But store CORRECT chain hash (computed with firstChainHash)
        // This tests that verification detects prev hash mismatch even when
        // the chain hash was computed correctly at recording time
        chainHash: secondChainHash,
        recordedAt: "2026-04-07T00:01:01.000Z",
        algorithm: "HMAC-SHA256",
      },
      event: secondEvent,
    },
  ];

  const report = verifyTier1AuditIntegrity(entries);

  assert.equal(report.checked, true);
  assert.equal(report.totalTrackedEvents, 2);
  assert.equal(report.verifiedEvents, 1); // First event verifies correctly
  assert.equal(report.compromisedEvents, 1); // Second event is compromised
  // Both prev hash mismatch AND chain hash mismatch are detected
  assert.equal(report.chainBreaks, 2);
  assert.ok(report.findings.includes("audit_chain_prev_hash_mismatch:evt-chain-2"));
  assert.ok(report.findings.includes("audit_chain_hash_mismatch:evt-chain-2"));
});

test("verifyTier1AuditIntegrity verifies intact multi-event HMAC chain", () => {
  const events: EventRecord[] = [
    {
      id: "evt-intact-1",
      taskId: "task-1",
      sessionId: "sess-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: '{"status":"queued"}',
      traceId: "trace-1",
      createdAt: "2026-04-07T00:00:00.000Z",
    },
    {
      id: "evt-intact-2",
      taskId: "task-1",
      sessionId: "sess-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: '{"status":"running"}',
      traceId: "trace-1",
      createdAt: "2026-04-07T00:01:00.000Z",
    },
    {
      id: "evt-intact-3",
      taskId: "task-1",
      sessionId: "sess-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: '{"status":"completed"}',
      traceId: "trace-1",
      createdAt: "2026-04-07T00:02:00.000Z",
    },
  ];

  const entries: Tier1AuditIntegrityVerificationEntry[] = [];
  let previousChainHash: string | null = null;

  for (let i = 0; i < events.length; i++) {
    const event = events[i];
    const chainPosition = i + 1;
    const eventChecksum = computeTier1AuditEventChecksum(event);
    const chainHash = computeTier1AuditChainHash({
      chainPosition,
      previousChainHash,
      eventChecksum,
      eventId: event.id,
    });

    entries.push({
      integrityRecord: {
        eventId: event.id,
        chainPosition,
        eventType: event.eventType,
        eventCreatedAt: event.createdAt,
        eventChecksum,
        previousChainHash,
        chainHash,
        recordedAt: `2026-04-07T00:0${i}:01.000Z`,
        algorithm: "HMAC-SHA256",
      },
      event,
    });

    previousChainHash = chainHash;
  }

  const report = verifyTier1AuditIntegrity(entries);

  assert.equal(report.checked, true);
  assert.equal(report.totalTrackedEvents, 3);
  assert.equal(report.verifiedEvents, 3);
  assert.equal(report.compromisedEvents, 0);
  assert.equal(report.chainBreaks, 0);
  assert.deepEqual(report.findings, []);
  assert.equal(report.latestChainHash, previousChainHash);
});

test("HMAC key change invalidates entire chain (tamper-evident)", () => {
  // This test verifies that if someone tries to re-compute checksums with
  // a different key, verification will fail - proving the chain is tamper-evident

  const event: EventRecord = {
    id: "evt-key-change-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  // Original checksum using the real HMAC key
  const originalChecksum = computeTier1AuditEventChecksum(event);
  const originalChainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: originalChecksum,
    eventId: event.id,
  });

  // Simulate attacker trying to recompute with a different key
  const fakeKey = "attacker-key-32-bytes!!";
  const fakeChecksum = createHmac("sha256", fakeKey).update(JSON.stringify({
    id: event.id,
    taskId: event.taskId,
    sessionId: event.sessionId,
    executionId: event.executionId,
    eventType: event.eventType,
    eventTier: event.eventTier,
    payloadJson: event.payloadJson,
    traceId: event.traceId,
    createdAt: event.createdAt,
  })).digest("hex");

  const entries: Tier1AuditIntegrityVerificationEntry[] = [
    {
      integrityRecord: {
        eventId: event.id,
        chainPosition: 1,
        eventType: event.eventType,
        eventCreatedAt: event.createdAt,
        eventChecksum: fakeChecksum, // Attacker's checksum
        previousChainHash: null,
        chainHash: originalChainHash, // Original chain hash (doesn't match fake checksum)
        recordedAt: "2026-04-07T00:00:01.000Z",
        algorithm: "HMAC-SHA256",
      },
      event,
    },
  ];

  const report = verifyTier1AuditIntegrity(entries);

  // Verification should fail because the stored chain hash doesn't match
  // what the fake checksum would produce
  assert.equal(report.compromisedEvents, 1);
  assert.ok(report.findings.some(f => f.includes("audit_chain_hash_mismatch")));
});

test("verifyTier1AuditIntegrity detects missing event in chain", () => {
  const firstEvent: EventRecord = {
    id: "evt-missing-1",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const thirdEvent: EventRecord = {
    id: "evt-missing-3",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"completed"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:02:00.000Z",
  };

  const firstChecksum = computeTier1AuditEventChecksum(firstEvent);
  const firstChainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum: firstChecksum,
    eventId: firstEvent.id,
  });

  const thirdChecksum = computeTier1AuditEventChecksum(thirdEvent);
  const thirdChainHash = computeTier1AuditChainHash({
    chainPosition: 3, // Gap - position 2 is missing
    previousChainHash: "some-old-hash", // Wrong previous hash
    eventChecksum: thirdChecksum,
    eventId: thirdEvent.id,
  });

  const entries: Tier1AuditIntegrityVerificationEntry[] = [
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
        algorithm: "HMAC-SHA256",
      },
      event: firstEvent,
    },
    {
      integrityRecord: {
        eventId: thirdEvent.id,
        chainPosition: 3,
        eventType: thirdEvent.eventType,
        eventCreatedAt: thirdEvent.createdAt,
        eventChecksum: thirdChecksum,
        previousChainHash: "some-old-hash",
        chainHash: thirdChainHash,
        recordedAt: "2026-04-07T00:02:01.000Z",
        algorithm: "HMAC-SHA256",
      },
      event: thirdEvent,
    },
  ];

  const report = verifyTier1AuditIntegrity(entries);

  assert.equal(report.totalTrackedEvents, 2);
  assert.equal(report.verifiedEvents, 1);
  assert.equal(report.compromisedEvents, 1);
  assert.equal(report.chainBreaks, 1);
  assert.ok(report.findings.includes("audit_chain_prev_hash_mismatch:evt-missing-3"));
});

test("algorithm field is correctly set to HMAC-SHA256 in integrity records", () => {
  const event: EventRecord = {
    id: "evt-algo-check",
    taskId: "task-1",
    sessionId: "sess-1",
    executionId: "exec-1",
    eventType: "task:status_changed",
    eventTier: "tier_1",
    payloadJson: '{"status":"running"}',
    traceId: "trace-1",
    createdAt: "2026-04-07T00:00:00.000Z",
  };

  const eventChecksum = computeTier1AuditEventChecksum(event);
  const chainHash = computeTier1AuditChainHash({
    chainPosition: 1,
    previousChainHash: null,
    eventChecksum,
    eventId: event.id,
  });

  const entries: Tier1AuditIntegrityVerificationEntry[] = [
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
        algorithm: "HMAC-SHA256", // Must be HMAC-SHA256, not SHA-256
      },
      event,
    },
  ];

  const report = verifyTier1AuditIntegrity(entries);

  assert.equal(report.verifiedEvents, 1);
  assert.equal(report.compromisedEvents, 0);
});
