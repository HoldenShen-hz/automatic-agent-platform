import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";

import { DeadLetterQueueService } from "../../../../src/platform/state-evidence/dlq/index.js";
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