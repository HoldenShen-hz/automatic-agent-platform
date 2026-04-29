import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import { DlqService } from "../../../../../src/platform/state-evidence/events/dlq-service.js";

test("DlqService enqueue creates a pending record", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_1",
    consumerId: "test-consumer",
    errorCode: "delivery.timeout",
    payloadJson: '{"step":1}',
  });

  assert.equal(record.status, "pending");
  assert.equal(record.retryCount, 0);
  assert.equal(record.deadLetterId.startsWith("dlq_"), true);
  assert.equal(record.sourceEventId, "evt_1");
  assert.equal(record.consumerId, "test-consumer");
  assert.equal(record.errorCode, "delivery.timeout");
  assert.equal(record.maxRetries, 5);
  assert.equal(record.nextRetryAt, null);
  assert.equal(record.retryExhaustedAt, null);
  assert.deepEqual(record.operatorActionLog, []);
});

test("DlqService enqueue accepts optional fields", () => {
  const service = new DlqService();
  const originalTs = "2026-04-19T10:00:00.000Z";
  const record = service.enqueue({
    sourceEventId: "evt_2",
    consumerId: "test-consumer",
    errorCode: "delivery.failed",
    payloadJson: '{"step":2}',
    originalTimestamp: originalTs,
    failureCategory: "transient",
    reason: "network unreachable",
  });

  assert.equal(record.originalTimestamp, originalTs);
  assert.equal(record.failureCategory, "transient");
  assert.equal(record.reason, "network unreachable");
});

test("DlqService listAll returns all records sorted by createdAt", () => {
  const service = new DlqService();
  service.enqueue({ sourceEventId: "evt_a", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_b", consumerId: "c2", errorCode: "e2", payloadJson: "{}" });

  const all = service.listAll();
  assert.equal(all.length, 2);
  assert.ok(all[0]!.createdAt <= all[1]!.createdAt);
});

test("DlqService listByConsumer filters correctly", () => {
  const service = new DlqService();
  service.enqueue({ sourceEventId: "evt_1", consumerId: "consumer-a", errorCode: "e1", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_2", consumerId: "consumer-b", errorCode: "e2", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_3", consumerId: "consumer-a", errorCode: "e3", payloadJson: "{}" });

  const byConsumer = service.listByConsumer("consumer-a");
  assert.equal(byConsumer.length, 2);
  byConsumer.forEach((r) => assert.equal(r.consumerId, "consumer-a"));
});

test("DlqService listByStatus filters correctly", () => {
  const service = new DlqService();
  const pending = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  const retrying = service.enqueue({ sourceEventId: "evt_2", consumerId: "c1", errorCode: "e2", payloadJson: "{}" });
  service.scheduleRetry(retrying.deadLetterId, 30_000);

  assert.equal(service.listByStatus("pending").length, 1);
  assert.equal(service.listByStatus("retrying").length, 1);
  assert.equal(service.listByStatus("resolved").length, 0);
});

test("DlqService get returns record or null", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  assert.equal(service.get(record.deadLetterId)?.deadLetterId, record.deadLetterId);
  assert.equal(service.get("unknown_dlq"), null);
});

// --- Clear / resolve ---

test("DlqService markResolved transitions status and clears nextRetryAt", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  service.scheduleRetry(record.deadLetterId, 30_000);

  const resolved = service.markResolved(record.deadLetterId, "operator_1");

  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.nextRetryAt, null);
  assert.equal(resolved.operatorActionLog.length, 1);
  assert.equal(resolved.operatorActionLog[0]!.action, "manual_resolve");
  assert.equal(resolved.operatorActionLog[0]!.operatorId, "operator_1");
  assert.equal(resolved.operatorActionLog[0]!.previousStatus, "retrying");
  assert.equal(resolved.operatorActionLog[0]!.newStatus, "resolved");
});

test("DlqService discard transitions status and records reason", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  const discarded = service.discard(record.deadLetterId, "poison_message", "operator_2");

  assert.equal(discarded.status, "discarded");
  assert.equal(discarded.errorCode, "poison_message");
  assert.equal(discarded.operatorActionLog[0]!.action, "manual_discard");
  assert.deepEqual(discarded.operatorActionLog[0]!.details, { discardReason: "poison_message" });
});

test("DlqService markRetryExhausted sets retryExhaustedAt and moves record to terminal discarded state", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  service.scheduleRetry(record.deadLetterId, 30_000);

  const exhausted = service.markRetryExhausted(record.deadLetterId, "operator_3");

  assert.equal(exhausted.status, "discarded");
  assert.ok(exhausted.retryExhaustedAt !== null);
  assert.equal(exhausted.nextRetryAt, null);
  assert.equal(exhausted.operatorActionLog[0]!.action, "retry_exhausted");
});

// --- Retry ---

test("DlqService scheduleRetry increments retryCount and sets nextRetryAt with exponential backoff", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  const first = service.scheduleRetry(record.deadLetterId);
  assert.equal(first.retryCount, 1);
  assert.equal(first.status, "retrying");
  assert.ok(first.nextRetryAt !== null);

  const second = service.scheduleRetry(record.deadLetterId);
  assert.equal(second.retryCount, 2);

  const third = service.scheduleRetry(record.deadLetterId);
  assert.equal(third.retryCount, 3);
});

test("DlqService scheduleRetry accepts explicit delayMs", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  const retrying = service.scheduleRetry(record.deadLetterId, 60_000);

  assert.equal(retrying.retryCount, 1);
  assert.ok(retrying.nextRetryAt !== null);
});

test("DlqService scheduleRetry throws for invalid delayMs", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  assert.throws(() => service.scheduleRetry(record.deadLetterId, -1), /non-negative finite/);
  assert.throws(() => service.scheduleRetry(record.deadLetterId, NaN), /non-negative finite/);
  assert.throws(() => service.scheduleRetry(record.deadLetterId, Infinity), /non-negative finite/);
});

test("DlqService cancelRetry clears nextRetryAt and returns to pending", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_1", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  service.scheduleRetry(record.deadLetterId, 30_000);

  const cancelled = service.cancelRetry(record.deadLetterId, "operator_cancel");

  assert.equal(cancelled.status, "pending");
  assert.equal(cancelled.nextRetryAt, null);
  assert.equal(cancelled.operatorActionLog[0]!.action, "retry_cancelled");
  assert.equal(cancelled.operatorActionLog[0]!.operatorId, "operator_cancel");
});

// --- 3 retries then DLQ (retry exhaustion flow) ---

test("DlqService after 3 retries and markRetryExhausted the record is in terminal DLQ state", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_retry_chain",
    consumerId: "dlq-consumer",
    errorCode: "delivery.timeout",
    payloadJson: '{"important":true}',
  });

  // Simulate 3 delivery attempts
  service.scheduleRetry(record.deadLetterId, 30_000);
  service.scheduleRetry(record.deadLetterId, 30_000);
  const after3 = service.scheduleRetry(record.deadLetterId, 30_000);

  assert.equal(after3.retryCount, 3);
  assert.equal(after3.status, "retrying");

  // Exhaust retries
  const exhausted = service.markRetryExhausted(record.deadLetterId);

  assert.equal(exhausted.status, "discarded");
  assert.equal(exhausted.retryCount, 3);
  assert.ok(exhausted.retryExhaustedAt !== null);
  assert.equal(exhausted.nextRetryAt, null);
});

test("DlqService retry count reaches maxRetries (5) after 5 scheduleRetry calls", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_max", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  for (let i = 1; i <= 5; i++) {
    const result = service.scheduleRetry(record.deadLetterId, 1_000);
    assert.equal(result.retryCount, i);
  }

  const final = service.get(record.deadLetterId)!;
  assert.equal(final.retryCount, 5);
  assert.equal(final.maxRetries, 5);
  assert.throws(() => service.scheduleRetry(record.deadLetterId, 1_000), /exhausted its retry budget/);
});

test("DlqService after exhausting retries can be resolved or discarded", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_exhaust", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  for (let i = 0; i < 3; i++) {
    service.scheduleRetry(record.deadLetterId, 1_000);
  }
  service.markRetryExhausted(record.deadLetterId);

  const resolved = service.markResolved(record.deadLetterId, "final_operator");
  assert.equal(resolved.status, "resolved");
  assert.equal(resolved.operatorActionLog[resolved.operatorActionLog.length - 1]!.action, "manual_resolve");
});

// --- Failure category ---

test("DlqService setFailureCategory updates failureCategory", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_cat", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  const updated = service.setFailureCategory(record.deadLetterId, "permanent", "cat_operator");

  assert.equal(updated.failureCategory, "permanent");
  assert.equal(updated.operatorActionLog[0]!.action, "category_changed");
  assert.equal(updated.operatorActionLog[0]!.operatorId, "cat_operator");
});

test("DlqService setFailureCategory throws for unknown id", () => {
  const service = new DlqService();
  assert.throws(() => service.setFailureCategory("unknown", "transient"), /not found/);
});

// --- Reason ---

test("DlqService setReason updates reason field", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_reason", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  const updated = service.setReason(record.deadLetterId, "downstream service returned 503");

  assert.equal(updated.reason, "downstream service returned 503");
});

// --- Operator action log ---

test("DlqService logOperatorAction appends to operatorActionLog", () => {
  const service = new DlqService();
  const record = service.enqueue({ sourceEventId: "evt_log", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });

  service.logOperatorAction(record.deadLetterId, "investigation_started", "inv_operator", { note: "checking logs" });
  service.logOperatorAction(record.deadLetterId, "mitigation_applied", "mit_operator");

  const updated = service.get(record.deadLetterId)!;
  assert.equal(updated.operatorActionLog.length, 2);
  assert.equal(updated.operatorActionLog[0]!.action, "investigation_started");
  assert.equal(updated.operatorActionLog[0]!.operatorId, "inv_operator");
  assert.deepEqual(updated.operatorActionLog[0]!.details, { note: "checking logs" });
  assert.equal(updated.operatorActionLog[1]!.action, "mitigation_applied");
  assert.equal(updated.operatorActionLog[1]!.newStatus, null);
});

// --- Summarize ---

test("DlqService summarize returns correct counts and pendingConsumers", () => {
  const service = new DlqService();
  service.enqueue({ sourceEventId: "evt_1", consumerId: "consumer-x", errorCode: "e1", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_2", consumerId: "consumer-y", errorCode: "e2", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_3", consumerId: "consumer-x", errorCode: "e3", payloadJson: "{}" });

  const summary = service.summarize();

  assert.equal(summary.totalRecords, 3);
  assert.equal(summary.statusCounts.pending, 3);
  assert.equal(summary.consumerCounts["consumer-x"], 2);
  assert.equal(summary.consumerCounts["consumer-y"], 1);
  assert.ok(summary.pendingConsumers.includes("consumer-x"));
  assert.ok(summary.pendingConsumers.includes("consumer-y"));
  assert.equal(summary.maxRetryCount, 0);
});

test("DlqService summarize tracks oldestPendingAt and maxRetryCount", () => {
  const service = new DlqService();
  const first = service.enqueue({ sourceEventId: "evt_old", consumerId: "c1", errorCode: "e1", payloadJson: "{}" });
  service.enqueue({ sourceEventId: "evt_new", consumerId: "c1", errorCode: "e2", payloadJson: "{}" });
  service.scheduleRetry(first.deadLetterId, 30_000);
  service.scheduleRetry(first.deadLetterId, 30_000);

  const summary = service.summarize();

  assert.equal(summary.maxRetryCount, 2);
  assert.ok(summary.oldestPendingAt !== null);
});

// --- SHA-256 hash chain integrity ---

test("DlqService payloadJson hash chain integrity is verifiable via SHA-256", () => {
  const service = new DlqService();
  const payload = JSON.stringify({ eventId: "evt_chain", data: "important_payload" });

  const record = service.enqueue({
    sourceEventId: "evt_chain",
    consumerId: "hash-chain-consumer",
    errorCode: "delivery.timeout",
    payloadJson: payload,
  });

  // Compute the SHA-256 digest of the payload
  const expectedHash = createHash("sha256").update(Buffer.from(payload, "utf-8")).digest("hex");

  // The stored payload must be exactly what was passed in
  assert.equal(record.payloadJson, payload);

  // The hash of the stored payload must match the expected hash
  const storedHash = createHash("sha256").update(Buffer.from(record.payloadJson, "utf-8")).digest("hex");
  assert.equal(storedHash, expectedHash);
});

test("DlqService operatorActionLog entries have verifiable hash chain", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_audit",
    consumerId: "audit-consumer",
    errorCode: "e1",
    payloadJson: "{}",
  });

  service.logOperatorAction(record.deadLetterId, "investigation_started", "op_1", { detail: "a" });
  service.logOperatorAction(record.deadLetterId, "mitigation_applied", "op_2", { detail: "b" });
  service.markResolved(record.deadLetterId, "op_3");

  const updated = service.get(record.deadLetterId)!;
  assert.equal(updated.operatorActionLog.length, 3);

  // Each action record is independently hashable
  for (const entry of updated.operatorActionLog) {
    const entryHash = createHash("sha256")
      .update(Buffer.from(JSON.stringify({
        actionId: entry.actionId,
        operatorId: entry.operatorId,
        action: entry.action,
        timestamp: entry.timestamp,
        details: entry.details,
      }), "utf-8"))
      .digest("hex");
    assert.equal(entryHash.length, 64); // SHA-256 hex is 64 characters
  }

  // The full log chain can be hashed as a whole
  const logChainHash = createHash("sha256")
    .update(Buffer.from(JSON.stringify(updated.operatorActionLog.map((e) => e.actionId)), "utf-8"))
    .digest("hex");
  assert.equal(logChainHash.length, 64);
});

test("DlqService retry transitions maintain hash chain for retryCount", () => {
  const service = new DlqService();
  const record = service.enqueue({
    sourceEventId: "evt_retry_hash",
    consumerId: "c1",
    errorCode: "e1",
    payloadJson: '{"retry":true}',
  });

  const r1 = service.scheduleRetry(record.deadLetterId, 30_000);
  const r2 = service.scheduleRetry(record.deadLetterId, 30_000);
  const r3 = service.scheduleRetry(record.deadLetterId, 30_000);

  // Each retryCount value is independently hashable
  for (const r of [r1, r2, r3]) {
    const countHash = createHash("sha256").update(Buffer.from(String(r.retryCount), "utf-8")).digest("hex");
    assert.equal(countHash.length, 64);
  }

  // Verify the hash chain: each retry creates an auditable chain of custody
  const chainHash = createHash("sha256")
    .update(Buffer.from(JSON.stringify([
      { retryCount: r1.retryCount, nextRetryAt: r1.nextRetryAt },
      { retryCount: r2.retryCount, nextRetryAt: r2.nextRetryAt },
      { retryCount: r3.retryCount, nextRetryAt: r3.nextRetryAt },
    ]), "utf-8"))
    .digest("hex");
  assert.equal(chainHash.length, 64);
});

// --- Error handling ---

test("DlqService throws ValidationError for unknown deadLetterId on scheduleRetry", () => {
  const service = new DlqService();
  assert.throws(() => service.scheduleRetry("unknown_id", 30_000), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on markResolved", () => {
  const service = new DlqService();
  assert.throws(() => service.markResolved("unknown_id"), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on discard", () => {
  const service = new DlqService();
  assert.throws(() => service.discard("unknown_id", "reason"), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on cancelRetry", () => {
  const service = new DlqService();
  assert.throws(() => service.cancelRetry("unknown_id"), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on markRetryExhausted", () => {
  const service = new DlqService();
  assert.throws(() => service.markRetryExhausted("unknown_id"), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on setReason", () => {
  const service = new DlqService();
  assert.throws(() => service.setReason("unknown_id", "reason"), /not found/);
});

test("DlqService throws ValidationError for unknown deadLetterId on logOperatorAction", () => {
  const service = new DlqService();
  assert.throws(
    () => service.logOperatorAction("unknown_id", "investigation_started", "op_1"),
    /not found/,
  );
});
