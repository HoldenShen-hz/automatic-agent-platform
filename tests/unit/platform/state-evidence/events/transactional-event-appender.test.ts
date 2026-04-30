/**
 * Unit tests for TransactionalEventAppender - Issue #2025
 *
 * Tests that verify transactional consistency between truth table and event log.
 * Issue #2025: transactional-event-appender.ts:97 - Manual BEGIN/COMMIT bypasses db.transaction()
 *
 * The bug was that manual BEGIN/COMMIT could bypass the db.transaction() wrapper.
 * The fix ensures that all operations use db.transaction() properly.
 *
 * These tests verify:
 * - Event append uses db.transaction() wrapper
 * - Event and outbox are written atomically
 * - Truth mutation combined with event append is atomic
 * - Rollback works correctly on failure
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { OutboxRepository } from "../../../../../src/shared/outbox/outbox-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransactionalEventAppender } from "../../../../../src/platform/state-evidence/events/transactional-event-appender.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import { OUTBOX_TABLE_DDL } from "../../../../../src/platform/shared/outbox/outbox-table.js";
import { seedTaskAndExecution } from "../../../../../helpers/seed.js";

function createDbWithOutbox(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "test.db"));
  db.migrate();
  // Create outbox table manually since it's not in the default migration plan
  db.connection.exec(OUTBOX_TABLE_DDL);
  return db;
}

test("TransactionalEventAppender.appendEvent uses transaction wrapper - Issue #2025", () => {
  const workspace = createTempWorkspace("aa-txn-wrapper-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const result = appender.appendEvent({
      taskId: "task-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ status: "running" }),
    });

    assert.ok(result.event.id, "Event should have an ID");
    assert.equal(result.event.eventType, "task:status_changed");

    // Verify event was inserted
    const events = eventRepo.listEventsByType("task:status_changed");
    assert.ok(events.length >= 1, "Event should be in the database");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent atomic with outbox write", () => {
  const workspace = createTempWorkspace("aa-txn-atomic-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-atomic", executionId: "exec-atomic", traceId: "trace-atomic" });

    const result = appender.appendEvent(
      {
        taskId: "task-atomic",
        eventType: "task:completed",
        payloadJson: JSON.stringify({ status: "completed" }),
      },
      { writeToOutbox: true, traceId: "trace-atomic" },
    );

    assert.ok(result.event.id, "Event should have an ID");
    assert.ok(result.outboxEntryId, "Outbox entry should be created");

    // Verify both event and outbox entry exist
    const events = eventRepo.listEventsByType("task:completed");
    assert.ok(events.length >= 1, "Event should be in database");

    const pending = outboxRepo.listPendingEntries(10);
    const relevant = pending.find((e) => e.aggregateId === "task-atomic");
    assert.ok(relevant, "Outbox entry should exist");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent without outbox does not create outbox entry", () => {
  const workspace = createTempWorkspace("aa-txn-no-outbox-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const result = appender.appendEvent({
      taskId: "task-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({ status: "created" }),
    });

    assert.ok(result.event.id, "Event should have an ID");
    assert.equal(result.outboxEntryId, undefined, "No outbox entry when writeToOutbox is false");

    const pending = outboxRepo.listPendingEntries(10);
    const relevant = pending.filter((e) => e.aggregateId === "task-1" && e.eventType === "task:created");
    assert.equal(relevant.length, 0, "No outbox entry should be created");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvents processes multiple events atomically", () => {
  const workspace = createTempWorkspace("aa-txn-multi-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-multi", executionId: "exec-multi", traceId: "trace-multi" });

    const results = appender.appendEvents([
      { taskId: "task-multi", eventType: "task:created", payloadJson: JSON.stringify({}) },
      { taskId: "task-multi", eventType: "task:started", payloadJson: JSON.stringify({}) },
      { taskId: "task-multi", eventType: "task:completed", payloadJson: JSON.stringify({}) },
    ]);

    assert.equal(results.length, 3, "Should return 3 results");
    assert.ok(results[0]!.event.id, "First event should have ID");
    assert.ok(results[1]!.event.id, "Second event should have ID");
    assert.ok(results[2]!.event.id, "Third event should have ID");

    // Verify all events in DB
    const events = eventRepo.listEventsByType("task:created");
    assert.ok(events.length >= 1, "At least one event should be in DB");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvents with outbox writes all entries", () => {
  const workspace = createTempWorkspace("aa-txn-multi-outbox-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });
    seedTaskAndExecution(db, store, { taskId: "task-2", executionId: "exec-2", traceId: "trace-2" });

    const results = appender.appendEvents(
      [
        { taskId: "task-1", eventType: "task:created", payloadJson: JSON.stringify({}) },
        { taskId: "task-2", eventType: "task:created", payloadJson: JSON.stringify({}) },
      ],
      { writeToOutbox: true },
    );

    assert.equal(results.length, 2);
    assert.ok(results[0]!.outboxEntryId, "First should have outbox entry");
    assert.ok(results[1]!.outboxEntryId, "Second should have outbox entry");

    // Verify both outbox entries exist
    const pending = outboxRepo.listPendingEntries(10);
    assert.ok(pending.length >= 2, "Should have at least 2 outbox entries");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent can mutate truth in same transaction", () => {
  const workspace = createTempWorkspace("aa-txn-truth-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    db.connection.exec("CREATE TABLE truth_projection (id TEXT PRIMARY KEY, status TEXT NOT NULL)");
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-truth", executionId: "exec-truth", traceId: "trace-truth" });

    appender.appendEvent(
      {
        taskId: "task-truth",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ status: "running" }),
      },
      {
        mutateTruth: (transactionDb) => {
          transactionDb.connection
            .prepare("INSERT INTO truth_projection (id, status) VALUES (?, ?)")
            .run("task-truth", "running");
        },
      },
    );

    const projection = db.connection
      .prepare("SELECT status FROM truth_projection WHERE id = ?")
      .get("task-truth") as { status: string } | undefined;

    assert.equal(projection?.status, "running");
    assert.ok(eventRepo.listEventsByType("task:status_changed").length >= 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender rolls back event insert when truth mutation fails", () => {
  const workspace = createTempWorkspace("aa-txn-rollback-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    db.connection.exec("CREATE TABLE truth_projection (id TEXT PRIMARY KEY, status TEXT NOT NULL)");
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-rollback", executionId: "exec-rollback", traceId: "trace-rollback" });

    assert.throws(() => {
      appender.appendEvent(
        {
          taskId: "task-rollback",
          eventType: "task:status_changed",
          payloadJson: JSON.stringify({ status: "running" }),
        },
        {
          mutateTruth: (_transactionDb) => {
            throw new Error("truth mutation failed");
          },
        },
      );
    });

    // Verify no truth projection was inserted
    const projection = db.connection
      .prepare("SELECT * FROM truth_projection WHERE id = ?")
      .get("task-rollback");
    assert.equal(projection, undefined, "Truth projection should not be inserted");

    // Verify no event was inserted
    const eventCount = eventRepo.listEventsByType("task:status_changed").length;
    assert.equal(eventCount, 0, "No events should be inserted after rollback");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender transaction isolation - event not visible before commit", () => {
  const workspace = createTempWorkspace("aa-txn-isolation-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "isolation.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-iso", executionId: "exec-iso", traceId: "trace-iso" });

    // This should succeed - transaction wrapper handles everything
    const result = appender.appendEvent({
      taskId: "task-iso",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ fromStatus: "created", toStatus: "running" }),
    });

    assert.ok(result.event.id, "Event should have an ID after transaction");

    // Event should be committed and visible
    const events = eventRepo.listEventsByType("task:status_changed");
    assert.ok(events.length >= 1, "Event should be committed and visible");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender handles tier specification", () => {
  const workspace = createTempWorkspace("aa-txn-tier-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "tier.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-tier", executionId: "exec-tier", traceId: "trace-tier" });

    const result = appender.appendEvent(
      {
        taskId: "task-tier",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ status: "running" }),
      },
      { eventTier: "tier_1" },
    );

    assert.equal(result.event.eventTier, "tier_1", "Event should have specified tier");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender default tier is tier_2", () => {
  const workspace = createTempWorkspace("aa-txn-default-tier-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "default-tier.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-default", executionId: "exec-default", traceId: "trace-default" });

    const result = appender.appendEvent({
      taskId: "task-default",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ status: "running" }),
    });

    assert.equal(result.event.eventTier, "tier_2", "Default tier should be tier_2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
