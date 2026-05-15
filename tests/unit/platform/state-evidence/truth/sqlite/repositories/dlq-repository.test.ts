import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";

import { SqliteDeadLetterQueueRepository } from "../../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/dlq-repository.js";

function createConnection(): DatabaseSync {
  const connection = new DatabaseSync(":memory:");
  connection.exec(`
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
  return connection;
}

test("SqliteDeadLetterQueueRepository persists and reloads records", () => {
  const connection = createConnection();
  const repo = new SqliteDeadLetterQueueRepository(connection);
  const now = "2026-04-21T10:00:00.000Z";

  repo.insert({
    deadLetterId: "dlq_1",
    sourceEventId: "evt_1",
    consumerId: "consumer_a",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":1}",
    status: "pending",
    retryCount: 0,
    nextRetryAt: null,
    createdAt: now,
    updatedAt: now,
    originalTimestamp: now,
    failureCategory: "transient",
    retryExhaustedAt: null,
  });

  const reloaded = repo.findById("dlq_1");
  assert.ok(reloaded);
  assert.equal(reloaded.consumerId, "consumer_a");
  assert.equal(reloaded.failureCategory, "transient");

  connection.close();
});

test("SqliteDeadLetterQueueRepository listRetryable returns only due retrying entries", () => {
  const connection = createConnection();
  const repo = new SqliteDeadLetterQueueRepository(connection);
  const now = "2026-04-21T10:00:00.000Z";

  repo.insert({
    deadLetterId: "dlq_due",
    sourceEventId: "evt_due",
    consumerId: "consumer_due",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":2}",
    status: "retrying",
    retryCount: 1,
    nextRetryAt: "2026-04-21T09:59:00.000Z",
    createdAt: now,
    updatedAt: now,
    originalTimestamp: null,
    failureCategory: null,
    retryExhaustedAt: null,
  });
  repo.insert({
    deadLetterId: "dlq_future",
    sourceEventId: "evt_future",
    consumerId: "consumer_future",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":3}",
    status: "retrying",
    retryCount: 2,
    nextRetryAt: "2026-04-21T10:05:00.000Z",
    createdAt: now,
    updatedAt: now,
    originalTimestamp: null,
    failureCategory: null,
    retryExhaustedAt: null,
  });
  repo.insert({
    deadLetterId: "dlq_resolved",
    sourceEventId: "evt_resolved",
    consumerId: "consumer_done",
    errorCode: "delivery.timeout",
    payloadJson: "{\"step\":4}",
    status: "resolved",
    retryCount: 1,
    nextRetryAt: "2026-04-21T09:58:00.000Z",
    createdAt: now,
    updatedAt: now,
    originalTimestamp: null,
    failureCategory: null,
    retryExhaustedAt: null,
  });

  const retryable = repo.listRetryable(now);
  assert.deepEqual(retryable.map((record) => record.deadLetterId), ["dlq_due"]);

  connection.close();
});
