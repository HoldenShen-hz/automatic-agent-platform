/**
 * Integration tests for TransactionalEventAppender
 *
 * Tests atomic event append with outbox write using real SQLite database.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { TransactionalEventAppender } from "../../../../../src/platform/state-evidence/events/transactional-event-appender.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { OUTBOX_TABLE_DDL } from "../../../../../src/platform/shared/outbox/outbox-table.js";

function createDbWithOutbox(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "appender.db"));
  db.migrate();
  db.connection.exec(OUTBOX_TABLE_DDL);
  return db;
}

test("integration: TransactionalEventAppender.appendEvent persists event to database", () => {
  const ctx = createIntegrationContext("aa-appender-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    const outboxRepo = new OutboxRepository(ctx.db.connection);
    const appender = new TransactionalEventAppender(ctx.db, eventRepo, outboxRepo);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-append", executionId: "exec-append", traceId: "trace-append" });

    const result = appender.appendEvent({
      taskId: "task-append",
      executionId: "exec-append",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ fromStatus: "queued", toStatus: "in_progress" }),
    });

    assert.ok(result.event.id, "Event should have an ID");
    assert.equal(result.event.eventType, "task:status_changed");

    // Verify in database
    const stored = eventRepo.getEvent(result.event.id);
    assert.ok(stored, "Event should be stored in database");
    assert.equal(stored!.eventType, "task:status_changed");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TransactionalEventAppender.appendEvent writes outbox entry when enabled", () => {
  const workspace = createTempWorkspace("aa-appender-outbox-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-outbox", executionId: "exec-outbox", traceId: "trace-outbox" });

    const result = appender.appendEvent(
      {
        taskId: "task-outbox",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ status: "completed" }),
      },
      { writeToOutbox: true, traceId: "trace-outbox" },
    );

    assert.ok(result.outboxEntryId, "Outbox entry ID should be set");
    assert.equal(result.outboxEntryId?.startsWith("outbox_"), true);

    // Verify outbox entry exists
    const pending = outboxRepo.listPendingEntries(10);
    const found = pending.find((e) => e.aggregateId === "task-outbox");
    assert.ok(found, "Outbox should have entry for task-outbox");
    assert.equal(found!.traceId, "trace-outbox");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TransactionalEventAppender.appendEvent does not write outbox by default", () => {
  const workspace = createTempWorkspace("aa-appender-no-outbox-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-no-outbox", executionId: "exec-no-outbox", traceId: "trace-no-outbox" });

    const result = appender.appendEvent({
      taskId: "task-no-outbox",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ status: "pending" }),
    });

    assert.equal(result.outboxEntryId, undefined, "No outbox entry when writeToOutbox is false");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TransactionalEventAppender.appendEvents atomically inserts multiple events", () => {
  const workspace = createTempWorkspace("aa-appender-multi-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-multi", executionId: "exec-multi", traceId: "trace-multi" });

    const results = appender.appendEvents([
      { taskId: "task-multi", eventType: "task:created", payloadJson: JSON.stringify({}) },
      { taskId: "task-multi", eventType: "task:started", payloadJson: JSON.stringify({}) },
      { taskId: "task-multi", eventType: "task:completed", payloadJson: JSON.stringify({}) },
    ]);

    assert.equal(results.length, 3, "Should return 3 results");
    assert.ok(results.every((r) => r.event.id), "Each event should have an ID");

    // Verify all events in DB
    const all = eventRepo.listAllEvents();
    assert.ok(all.length >= 3, "At least 3 events should be in database");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TransactionalEventAppender.appendEvents with outbox writes all entries", () => {
  const workspace = createTempWorkspace("aa-appender-multi-outbox-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-multi-out", executionId: "exec-multi-out", traceId: "trace-multi-out" });
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-multi-out-2", executionId: "exec-multi-out-2", traceId: "trace-multi-out-2" });

    const results = appender.appendEvents(
      [
        { taskId: "task-multi-out", eventType: "task:created", payloadJson: JSON.stringify({}) },
        { taskId: "task-multi-out-2", eventType: "task:created", payloadJson: JSON.stringify({}) },
      ],
      { writeToOutbox: true },
    );

    assert.equal(results.length, 2);
    assert.ok(results.every((r) => r.outboxEntryId), "Each should have outbox entry");

    const pending = outboxRepo.listPendingEntries(10);
    assert.ok(pending.length >= 2, "Should have at least 2 outbox entries");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TransactionalEventAppender appends event with custom eventTier", () => {
  const workspace = createTempWorkspace("aa-appender-tier-");
  let db: SqliteDatabase;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);
    seedTaskAndExecution(db, new AuthoritativeTaskStore(db), { taskId: "task-tier", executionId: "exec-tier", traceId: "trace-tier" });

    const result = appender.appendEvent(
      {
        taskId: "task-tier",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ status: "in_progress" }),
      },
      { eventTier: "tier_2" },
    );

    assert.equal(result.event.eventTier, "tier_2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});