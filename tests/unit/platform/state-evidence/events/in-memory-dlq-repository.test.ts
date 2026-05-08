/**
 * Unit tests for InMemoryDlqRepository
 *
 * Tests the in-memory DLQ repository implementation for correctness.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { type ExtendedDeadLetterRecord, type DlqRepository } from "../../../../../src/platform/state-evidence/events/dlq-service.js";

/**
 * In-memory implementation of DlqRepository for testing
 */
class InMemoryDlqRepository implements DlqRepository {
  private readonly records = new Map<string, ExtendedDeadLetterRecord>();

  insert(record: ExtendedDeadLetterRecord): void {
    if (this.records.has(record.deadLetterId)) {
      throw new Error(`Record with ID ${record.deadLetterId} already exists`);
    }
    this.records.set(record.deadLetterId, record);
  }

  findById(deadLetterId: string): ExtendedDeadLetterRecord | null {
    return this.records.get(deadLetterId) ?? null;
  }

  update(record: ExtendedDeadLetterRecord): void {
    if (!this.records.has(record.deadLetterId)) {
      throw new Error(`Record with ID ${record.deadLetterId} not found`);
    }
    this.records.set(record.deadLetterId, record);
  }

  listAll(): ExtendedDeadLetterRecord[] {
    return Array.from(this.records.values()).sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    );
  }

  listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
    return Array.from(this.records.values())
      .filter((r) => r.consumerId === consumerId)
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }

  listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
    const asOfTime = new Date(asOf).getTime();
    return Array.from(this.records.values())
      .filter((r) => r.status === "retrying" && r.nextRetryAt !== null && new Date(r.nextRetryAt).getTime() <= asOfTime)
      .sort((a, b) => new Date(a.nextRetryAt!).getTime() - new Date(b.nextRetryAt!).getTime());
  }
}

function createRecord(overrides: Partial<ExtendedDeadLetterRecord> = {}): ExtendedDeadLetterRecord {
  const now = new Date().toISOString();
  return {
    deadLetterId: overrides.deadLetterId ?? "dlq_test_1",
    sourceEventId: overrides.sourceEventId ?? "evt_1",
    consumerId: overrides.consumerId ?? "test-consumer",
    errorCode: overrides.errorCode ?? "test.error",
    errorMessage: overrides.errorMessage ?? null,
    payloadJson: overrides.payloadJson ?? '{"test":true}',
    status: overrides.status ?? "pending",
    retryCount: overrides.retryCount ?? 0,
    maxRetries: overrides.maxRetries ?? 5,
    nextRetryAt: overrides.nextRetryAt ?? null,
    createdAt: overrides.createdAt ?? now,
    updatedAt: overrides.updatedAt ?? now,
    originalTimestamp: overrides.originalTimestamp ?? null,
    failureCategory: overrides.failureCategory ?? null,
    reason: overrides.reason ?? null,
    retryExhaustedAt: overrides.retryExhaustedAt ?? null,
    operatorActionLog: overrides.operatorActionLog ?? [],
  };
}

test("InMemoryDlqRepository.insert adds record to storage", () => {
  const repo = new InMemoryDlqRepository();
  const record = createRecord();

  repo.insert(record);

  const found = repo.findById(record.deadLetterId);
  assert.deepEqual(found, record);
});

test("InMemoryDlqRepository.insert does not overwrite existing record", () => {
  const repo = new InMemoryDlqRepository();
  const record1 = createRecord({ deadLetterId: "dlq_unique_1" });
  const record2 = createRecord({ deadLetterId: "dlq_unique_2" });

  repo.insert(record1);
  repo.insert(record2);

  assert.equal(repo.findById("dlq_unique_1")?.deadLetterId, "dlq_unique_1");
  assert.equal(repo.findById("dlq_unique_2")?.deadLetterId, "dlq_unique_2");
});

test("InMemoryDlqRepository.findById returns null for unknown ID", () => {
  const repo = new InMemoryDlqRepository();

  const found = repo.findById("nonexistent_dlq");
  assert.equal(found, null);
});

test("InMemoryDlqRepository.update modifies existing record", () => {
  const repo = new InMemoryDlqRepository();
  const record = createRecord();
  repo.insert(record);

  const updated: ExtendedDeadLetterRecord = {
    ...record,
    status: "resolved",
    updatedAt: new Date().toISOString(),
  };
  repo.update(updated);

  const found = repo.findById(record.deadLetterId);
  assert.equal(found?.status, "resolved");
});

test("InMemoryDlqRepository.update throws for unknown record", () => {
  const repo = new InMemoryDlqRepository();

  assert.throws(() => {
    repo.update(createRecord({ deadLetterId: "unknown_dlq" }));
  });
});

test("InMemoryDlqRepository.listAll returns all records sorted by createdAt", () => {
  const repo = new InMemoryDlqRepository();
  const now = new Date().toISOString();

  repo.insert(createRecord({ deadLetterId: "dlq_first", createdAt: now }));
  repo.insert(createRecord({ deadLetterId: "dlq_second", createdAt: new Date(Date.parse(now) + 1000).toISOString() }));
  repo.insert(createRecord({ deadLetterId: "dlq_third", createdAt: new Date(Date.parse(now) + 2000).toISOString() }));

  const all = repo.listAll();

  assert.equal(all.length, 3);
  assert.equal(all[0]!.deadLetterId, "dlq_first");
  assert.equal(all[1]!.deadLetterId, "dlq_second");
  assert.equal(all[2]!.deadLetterId, "dlq_third");
});

test("InMemoryDlqRepository.listByConsumer filters by consumer ID", () => {
  const repo = new InMemoryDlqRepository();

  repo.insert(createRecord({ deadLetterId: "dlq_c1_1", consumerId: "consumer-a" }));
  repo.insert(createRecord({ deadLetterId: "dlq_c1_2", consumerId: "consumer-a" }));
  repo.insert(createRecord({ deadLetterId: "dlq_c2_1", consumerId: "consumer-b" }));

  const byConsumer = repo.listByConsumer("consumer-a");

  assert.equal(byConsumer.length, 2);
  byConsumer.forEach((r) => assert.equal(r.consumerId, "consumer-a"));
});

test("InMemoryDlqRepository.listByConsumer returns empty array for unknown consumer", () => {
  const repo = new InMemoryDlqRepository();
  repo.insert(createRecord({ consumerId: "some-consumer" }));

  const byUnknown = repo.listByConsumer("unknown-consumer");
  assert.equal(byUnknown.length, 0);
});

test("InMemoryDlqRepository.listRetryable returns records due for retry", () => {
  const repo = new InMemoryDlqRepository();
  const now = new Date().toISOString();
  const past = new Date(Date.parse(now) - 1000).toISOString();
  const future = new Date(Date.parse(now) + 10000).toISOString();

  repo.insert(createRecord({ deadLetterId: "dlq_retry_due", status: "retrying", nextRetryAt: past }));
  repo.insert(createRecord({ deadLetterId: "dlq_retry_not_due", status: "retrying", nextRetryAt: future }));
  repo.insert(createRecord({ deadLetterId: "dlq_no_retry", status: "pending", nextRetryAt: null }));

  const retryable = repo.listRetryable(now);

  assert.equal(retryable.length, 1);
  assert.equal(retryable[0]!.deadLetterId, "dlq_retry_due");
});

test("InMemoryDlqRepository.listRetryable sorts by nextRetryAt ascending", () => {
  const repo = new InMemoryDlqRepository();
  const now = new Date().toISOString();
  const past = new Date(Date.parse(now) - 1000).toISOString();
  const earlier = new Date(Date.parse(now) - 5000).toISOString();

  repo.insert(createRecord({
    deadLetterId: "dlq_later",
    status: "retrying",
    nextRetryAt: new Date(Date.parse(now) + 5000).toISOString(),
  }));
  repo.insert(createRecord({
    deadLetterId: "dlq_earlier",
    status: "retrying",
    nextRetryAt: earlier,
  }));
  repo.insert(createRecord({
    deadLetterId: "dlq_past",
    status: "retrying",
    nextRetryAt: past,
  }));

  // Pass a future "asOf" to include all retryable records
  const futureAsOf = new Date(Date.parse(now) + 10000).toISOString();
  const retryable = repo.listRetryable(futureAsOf);

  assert.equal(retryable.length, 3);
  assert.equal(retryable[0]!.deadLetterId, "dlq_earlier");
  assert.equal(retryable[1]!.deadLetterId, "dlq_past");
  assert.equal(retryable[2]!.deadLetterId, "dlq_later");
});

test("InMemoryDlqRepository: empty repository returns empty arrays", () => {
  const repo = new InMemoryDlqRepository();

  assert.deepEqual(repo.listAll(), []);
  assert.deepEqual(repo.listByConsumer("any"), []);
  assert.deepEqual(repo.listRetryable(new Date().toISOString()), []);
  assert.equal(repo.findById("any"), null);
});
