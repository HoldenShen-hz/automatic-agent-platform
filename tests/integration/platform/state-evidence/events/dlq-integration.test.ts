/**
 * Integration Test: DLQ Integration
 *
 * Tests dead letter queue operations including enqueue, retry scheduling,
 * failure categorization, operator actions, and audit logging using
 * the extended DlqService with SQLite persistence.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DlqService } from "../../../../../src/platform/state-evidence/events/dlq-service.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("integration: DLQ service enqueue creates record with correct fields", () => {
  const ctx = createIntegrationContext("aa-dlq-enqueue-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-enqueue-001",
      consumerId: "consumer-enqueue",
      errorCode: "consumer_timeout",
      errorMessage: "Consumer timed out after 30s",
      payloadJson: '{"taskId":"t-enqueue-1"}',
      originalTimestamp: "2026-04-25T10:00:00.000Z",
      failureCategory: "timeout",
      reason: "Consumer handler exceeded timeout threshold",
    });

    assert.ok(record.deadLetterId.startsWith("dlq_"), "Dead letter should have valid ID");
    assert.equal(record.sourceEventId, "evt-dlq-enqueue-001", "Source event ID should match");
    assert.equal(record.consumerId, "consumer-enqueue", "Consumer ID should match");
    assert.equal(record.errorCode, "consumer_timeout", "Error code should match");
    assert.equal(record.errorMessage, "Consumer timed out after 30s", "Error message should match");
    assert.equal(record.status, "pending", "Status should be pending");
    assert.equal(record.retryCount, 0, "Retry count should be 0");
    assert.equal(record.maxRetries, 5, "Max retries should default to 5");
    assert.equal(record.failureCategory, "timeout", "Failure category should be set");
    assert.equal(record.reason, "Consumer handler exceeded timeout threshold", "Reason should be set");
    assert.equal(record.originalTimestamp, "2026-04-25T10:00:00.000Z", "Original timestamp should match");
    assert.ok(record.operatorActionLog.length === 0, "Operator action log should be empty initially");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service scheduleRetry uses exponential backoff", () => {
  const ctx = createIntegrationContext("aa-dlq-backoff-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-backoff-001",
      consumerId: "consumer-backoff",
      errorCode: "transient_error",
      payloadJson: '{"taskId":"t-backoff"}',
    });

    // First retry - delay should be base * 2^0 = 30000 * 1 = 30000 (plus jitter)
    const retry1 = dlq.scheduleRetry(record.deadLetterId);
    assert.equal(retry1.status, "retrying", "Status should be retrying after scheduleRetry");
    assert.equal(retry1.retryCount, 1, "Retry count should increment to 1");
    assert.ok(retry1.nextRetryAt !== null, "Next retry time should be set");

    // Second retry - delay should be base * 2^1 = 30000 * 2 = 60000 (plus jitter)
    const retry2 = dlq.scheduleRetry(retry1.deadLetterId);
    assert.equal(retry2.retryCount, 2, "Retry count should increment to 2");

    // Third retry - delay should be base * 2^2 = 30000 * 4 = 120000 (plus jitter)
    const retry3 = dlq.scheduleRetry(retry2.deadLetterId);
    assert.equal(retry3.retryCount, 3, "Retry count should increment to 3");

    // Verify backoff is increasing
    const firstDelay = new Date(retry1.nextRetryAt!).getTime() - new Date(retry1.updatedAt).getTime();
    const secondDelay = new Date(retry2.nextRetryAt!).getTime() - new Date(retry2.updatedAt).getTime();
    const thirdDelay = new Date(retry3.nextRetryAt!).getTime() - new Date(retry3.updatedAt).getTime();

    assert.ok(thirdDelay > secondDelay, "Third retry delay should be greater than second");
    assert.ok(secondDelay > firstDelay, "Second retry delay should be greater than first");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service scheduleRetry respects custom delay", () => {
  const ctx = createIntegrationContext("aa-dlq-custom-delay-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-custom-delay-001",
      consumerId: "consumer-custom",
      errorCode: "custom_error",
      payloadJson: '{"taskId":"t-custom"}',
    });

    const customDelayMs = 5000;
    const updated = dlq.scheduleRetry(record.deadLetterId, customDelayMs);

    assert.equal(updated.status, "retrying", "Status should be retrying");
    assert.equal(updated.retryCount, 1, "Retry count should be 1");

    const scheduledDelay = new Date(updated.nextRetryAt!).getTime() - new Date(updated.updatedAt).getTime();
    assert.ok(Math.abs(scheduledDelay - customDelayMs) < 1000, "Scheduled delay should approximately match custom delay");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service markResolved creates operator action log", () => {
  const ctx = createIntegrationContext("aa-dlq-resolve-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-resolve-001",
      consumerId: "consumer-resolve",
      errorCode: "recoverable_error",
      payloadJson: '{"taskId":"t-resolve"}',
    });

    const operatorId = "operator-1";
    const resolved = dlq.markResolved(record.deadLetterId, operatorId);

    assert.equal(resolved.status, "resolved", "Status should be resolved");
    assert.equal(resolved.nextRetryAt, null, "Next retry should be null after resolve");

    const actionLog = resolved.operatorActionLog;
    assert.ok(actionLog.length > 0, "Operator action log should have entries");
    const lastAction = actionLog[actionLog.length - 1]!;
    assert.equal(lastAction.operatorId, operatorId, "Operator ID should be recorded");
    assert.equal(lastAction.action, "manual_resolve", "Action type should be manual_resolve");
    assert.equal(lastAction.previousStatus, "pending", "Previous status should be pending");
    assert.equal(lastAction.newStatus, "resolved", "New status should be resolved");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service discard updates status and logs operator action", () => {
  const ctx = createIntegrationContext("aa-dlq-discard-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-discard-001",
      consumerId: "consumer-discard",
      errorCode: "non_recoverable",
      payloadJson: '{"taskId":"t-discard"}',
    });

    const discardReason = "Payload schema incompatible with consumer version";
    const discarded = dlq.discard(record.deadLetterId, discardReason, "operator-discard");

    assert.equal(discarded.status, "discarded", "Status should be discarded");
    assert.equal(discarded.errorCode, discardReason, "Error code should be updated to discard reason");
    assert.equal(discarded.nextRetryAt, null, "Next retry should be null after discard");

    const lastAction = discarded.operatorActionLog[discarded.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "manual_discard", "Action should be manual_discard");
    assert.equal(lastAction.details?.discardReason, discardReason, "Discard reason should be in details");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service markRetryExhausted updates status and records timestamp", () => {
  const ctx = createIntegrationContext("aa-dlq-exhausted-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-exhausted-001",
      consumerId: "consumer-exhausted",
      errorCode: "multiple_failures",
      payloadJson: '{"taskId":"t-exhausted"}',
    });

    // Exhaust retries by calling scheduleRetry up to maxRetries
    let current = record;
    for (let i = 0; i < 5; i++) {
      current = dlq.scheduleRetry(current.deadLetterId);
    }

    // Now mark as retry exhausted
    const exhausted = dlq.markRetryExhausted(current.deadLetterId, "operator-exhausted");

    assert.equal(exhausted.status, "pending", "Status should return to pending");
    assert.ok(exhausted.retryExhaustedAt !== null, "Retry exhausted timestamp should be set");
    assert.equal(exhausted.retryCount, 5, "Retry count should be preserved at 5");
    assert.equal(exhausted.nextRetryAt, null, "Next retry should be null");

    const lastAction = exhausted.operatorActionLog[exhausted.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "retry_exhausted", "Action should be retry_exhausted");
    assert.deepEqual(lastAction.details, { retryCount: 5, maxRetries: 5 }, "Details should include retry counts");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service setFailureCategory updates category and logs action", () => {
  const ctx = createIntegrationContext("aa-dlq-category-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-category-001",
      consumerId: "consumer-category",
      errorCode: "config_missing",
      payloadJson: '{"taskId":"t-category"}',
    });

    const categorized = dlq.setFailureCategory(record.deadLetterId, "configuration", "operator-cat");

    assert.equal(categorized.failureCategory, "configuration", "Failure category should be updated");
    assert.ok(categorized.updatedAt >= categorized.createdAt, "Updated timestamp should not move backwards");

    const lastAction = categorized.operatorActionLog[categorized.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "category_changed", "Action should be category_changed");
    assert.deepEqual(lastAction.details, {
      previousCategory: null,
      newCategory: "configuration",
    }, "Details should include category transition");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service setReason updates reason field", () => {
  const ctx = createIntegrationContext("aa-dlq-reason-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-reason-001",
      consumerId: "consumer-reason",
      errorCode: "error",
      payloadJson: '{"taskId":"t-reason"}',
    });

    const reason = "Handler could not parse incoming payload as JSON";
    const updated = dlq.setReason(record.deadLetterId, reason);

    assert.equal(updated.reason, reason, "Reason should be updated");
    assert.ok(updated.updatedAt >= updated.createdAt, "Updated at should reflect the persisted reason update");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service logOperatorAction adds custom operator action to log", () => {
  const ctx = createIntegrationContext("aa-dlq-oplog-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-oplog-001",
      consumerId: "consumer-oplog",
      errorCode: "investigation_required",
      payloadJson: '{"taskId":"t-oplog"}',
    });

    const logged = dlq.logOperatorAction(
      record.deadLetterId,
      "investigation_started",
      "operator-investigate",
      { ticketId: "INC-001", severity: "high" },
    );

    const lastAction = logged.operatorActionLog[logged.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "investigation_started", "Action should match");
    assert.equal(lastAction.operatorId, "operator-investigate", "Operator ID should match");
    assert.deepEqual(lastAction.details, { ticketId: "INC-001", severity: "high" }, "Details should match");
    assert.equal(lastAction.previousStatus, "pending", "Previous status should be pending");
    assert.equal(lastAction.newStatus, null, "New status should be null for this action type");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service listByConsumer returns only matching records", () => {
  const ctx = createIntegrationContext("aa-dlq-list-consumer-");
  try {
    const dlq = new DlqService();

    dlq.enqueue({
      sourceEventId: "evt-consumer-a-001",
      consumerId: "consumer-a",
      errorCode: "error_a",
      payloadJson: '{"taskId":"t-a"}',
    });

    dlq.enqueue({
      sourceEventId: "evt-consumer-a-002",
      consumerId: "consumer-a",
      errorCode: "error_a2",
      payloadJson: '{"taskId":"t-a2"}',
    });

    dlq.enqueue({
      sourceEventId: "evt-consumer-b-001",
      consumerId: "consumer-b",
      errorCode: "error_b",
      payloadJson: '{"taskId":"t-b"}',
    });

    const consumerARecords = dlq.listByConsumer("consumer-a");
    const consumerBRecords = dlq.listByConsumer("consumer-b");
    const allRecords = dlq.listAll();

    assert.equal(consumerARecords.length, 2, "Consumer A should have 2 records");
    assert.equal(consumerBRecords.length, 1, "Consumer B should have 1 record");
    assert.equal(allRecords.length, 3, "Total records should be 3");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service listByStatus returns only matching status", () => {
  const ctx = createIntegrationContext("aa-dlq-list-status-");
  try {
    const dlq = new DlqService();

    const pending1 = dlq.enqueue({
      sourceEventId: "evt-status-pending-1",
      consumerId: "consumer-status",
      errorCode: "pending_error",
      payloadJson: '{"taskId":"t-pending-1"}',
    });

    const pending2 = dlq.enqueue({
      sourceEventId: "evt-status-pending-2",
      consumerId: "consumer-status",
      errorCode: "pending_error_2",
      payloadJson: '{"taskId":"t-pending-2"}',
    });

    const retrying = dlq.enqueue({
      sourceEventId: "evt-status-retrying",
      consumerId: "consumer-status",
      errorCode: "retrying_error",
      payloadJson: '{"taskId":"t-retrying"}',
    });
    dlq.scheduleRetry(retrying.deadLetterId, 5000);

    dlq.markResolved(pending1.deadLetterId);
    dlq.discard(pending2.deadLetterId, "discarded_permanently");

    const pendingRecords = dlq.listByStatus("pending");
    const retryingRecords = dlq.listByStatus("retrying");
    const resolvedRecords = dlq.listByStatus("resolved");
    const discardedRecords = dlq.listByStatus("discarded");

    assert.equal(pendingRecords.length, 0, "No pending records should remain");
    assert.equal(retryingRecords.length, 1, "Should have 1 retrying record");
    assert.equal(resolvedRecords.length, 1, "Should have 1 resolved record");
    assert.equal(discardedRecords.length, 1, "Should have 1 discarded record");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service summarize returns correct statistics", () => {
  const ctx = createIntegrationContext("aa-dlq-summarize-");
  try {
    const dlq = new DlqService();

    dlq.enqueue({
      sourceEventId: "evt-sum-1",
      consumerId: "consumer-sum-a",
      errorCode: "error",
      payloadJson: '{"taskId":"t-sum-1"}',
      failureCategory: "transient",
    });

    dlq.enqueue({
      sourceEventId: "evt-sum-2",
      consumerId: "consumer-sum-b",
      errorCode: "error",
      payloadJson: '{"taskId":"t-sum-2"}',
      failureCategory: "transient",
    });

    dlq.enqueue({
      sourceEventId: "evt-sum-3",
      consumerId: "consumer-sum-a",
      errorCode: "error",
      payloadJson: '{"taskId":"t-sum-3"}',
      failureCategory: "permanent",
    });

    const summary = dlq.summarize();

    assert.equal(summary.totalRecords, 3, "Total records should be 3");
    assert.deepEqual(summary.statusCounts, {
      pending: 3,
      retrying: 0,
      discarded: 0,
      resolved: 0,
    }, "Status counts should reflect all pending");
    assert.equal(summary.categoryCounts["transient"], 2, "Transient category count should be 2");
    assert.equal(summary.categoryCounts["permanent"], 1, "Permanent category count should be 1");
    assert.equal(summary.consumerCounts["consumer-sum-a"], 2, "Consumer A should have 2 records");
    assert.equal(summary.consumerCounts["consumer-sum-b"], 1, "Consumer B should have 1 record");
    assert.ok(summary.pendingConsumers.includes("consumer-sum-a"), "Pending consumers should include A");
    assert.ok(summary.pendingConsumers.includes("consumer-sum-b"), "Pending consumers should include B");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service cancelRetry clears nextRetryAt and status", () => {
  const ctx = createIntegrationContext("aa-dlq-cancel-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-cancel-001",
      consumerId: "consumer-cancel",
      errorCode: "cancel_error",
      payloadJson: '{"taskId":"t-cancel"}',
    });

    dlq.scheduleRetry(record.deadLetterId, 5000);
    const cancelled = dlq.cancelRetry(record.deadLetterId, "operator-cancel");

    assert.equal(cancelled.status, "pending", "Status should return to pending");
    assert.equal(cancelled.nextRetryAt, null, "Next retry should be null");

    const lastAction = cancelled.operatorActionLog[cancelled.operatorActionLog.length - 1]!;
    assert.equal(lastAction.action, "retry_cancelled", "Action should be retry_cancelled");
    assert.deepEqual(lastAction.details, { retryCount: 1 }, "Details should include retry count at cancel time");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service get returns specific record or undefined", () => {
  const ctx = createIntegrationContext("aa-dlq-get-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-get-001",
      consumerId: "consumer-get",
      errorCode: "get_error",
      payloadJson: '{"taskId":"t-get"}',
    });

    const found = dlq.get(record.deadLetterId);
    const notFound = dlq.get("non-existent-id");

    assert.ok(found !== undefined, "Should find existing record");
    assert.equal(found?.sourceEventId, "evt-dlq-get-001", "Found record should match");
    assert.equal(notFound, undefined, "Non-existent ID should return undefined");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service scheduleRetry rejects invalid delay", () => {
  const ctx = createIntegrationContext("aa-dlq-invalid-delay-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-invalid-delay-001",
      consumerId: "consumer-invalid",
      errorCode: "error",
      payloadJson: '{"taskId":"t-invalid"}',
    });

    assert.throws(
      () => dlq.scheduleRetry(record.deadLetterId, -100),
      (err: Error) => /non-negative finite/i.test(err.message),
      "Should reject negative delay",
    );

    assert.throws(
      () => dlq.scheduleRetry(record.deadLetterId, NaN),
      (err: Error) => /non-negative finite/i.test(err.message),
      "Should reject NaN delay",
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service operations on non-existent record throw", () => {
  const ctx = createIntegrationContext("aa-dlq-not-found-");
  try {
    const dlq = new DlqService();

    assert.throws(
      () => dlq.scheduleRetry("non-existent-dlq-id"),
      (err: Error) => /was not found/i.test(err.message),
      "Should throw when scheduling retry on non-existent record",
    );

    assert.throws(
      () => dlq.markResolved("non-existent-dlq-id"),
      (err: Error) => /was not found/i.test(err.message),
      "Should throw when marking resolved on non-existent record",
    );

    assert.throws(
      () => dlq.discard("non-existent-dlq-id", "reason"),
      (err: Error) => /was not found/i.test(err.message),
      "Should throw when discarding non-existent record",
    );

    assert.equal(dlq.get("non-existent-dlq-id"), undefined, "Should return undefined for missing record");
  } finally {
    ctx.cleanup();
  }
});
