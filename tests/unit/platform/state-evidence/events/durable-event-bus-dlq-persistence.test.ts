import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { type DlqRepository, type ExtendedDeadLetterRecord } from "../../../../../src/platform/five-plane-state-evidence/events/dlq-service.js";

/**
 * R12-03: Tests for persistent DLQ with full metadata.
 * Verifies that DLQ entries contain category/reason/retry_count/operator_action_log
 * and support inspect/redrive/discard with approval.
 */
test("R12-03: DLQ entries are persisted with all required metadata", async () => {
  const workspace = createTempWorkspace("aa-dlq-persist-");

  try {
    const db = new SqliteDatabase(join(workspace, "dlq-events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-dlq", executionId: "exec-dlq", traceId: "trace-dlq" });

    // Create in-memory DLQ repository for verification
    const dlqRecords: ExtendedDeadLetterRecord[] = [];
    const mockDlqRepository: DlqRepository = {
      insert(record: ExtendedDeadLetterRecord): void {
        dlqRecords.push(record);
      },
      findById(id: string): ExtendedDeadLetterRecord | null {
        return dlqRecords.find(r => r.deadLetterId === id) ?? null;
      },
      update(record: ExtendedDeadLetterRecord): void {
        const idx = dlqRecords.findIndex(r => r.deadLetterId === record.deadLetterId);
        if (idx !== -1) dlqRecords[idx] = record;
      },
      listAll(): ExtendedDeadLetterRecord[] {
        return dlqRecords.slice();
      },
      listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
        return dlqRecords.filter(r => r.consumerId === consumerId);
      },
      listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
        return dlqRecords.filter(r => r.status === "retrying" && r.nextRetryAt !== null && r.nextRetryAt <= asOf);
      },
    };

    bus.setDlqRepository(mockDlqRepository);

    // Subscribe with a handler that always fails to trigger DLQ
    bus.subscribe("inspect_projection", async () => {
      throw new Error("force DLQ");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dlq",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    try {
      await bus.deliverPending("inspect_projection");
    } catch {
      // Expected after retries are exhausted and the event is dead-lettered.
    }

    // Verify DLQ entry was persisted with full metadata
    assert.ok(dlqRecords.length > 0, "DLQ record should be persisted");

    const dlqEntry = dlqRecords[0];
    assert.ok(dlqEntry.deadLetterId.startsWith("dlq_"), "should have valid DLQ ID");
    assert.ok(dlqEntry.sourceEventId.startsWith("evt_"), "should have source event ID");
    assert.equal(dlqEntry.eventType, "task:status_changed");
    assert.equal(dlqEntry.consumerId, "inspect_projection");
    assert.equal(dlqEntry.status, "pending");
    assert.ok(dlqEntry.retryCount >= 1, "retryCount should be >= 1");
    assert.ok(dlqEntry.maxRetries >= dlqEntry.retryCount, "maxRetries should be >= retryCount");
    assert.ok(dlqEntry.reason !== null && dlqEntry.reason.length > 0, "reason should be non-empty");
    assert.ok(dlqEntry.operatorActionLog !== undefined, "operatorActionLog should exist");
    assert.ok(dlqEntry.createdAt !== null, "createdAt should be set");
    assert.ok(dlqEntry.updatedAt !== null, "updatedAt should be set");
    assert.ok(dlqEntry.originalTimestamp !== null, "originalTimestamp should be set");
    assert.ok(dlqEntry.firstFailedAt !== null, "firstFailedAt should be set");
    assert.ok(dlqEntry.lastFailedAt !== null, "lastFailedAt should be set");
    assert.ok(dlqEntry.retryExhaustedAt !== null, "retryExhaustedAt should be set after retries exhausted");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R12-03: DLQ repository insert is called on dead-lettering", async () => {
  const workspace = createTempWorkspace("aa-dlq-insert-");

  try {
    const db = new SqliteDatabase(join(workspace, "dlq-insert.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-dlq-insert", executionId: "exec-dlq-insert", traceId: "trace-dlq-insert" });

    let insertCallCount = 0;
    const mockDlqRepository: DlqRepository = {
      insert(record: ExtendedDeadLetterRecord): void {
        insertCallCount++;
      },
      findById(): null { return null; },
      update(): void {},
      listAll(): [] { return []; },
      listByConsumer(): [] { return []; },
      listRetryable(): [] { return []; },
    };

    bus.setDlqRepository(mockDlqRepository);

    bus.subscribe("inspect_projection", async () => {
      throw new Error("force DLQ insert");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dlq-insert",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Trigger delivery which will fail and call DLQ insert
    try {
      await bus.deliverPending("inspect_projection");
    } catch {
      // Expected to throw after dead-lettering
    }

    assert.equal(insertCallCount, 1, "DLQ repository insert should be called exactly once per dead-letter");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R31-27: volatile delivery failures are persisted to DLQ repository", async () => {
  const workspace = createTempWorkspace("aa-dlq-volatile-");

  try {
    const db = new SqliteDatabase(join(workspace, "dlq-volatile.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const dlqRecords: ExtendedDeadLetterRecord[] = [];
    const mockDlqRepository: DlqRepository = {
      insert(record: ExtendedDeadLetterRecord): void {
        dlqRecords.push(record);
      },
      findById(id: string): ExtendedDeadLetterRecord | null {
        return dlqRecords.find((record) => record.deadLetterId === id) ?? null;
      },
      update(record: ExtendedDeadLetterRecord): void {
        const index = dlqRecords.findIndex((item) => item.deadLetterId === record.deadLetterId);
        if (index >= 0) {
          dlqRecords[index] = record;
        }
      },
      listAll(): ExtendedDeadLetterRecord[] {
        return dlqRecords.slice();
      },
      listByConsumer(consumerId: string): ExtendedDeadLetterRecord[] {
        return dlqRecords.filter((record) => record.consumerId === consumerId);
      },
      listRetryable(asOf: string): ExtendedDeadLetterRecord[] {
        return dlqRecords.filter((record) => record.status === "retrying" && record.nextRetryAt !== null && record.nextRetryAt <= asOf);
      },
    };

    bus.setDlqRepository(mockDlqRepository);
    bus.subscribe("volatile_projection", async () => {
      throw new Error("volatile boom");
    });

    bus.publish({
      eventType: "perf:test_event",
      payload: { benchmark: "fanout" },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(dlqRecords.length, 1);
    assert.equal(dlqRecords[0]?.consumerId, "volatile_projection");
    assert.equal(dlqRecords[0]?.eventType, "perf:test_event");
    assert.ok(dlqRecords[0]?.errorCode.includes("volatile_delivery_failed"));

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
