import test from "node:test";
import assert from "node:assert/strict";

import { DeadLetterQueueService } from "../../../../src/platform/state-evidence/dlq/index.js";

test("[SYS-REL-2.3] DLQ enqueue creates record with correct fields", () => {
  const dlq = new DeadLetterQueueService();

  const record = dlq.enqueue({
    sourceEventId: "evt-001",
    consumerId: "consumer-1",
    errorCode: "consumer_timeout",
    payloadJson: '{"taskId":"t-1"}',
  });

  assert.equal(record.sourceEventId, "evt-001", "sourceEventId should match");
  assert.equal(record.consumerId, "consumer-1", "consumerId should match");
  assert.equal(record.errorCode, "consumer_timeout", "errorCode should match");
  assert.equal(record.status, "pending", "Status should be pending");
  assert.equal(record.retryCount, 0, "Retry count should be 0");
});

test("[SYS-REL-2.3] DLQ scheduleRetry updates nextRetryAt correctly", () => {
  const dlq = new DeadLetterQueueService();

  const record = dlq.enqueue({
    sourceEventId: "evt-002",
    consumerId: "consumer-1",
    errorCode: "network_error",
    payloadJson: '{"taskId":"t-2"}',
  });

  const delayMs = 5000;
  const updated = dlq.scheduleRetry(record.deadLetterId, delayMs);

  assert.equal(updated.status, "retrying", "Status should be 'retrying'");
  assert.equal(updated.retryCount, 1, "Retry count should increment");
  assert.ok(updated.nextRetryAt !== null, "nextRetryAt should be set");
});

test("[SYS-REL-2.3] DLQ markResolved updates status", () => {
  const dlq = new DeadLetterQueueService();

  const record = dlq.enqueue({
    sourceEventId: "evt-003",
    consumerId: "consumer-1",
    errorCode: "test_error",
    payloadJson: '{"taskId":"t-3"}',
  });

  dlq.markResolved(record.deadLetterId);

  const records = dlq.listAll();
  const resolved = records.find(r => r.deadLetterId === record.deadLetterId);
  assert.equal(resolved?.status, "resolved", "Status should be 'resolved'");
});

test("[SYS-REL-2.3] DLQ discard updates status and reason", () => {
  const dlq = new DeadLetterQueueService();

  const record = dlq.enqueue({
    sourceEventId: "evt-004",
    consumerId: "consumer-1",
    errorCode: "test_error",
    payloadJson: '{"taskId":"t-4"}',
  });

  dlq.discard(record.deadLetterId, "permanent_failure");

  const records = dlq.listAll();
  const discarded = records.find(r => r.deadLetterId === record.deadLetterId);
  assert.equal(discarded?.status, "discarded", "Status should be 'discarded'");
  assert.equal(discarded?.errorCode, "permanent_failure", "Error code should be updated");
});

test("[SYS-REL-2.3] DLQ listByConsumer returns only matching records", () => {
  const dlq = new DeadLetterQueueService();

  dlq.enqueue({
    sourceEventId: "evt-005",
    consumerId: "consumer-a",
    errorCode: "error",
    payloadJson: '{}',
  });

  dlq.enqueue({
    sourceEventId: "evt-006",
    consumerId: "consumer-b",
    errorCode: "error",
    payloadJson: '{}',
  });

  const consumerARecords = dlq.listByConsumer("consumer-a");
  const allRecords = dlq.listAll();

  assert.equal(consumerARecords.length, 1, "Should return only consumer-a records");
  assert.equal(allRecords.length, 2, "Should have 2 total records");
});

test("[SYS-REL-2.3] DLQ summarize returns summary", () => {
  const dlq = new DeadLetterQueueService();

  dlq.enqueue({
    sourceEventId: "evt-007",
    consumerId: "consumer-1",
    errorCode: "error",
    payloadJson: '{}',
  });

  const summary = dlq.summarize();

  assert.equal(summary.totalRecords, 1, "Should have 1 total record");
  assert.ok("statusCounts" in summary, "Summary should have statusCounts");
  assert.ok("consumerCounts" in summary, "Summary should have consumerCounts");
});
