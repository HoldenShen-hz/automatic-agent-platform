import assert from "node:assert/strict";
import test from "node:test";

import { DeadLetterQueueService } from "../../../../../src/platform/state-evidence/dlq/index.js";

test("DeadLetterQueueService tracks retries and resolution state", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_1",
    consumerId: "approval-center",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":1}",
  });
  const retrying = service.scheduleRetry(record.deadLetterId, 30_000);
  const resolved = service.markResolved(record.deadLetterId);

  assert.equal(retrying.status, "retrying");
  assert.equal(retrying.retryCount, 1);
  assert.equal(resolved.status, "resolved");
});

test("DeadLetterQueueService summarizes backlog by status and consumer", () => {
  const service = new DeadLetterQueueService();
  const first = service.enqueue({
    sourceEventId: "evt_1",
    consumerId: "inspect_projection",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":1}",
  });
  service.scheduleRetry(first.deadLetterId, 30_000);
  service.enqueue({
    sourceEventId: "evt_2",
    consumerId: "approval_projection",
    errorCode: "delivery.denied",
    payloadJson: "{\"step\":2}",
  });

  const summary = service.summarize();

  assert.equal(summary.totalRecords, 2);
  assert.equal(summary.statusCounts.retrying, 1);
  assert.equal(summary.statusCounts.pending, 1);
  assert.ok(summary.pendingConsumers.includes("approval_projection"));
  assert.equal(summary.consumerCounts.inspect_projection, 1);
});

// §28: Tests for extended DLQ fields

test("DeadLetterQueueService enqueue accepts originalTimestamp and failureCategory", () => {
  const service = new DeadLetterQueueService();
  const originalTs = "2026-04-19T10:00:00.000Z";
  const record = service.enqueue({
    sourceEventId: "evt_3",
    consumerId: "task_projection",
    errorCode: "delivery.failed",
    payloadJson: "{\"step\":3}",
    originalTimestamp: originalTs,
    failureCategory: "transient",
  });

  assert.equal(record.originalTimestamp, originalTs);
  assert.equal(record.failureCategory, "transient");
  assert.equal(record.retryExhaustedAt, null);
});

test("DeadLetterQueueService enqueue defaults new fields to null when not provided", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_4",
    consumerId: "task_projection",
    errorCode: "delivery.failed",
    payloadJson: "{\"step\":4}",
  });

  assert.equal(record.originalTimestamp, null);
  assert.equal(record.failureCategory, null);
  assert.equal(record.retryExhaustedAt, null);
});

test("DeadLetterQueueService markRetryExhausted sets retryExhaustedAt", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_5",
    consumerId: "task_projection",
    errorCode: "delivery.failed",
    payloadJson: "{\"step\":5}",
  });

  const exhausted = service.markRetryExhausted(record.deadLetterId);

  assert.equal(exhausted.status, "pending");
  assert.ok(exhausted.retryExhaustedAt !== null);
  assert.equal(exhausted.nextRetryAt, null);
});

test("DeadLetterQueueService markRetryExhausted throws for unknown id", () => {
  const service = new DeadLetterQueueService();
  assert.throws(
    () => service.markRetryExhausted("unknown_dlq"),
    /dlq.not_found/,
  );
});

test("DeadLetterQueueService setFailureCategory updates failureCategory", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_6",
    consumerId: "task_projection",
    errorCode: "delivery.failed",
    payloadJson: "{\"step\":6}",
  });

  const updated = service.setFailureCategory(record.deadLetterId, "permanent");

  assert.equal(updated.failureCategory, "permanent");
  assert.ok(updated.updatedAt !== record.updatedAt);
});

test("DeadLetterQueueService setFailureCategory throws for unknown id", () => {
  const service = new DeadLetterQueueService();
  assert.throws(
    () => service.setFailureCategory("unknown_dlq", "permanent"),
    /dlq.not_found/,
  );
});

test("DeadLetterQueueService discard does not set retryExhaustedAt", () => {
  const service = new DeadLetterQueueService();
  const record = service.enqueue({
    sourceEventId: "evt_7",
    consumerId: "task_projection",
    errorCode: "delivery.failed",
    payloadJson: "{\"step\":7}",
  });

  const discarded = service.discard(record.deadLetterId, "manual_discard");

  assert.equal(discarded.status, "discarded");
  assert.equal(discarded.retryExhaustedAt, null);
});
