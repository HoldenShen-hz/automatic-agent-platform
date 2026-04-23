import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { DeadLetterQueueRetryWorker, DeadLetterQueueService } from "../../../../src/platform/state-evidence/dlq/index.js";
import { SqliteDeadLetterQueueRepository } from "../../../../src/platform/state-evidence/truth/sqlite/repositories/dlq-repository.js";

function createInMemoryDb(): DatabaseSync {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE dlq_records (
      dead_letter_id TEXT PRIMARY KEY,
      source_event_id TEXT NOT NULL,
      consumer_id TEXT NOT NULL,
      error_code TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      next_retry_at TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_timestamp TEXT NULL,
      failure_category TEXT NULL,
      retry_exhausted_at TEXT NULL
    )
  `);
  return db;
}

test("[SYS-REL-2.3] DLQ enqueue creates record with correct fields", () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

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

test("[SYS-REL-2.3] DLQ records survive service reconstruction (persistence across restart)", () => {
  // Create first service instance with a real SQLite repository
  const db = createInMemoryDb();
  const dlq1 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  dlq1.enqueue({
    sourceEventId: "evt-001",
    consumerId: "consumer-1",
    errorCode: "consumer_timeout",
    payloadJson: '{"taskId":"t-1"}',
  });

  // Create second service instance (simulating restart/reconstruction)
  const dlq2 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  // Verify records persist across instances
  assert.equal(dlq2.listAll().length, 1, "Records must persist across instances");
  const records = dlq2.listAll();
  assert.equal(records[0]?.sourceEventId, "evt-001");
});

test("[SYS-REL-2.3] DLQ multiple records persist across service reconstruction", () => {
  // Create first service instance with a real SQLite repository
  const db = createInMemoryDb();
  const dlq1 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  dlq1.enqueue({
    sourceEventId: "evt-persist-001",
    consumerId: "consumer-persist",
    errorCode: "error_a",
    payloadJson: '{"taskId":"t-a"}',
  });

  dlq1.enqueue({
    sourceEventId: "evt-persist-002",
    consumerId: "consumer-persist",
    errorCode: "error_b",
    payloadJson: '{"taskId":"t-b"}',
  });

  dlq1.enqueue({
    sourceEventId: "evt-persist-003",
    consumerId: "consumer-other",
    errorCode: "error_c",
    payloadJson: '{"taskId":"t-c"}',
  });

  // Create second service instance (simulating restart/reconstruction)
  const dlq2 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  // Verify all records persist
  const allRecords = dlq2.listAll();
  assert.equal(allRecords.length, 3, "All 3 records must persist across instances");

  // Verify consumer filtering also works on reconstructed instance
  const consumerRecords = dlq2.listByConsumer("consumer-persist");
  assert.equal(consumerRecords.length, 2, "Consumer filtering must work on reconstructed instance");

  // Verify specific record data integrity
  const specificRecord = dlq2.listAll().find(r => r.sourceEventId === "evt-persist-001");
  assert.ok(specificRecord, "Specific record should be findable");
  assert.equal(specificRecord?.errorCode, "error_a", "Record data must be intact");
});

test("[SYS-REL-2.3] DLQ state mutations persist across service reconstruction", () => {
  // Create first service instance
  const db = createInMemoryDb();
  const dlq1 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  const record = dlq1.enqueue({
    sourceEventId: "evt-mutate-001",
    consumerId: "consumer-mutate",
    errorCode: "initial_error",
    payloadJson: '{"taskId":"t-mutate"}',
  });

  // Mark as retrying
  dlq1.scheduleRetry(record.deadLetterId, 5000);

  // Mark as resolved
  dlq1.markResolved(record.deadLetterId);

  // Create second service instance (simulating restart/reconstruction)
  const dlq2 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  const resolvedRecords = dlq2.listAll();
  assert.equal(resolvedRecords.length, 1, "Should have 1 record after mutation");
  assert.equal(resolvedRecords[0]?.status, "resolved", "Status mutation must persist");
  assert.equal(resolvedRecords[0]?.errorCode, "initial_error", "Original error code must be preserved");
});

test("[SYS-REL-2.3] DLQ idempotency - same sourceEventId does not create duplicate records", () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  // Enqueue first time
  const record1 = dlq.enqueue({
    sourceEventId: "evt-idempotent-001",
    consumerId: "consumer-1",
    errorCode: "first_error",
    payloadJson: '{"taskId":"t-1"}',
  });

  // Enqueue second time with same sourceEventId - should not create duplicate
  const record2 = dlq.enqueue({
    sourceEventId: "evt-idempotent-001",
    consumerId: "consumer-1",
    errorCode: "second_error",
    payloadJson: '{"taskId":"t-1-updated"}',
  });

  // Should have only one record
  const allRecords = dlq.listAll();
  assert.equal(allRecords.length, 1, "Same sourceEventId should not create duplicate records");

  // First record should be returned, not updated (no update on duplicate enqueue)
  assert.equal(record1.deadLetterId, record2.deadLetterId, "Should return same deadLetterId on duplicate enqueue");
  assert.equal(record1.errorCode, "first_error", "Original error code should be preserved");
});

test("[SYS-REL-2.3] DLQ idempotency - same sourceEventId from different consumers creates separate records", () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  // Same eventId but different consumer
  dlq.enqueue({
    sourceEventId: "evt-shared-001",
    consumerId: "consumer-a",
    errorCode: "error_a",
    payloadJson: '{"taskId":"t-a"}',
  });

  dlq.enqueue({
    sourceEventId: "evt-shared-001",
    consumerId: "consumer-b",
    errorCode: "error_b",
    payloadJson: '{"taskId":"t-b"}',
  });

  const allRecords = dlq.listAll();
  assert.equal(allRecords.length, 2, "Same eventId from different consumers should create separate records");

  const consumerARecords = dlq.listByConsumer("consumer-a");
  const consumerBRecords = dlq.listByConsumer("consumer-b");
  assert.equal(consumerARecords.length, 1, "Consumer A should have 1 record");
  assert.equal(consumerBRecords.length, 1, "Consumer B should have 1 record");
});

test("[SYS-REL-2.3] DLQ retry worker processes retryable records", async () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));
  const worker = new DeadLetterQueueRetryWorker(dlq);

  const record = dlq.enqueue({
    sourceEventId: "evt-retry-worker-001",
    consumerId: "consumer-retry",
    errorCode: "transient_error",
    payloadJson: '{"taskId":"t-retry"}',
  });

  // Schedule a retry with a short delay
  const scheduled = dlq.scheduleRetry(record.deadLetterId, 10);

  // Process due retries - retry callback returns "retry" with delay
  const result = await worker.runDueRetries((rec) => {
    return { outcome: "retry" as const, delayMs: 50 };
  }, scheduled.nextRetryAt ?? undefined);

  assert.equal(result.attempted, 1, "Should have attempted 1 record");
  assert.equal(result.rescheduled, 1, "Should have rescheduled 1 record");
  assert.equal(result.resolved, 0, "Should not have resolved any");
  assert.equal(result.failed, 0, "Should not have failed any");
});

test("[SYS-REL-2.3] DLQ retry worker resolves records that succeed", async () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));
  const worker = new DeadLetterQueueRetryWorker(dlq);

  const record = dlq.enqueue({
    sourceEventId: "evt-retry-resolve-001",
    consumerId: "consumer-resolve",
    errorCode: "recoverable_error",
    payloadJson: '{"taskId":"t-resolve"}',
  });

  // Schedule retry
  const scheduled = dlq.scheduleRetry(record.deadLetterId, 5);

  // Process - this time return "resolved"
  const result = await worker.runDueRetries((rec) => {
    return { outcome: "resolved" as const };
  }, scheduled.nextRetryAt ?? undefined);

  assert.equal(result.attempted, 1, "Should have attempted 1 record");
  assert.equal(result.resolved, 1, "Should have resolved 1 record");
  assert.equal(result.rescheduled, 0, "Should not have rescheduled");

  // Verify record is marked as resolved in the system
  const updatedRecord = dlq.get(record.deadLetterId);
  assert.equal(updatedRecord?.status, "resolved", "Record status should be resolved");
});

test("[SYS-REL-2.3] DLQ retry worker handles multiple retryable records in order", async () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));
  const worker = new DeadLetterQueueRetryWorker(dlq);

  // Create multiple records with different sourceEventIds
  const record1 = dlq.enqueue({
    sourceEventId: "evt-multi-001",
    consumerId: "consumer-multi",
    errorCode: "error_1",
    payloadJson: '{"taskId":"t-1"}',
  });

  const record2 = dlq.enqueue({
    sourceEventId: "evt-multi-002",
    consumerId: "consumer-multi",
    errorCode: "error_2",
    payloadJson: '{"taskId":"t-2"}',
  });

  const record3 = dlq.enqueue({
    sourceEventId: "evt-multi-003",
    consumerId: "consumer-multi",
    errorCode: "error_3",
    payloadJson: '{"taskId":"t-3"}',
  });

  // Schedule all as retrying
  const scheduled1 = dlq.scheduleRetry(record1.deadLetterId, 5);
  const scheduled2 = dlq.scheduleRetry(record2.deadLetterId, 5);
  const scheduled3 = dlq.scheduleRetry(record3.deadLetterId, 5);
  const batchAsOf = [scheduled1, scheduled2, scheduled3]
    .map((record) => record.nextRetryAt)
    .filter((value): value is string => value != null)
    .sort()
    .at(-1);

  // Process all - resolve the first two, retry the third
  let callCount = 0;
  const result = await worker.runDueRetries((rec) => {
    callCount++;
    if (callCount <= 2) {
      return { outcome: "resolved" as const };
    }
    return { outcome: "retry" as const, delayMs: 100 };
  }, batchAsOf);

  assert.equal(result.attempted, 3, "Should have attempted 3 records");
  assert.equal(result.resolved, 2, "Should have resolved 2 records");
  assert.equal(result.rescheduled, 1, "Should have rescheduled 1 record");
});

test("[SYS-REL-2.3] DLQ retry worker only processes records with status=retrying", async () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));
  const worker = new DeadLetterQueueRetryWorker(dlq);

  // Enqueue a record but keep it in "pending" status (not "retrying")
  const pendingRecord = dlq.enqueue({
    sourceEventId: "evt-pending-001",
    consumerId: "consumer-pending",
    errorCode: "pending_error",
    payloadJson: '{"taskId":"t-pending"}',
  });

  // Enqueue another and schedule it for retry
  const retryRecord = dlq.enqueue({
    sourceEventId: "evt-retry-001",
    consumerId: "consumer-retry",
    errorCode: "retry_error",
    payloadJson: '{"taskId":"t-retry"}',
  });
  const scheduled = dlq.scheduleRetry(retryRecord.deadLetterId, 5);

  // Process - should only process the retrying one, not the pending one
  const result = await worker.runDueRetries((rec) => {
    return { outcome: "resolved" as const };
  }, scheduled.nextRetryAt ?? undefined);

  assert.equal(result.attempted, 1, "Should only attempt 1 record (the retrying one)");
  assert.equal(result.resolved, 1, "Should resolve the retrying record");

  // Verify pending record is still pending
  const stillPending = dlq.get(pendingRecord.deadLetterId);
  assert.equal(stillPending?.status, "pending", "Pending record should remain pending");
});

test("[SYS-REL-2.3] DLQ retry worker gracefully handles callback errors", async () => {
  const db = createInMemoryDb();
  const dlq = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));
  const worker = new DeadLetterQueueRetryWorker(dlq);

  const record = dlq.enqueue({
    sourceEventId: "evt-error-001",
    consumerId: "consumer-error",
    errorCode: "fatal_error",
    payloadJson: '{"taskId":"t-error"}',
  });
  const scheduled = dlq.scheduleRetry(record.deadLetterId, 5);

  // Callback throws an error
  const result = await worker.runDueRetries((rec) => {
    throw new Error("Callback failed unexpectedly");
  }, scheduled.nextRetryAt ?? undefined);

  assert.equal(result.attempted, 1, "Should have attempted 1 record");
  assert.equal(result.failed, 1, "Should have recorded 1 failure");
  assert.equal(result.resolved, 0, "Should not have resolved");
  assert.equal(result.rescheduled, 0, "Should not have rescheduled");
});

test("[SYS-REL-2.3] DLQ persistence verified via file-based SQLite", () => {
  // This test uses a file-based database to ensure persistence works
  // beyond in-memory scenarios that could be compiler-optimized away
  const tempFile = "/tmp/dlq-persistence-test-" + Date.now() + ".db";
  const db = new DatabaseSync(tempFile);
  db.exec(`
    CREATE TABLE dlq_records (
      dead_letter_id TEXT PRIMARY KEY,
      source_event_id TEXT NOT NULL,
      consumer_id TEXT NOT NULL,
      error_code TEXT NOT NULL,
      payload_json TEXT NOT NULL,
      status TEXT NOT NULL,
      retry_count INTEGER NOT NULL,
      next_retry_at TEXT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      original_timestamp TEXT NULL,
      failure_category TEXT NULL,
      retry_exhausted_at TEXT NULL
    )
  `);

  const dlq1 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db));

  dlq1.enqueue({
    sourceEventId: "evt-file-001",
    consumerId: "consumer-file",
    errorCode: "file_error",
    payloadJson: '{"taskId":"t-file"}',
  });

  // Close and reopen database (simulating process restart with file-based storage)
  db.close();

  const db2 = new DatabaseSync(tempFile);
  const dlq2 = new DeadLetterQueueService(new SqliteDeadLetterQueueRepository(db2));

  const records = dlq2.listAll();
  assert.equal(records.length, 1, "Records must persist across file-based database close/reopen");
  assert.equal(records[0]?.sourceEventId, "evt-file-001", "Record data must be intact");

  // Cleanup
  db2.close();
});
