/**
 * Integration tests for DLQ Service with database persistence
 *
 * Tests dead letter queue operations with actual database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DlqService } from "../../../../../src/platform/five-plane-state-evidence/events/dlq-service.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("integration: DLQ service enqueue creates record with all fields", () => {
  const ctx = createIntegrationContext("aa-dlq-enqueue-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-int-001",
      consumerId: "consumer-int-1",
      errorCode: "handler_timeout",
      errorMessage: "Handler timed out after 30 seconds",
      payloadJson: '{"taskId":"t-dlq-1","data":"test"}',
      originalTimestamp: "2026-04-28T10:00:00.000Z",
      failureCategory: "timeout",
      reason: "Consumer handler exceeded timeout threshold",
    });

    assert.ok(record.deadLetterId.startsWith("dlq_"), "Should have valid ID");
    assert.equal(record.sourceEventId, "evt-dlq-int-001");
    assert.equal(record.consumerId, "consumer-int-1");
    assert.equal(record.errorCode, "handler_timeout");
    assert.equal(record.status, "pending");
    assert.equal(record.retryCount, 0);
    assert.equal(record.maxRetries, 5);
    assert.equal(record.failureCategory, "timeout");
    assert.equal(record.reason, "Consumer handler exceeded timeout threshold");
    assert.deepEqual(record.operatorActionLog, []);
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service scheduleRetry uses exponential backoff with database state", () => {
  const ctx = createIntegrationContext("aa-dlq-backoff-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-backoff-001",
      consumerId: "consumer-backoff-int",
      errorCode: "transient_error",
      payloadJson: '{"taskId":"t-backoff-int"}',
    });

    const retry1 = dlq.scheduleRetry(record.deadLetterId);
    assert.equal(retry1.status, "retrying");
    assert.equal(retry1.retryCount, 1);
    assert.ok(retry1.nextRetryAt !== null);

    const retry2 = dlq.scheduleRetry(retry1.deadLetterId);
    assert.equal(retry2.retryCount, 2);

    const retry3 = dlq.scheduleRetry(retry2.deadLetterId);
    assert.equal(retry3.retryCount, 3);

    // Verify backoff is increasing
    const firstDelay = new Date(retry1.nextRetryAt!).getTime() - new Date(retry1.updatedAt).getTime();
    const secondDelay = new Date(retry2.nextRetryAt!).getTime() - new Date(retry2.updatedAt).getTime();
    const thirdDelay = new Date(retry3.nextRetryAt!).getTime() - new Date(retry3.updatedAt).getTime();

    assert.ok(thirdDelay > secondDelay, "Third delay should be greater than second");
    assert.ok(secondDelay > firstDelay, "Second delay should be greater than first");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service markResolved updates status and creates operator action", () => {
  const ctx = createIntegrationContext("aa-dlq-resolve-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-resolve-001",
      consumerId: "consumer-resolve-int",
      errorCode: "recoverable_error",
      payloadJson: '{"taskId":"t-resolve-int"}',
    });

    const resolved = dlq.markResolved(record.deadLetterId, "operator-resolve-1");

    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.nextRetryAt, null);
    assert.ok(resolved.operatorActionLog.length > 0);
    assert.equal(resolved.operatorActionLog[0]!.action, "manual_resolve");
    assert.equal(resolved.operatorActionLog[0]!.operatorId, "operator-resolve-1");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service discard updates status and records reason", () => {
  const ctx = createIntegrationContext("aa-dlq-discard-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-discard-001",
      consumerId: "consumer-discard-int",
      errorCode: "non_recoverable",
      payloadJson: '{"taskId":"t-discard-int"}',
    });

    const discardReason = "Payload schema incompatible - cannot be retried";
    const discarded = dlq.discard(record.deadLetterId, discardReason, "op-discard-1");

    assert.equal(discarded.status, "discarded");
    assert.equal(discarded.errorCode, "non_recoverable");
    assert.equal(discarded.reason, discardReason);
    assert.equal(discarded.operatorActionLog[0]!.action, "manual_discard");
    assert.deepEqual(discarded.operatorActionLog[0]!.details, { discardReason });
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service markRetryExhausted sets retryExhaustedAt", () => {
  const ctx = createIntegrationContext("aa-dlq-exhausted-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-exhausted-001",
      consumerId: "consumer-exhausted-int",
      errorCode: "multiple_failures",
      payloadJson: '{"taskId":"t-exhausted-int"}',
    });

    // Exhaust retries
    let current = record;
    for (let i = 0; i < 5; i++) {
      current = dlq.scheduleRetry(current.deadLetterId);
    }

    const exhausted = dlq.markRetryExhausted(current.deadLetterId, "op-exhausted");

    assert.equal(exhausted.status, "discarded");
    assert.ok(exhausted.retryExhaustedAt !== null, "retryExhaustedAt should be set");
    assert.equal(exhausted.retryCount, 5);
    assert.equal(exhausted.operatorActionLog[exhausted.operatorActionLog.length - 1]!.action, "retry_exhausted");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service setFailureCategory updates category with operator log", () => {
  const ctx = createIntegrationContext("aa-dlq-cat-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-cat-001",
      consumerId: "consumer-cat-int",
      errorCode: "config_missing",
      payloadJson: '{"taskId":"t-cat-int"}',
    });

    const updated = dlq.setFailureCategory(record.deadLetterId, "configuration", "op-cat-1");

    assert.equal(updated.failureCategory, "configuration");
    const lastAction = updated.operatorActionLog[updated.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "category_changed");
    assert.deepEqual(lastAction.details, { previousCategory: null, newCategory: "configuration" });
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service setReason updates reason field", () => {
  const ctx = createIntegrationContext("aa-dlq-reason-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-reason-001",
      consumerId: "consumer-reason-int",
      errorCode: "error",
      payloadJson: '{"taskId":"t-reason-int"}',
    });

    const reason = "Downstream service returned HTTP 503";
    const updated = dlq.setReason(record.deadLetterId, reason);

    assert.equal(updated.reason, reason);
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service logOperatorAction adds custom action to log", () => {
  const ctx = createIntegrationContext("aa-dlq-oplog-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-oplog-001",
      consumerId: "consumer-oplog-int",
      errorCode: "investigation_required",
      payloadJson: '{"taskId":"t-oplog-int"}',
    });

    const logged = dlq.logOperatorAction(
      record.deadLetterId,
      "investigation_started",
      "investigator-1",
      { ticketId: "INC-001", severity: "high" },
    );

    const lastAction = logged.operatorActionLog[logged.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "investigation_started");
    assert.equal(lastAction.operatorId, "investigator-1");
    assert.deepEqual(lastAction.details, { ticketId: "INC-001", severity: "high" });
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service listByConsumer filters correctly", () => {
  const ctx = createIntegrationContext("aa-dlq-list-consumer-int-");
  try {
    const dlq = new DlqService();

    dlq.enqueue({ sourceEventId: "evt-list-c-a", consumerId: "consumer-a-int", errorCode: "e1", payloadJson: "{}" });
    dlq.enqueue({ sourceEventId: "evt-list-c-a2", consumerId: "consumer-a-int", errorCode: "e2", payloadJson: "{}" });
    dlq.enqueue({ sourceEventId: "evt-list-c-b", consumerId: "consumer-b-int", errorCode: "e3", payloadJson: "{}" });

    const consumerARecords = dlq.listByConsumer("consumer-a-int");
    const consumerBRecords = dlq.listByConsumer("consumer-b-int");
    const allRecords = dlq.listAll();

    assert.equal(consumerARecords.length, 2, "Consumer A should have 2 records");
    assert.equal(consumerBRecords.length, 1, "Consumer B should have 1 record");
    assert.equal(allRecords.length, 3, "Total should be 3 records");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service listByStatus filters correctly", () => {
  const ctx = createIntegrationContext("aa-dlq-list-status-int-");
  try {
    const dlq = new DlqService();

    const pending1 = dlq.enqueue({ sourceEventId: "evt-status-p1", consumerId: "cs-int", errorCode: "e1", payloadJson: "{}" });
    const pending2 = dlq.enqueue({ sourceEventId: "evt-status-p2", consumerId: "cs-int", errorCode: "e2", payloadJson: "{}" });
    const retrying = dlq.enqueue({ sourceEventId: "evt-status-r", consumerId: "cs-int", errorCode: "e3", payloadJson: "{}" });
    dlq.scheduleRetry(retrying.deadLetterId, 5000);

    dlq.markResolved(pending1.deadLetterId);
    dlq.discard(pending2.deadLetterId, "discarded_permanently");

    assert.equal(dlq.listByStatus("pending").length, 0);
    assert.equal(dlq.listByStatus("retrying").length, 1);
    assert.equal(dlq.listByStatus("resolved").length, 1);
    assert.equal(dlq.listByStatus("discarded").length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service summarize returns correct statistics", () => {
  const ctx = createIntegrationContext("aa-dlq-summarize-int-");
  try {
    const dlq = new DlqService();

    dlq.enqueue({ sourceEventId: "evt-sum-1", consumerId: "ca", errorCode: "e", payloadJson: "{}", failureCategory: "transient" });
    dlq.enqueue({ sourceEventId: "evt-sum-2", consumerId: "cb", errorCode: "e", payloadJson: "{}", failureCategory: "transient" });
    dlq.enqueue({ sourceEventId: "evt-sum-3", consumerId: "ca", errorCode: "e", payloadJson: "{}", failureCategory: "permanent" });

    const summary = dlq.summarize();

    assert.equal(summary.totalRecords, 3);
    assert.equal(summary.categoryCounts["transient"], 2);
    assert.equal(summary.categoryCounts["permanent"], 1);
    assert.equal(summary.consumerCounts["ca"], 2);
    assert.equal(summary.consumerCounts["cb"], 1);
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service cancelRetry clears retry state", () => {
  const ctx = createIntegrationContext("aa-dlq-cancel-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-cancel-001",
      consumerId: "consumer-cancel-int",
      errorCode: "cancel_error",
      payloadJson: '{"taskId":"t-cancel-int"}',
    });

    dlq.scheduleRetry(record.deadLetterId, 5000);
    const cancelled = dlq.cancelRetry(record.deadLetterId, "op-cancel");

    assert.equal(cancelled.status, "pending");
    assert.equal(cancelled.nextRetryAt, null);
    assert.equal(cancelled.operatorActionLog[cancelled.operatorActionLog.length - 1]!.action, "retry_cancelled");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service scheduleRetry rejects invalid delayMs", () => {
  const ctx = createIntegrationContext("aa-dlq-invalid-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-invalid-001",
      consumerId: "consumer-invalid-int",
      errorCode: "error",
      payloadJson: '{"taskId":"t-invalid-int"}',
    });

    assert.throws(
      () => dlq.scheduleRetry(record.deadLetterId, -100),
      /non-negative finite/,
    );
    assert.throws(
      () => dlq.scheduleRetry(record.deadLetterId, NaN),
      /non-negative finite/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service operations on non-existent record throw ValidationError", () => {
  const ctx = createIntegrationContext("aa-dlq-notfound-int-");
  try {
    const dlq = new DlqService();

    assert.throws(
      () => dlq.scheduleRetry("non-existent-dlq"),
      /was not found/,
    );
    assert.throws(
      () => dlq.markResolved("non-existent-dlq"),
      /was not found/,
    );
    assert.throws(
      () => dlq.discard("non-existent-dlq", "reason"),
      /was not found/,
    );
    assert.equal(dlq.get("non-existent-dlq"), undefined);
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service get returns record or undefined", () => {
  const ctx = createIntegrationContext("aa-dlq-get-int-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-get-001",
      consumerId: "consumer-get-int",
      errorCode: "get_error",
      payloadJson: '{"taskId":"t-get-int"}',
    });

    const found = dlq.get(record.deadLetterId);
    const notFound = dlq.get("non-existent-id");

    assert.ok(found !== undefined, "Should find existing record");
    assert.equal(found!.sourceEventId, "evt-dlq-get-001");
    assert.equal(notFound, undefined, "Non-existent should return undefined");
  } finally {
    ctx.cleanup();
  }
});
