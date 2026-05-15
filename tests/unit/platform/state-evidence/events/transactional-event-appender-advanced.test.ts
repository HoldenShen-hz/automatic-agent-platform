/**
 * Unit tests for TransactionalEventAppender - Advanced scenarios
 *
 * Tests batch event appending, mutateTruth option, and edge cases.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { TransactionalEventAppender } from "../../../../../src/platform/five-plane-state-evidence/events/transactional-event-appender.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { OUTBOX_TABLE_DDL } from "../../../../../src/platform/shared/outbox/outbox-table.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createDbWithOutbox(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "test.db"));
  db.migrate();
  db.connection.exec(OUTBOX_TABLE_DDL);
  return db;
}

test("TransactionalEventAppender.appendEvents batch inserts multiple events", () => {
  const workspace = createTempWorkspace("aa-batch-appender-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-batch", executionId: "exec-batch", traceId: "trace-batch" });

    const results = appender.appendEvents([
      {
        taskId: "task-batch",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      },
      {
        taskId: "task-batch",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ toStatus: "running" }),
      },
      {
        taskId: "task-batch",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ toStatus: "completed" }),
      },
    ]);

    assert.equal(results.length, 3, "Should return 3 results");
    assert.ok(results[0]!.event.id.startsWith("evt_"), "First event should have ID");
    assert.ok(results[1]!.event.id.startsWith("evt_"), "Second event should have ID");
    assert.ok(results[2]!.event.id.startsWith("evt_"), "Third event should have ID");

    // Verify all events are in DB
    const events = eventRepo.listEventsByType("task:status_changed");
    assert.ok(events.length >= 3, "All 3 events should be in database");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvents with writeToOutbox option", () => {
  const workspace = createTempWorkspace("aa-batch-outbox-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-batch-outbox", executionId: "exec-batch-outbox" });

    const results = appender.appendEvents([
      {
        taskId: "task-batch-outbox",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      },
      {
        taskId: "task-batch-outbox",
        eventType: "task:completed",
        payloadJson: JSON.stringify({ toStatus: "completed" }),
      },
    ], { writeToOutbox: true });

    assert.equal(results.length, 2);
    assert.ok(results[0]!.outboxEntryId, "First event should have outbox entry");
    assert.ok(results[1]!.outboxEntryId, "Second event should have outbox entry");
    assert.notEqual(results[0]!.outboxEntryId, results[1]!.outboxEntryId, "Outbox IDs should be unique");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvents with eventTier option", () => {
  const workspace = createTempWorkspace("aa-tier-option-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-tier", executionId: "exec-tier" });

    const result = appender.appendEvent(
      {
        taskId: "task-tier",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      },
      { eventTier: "tier_1" }
    );

    assert.equal(result.event.eventTier, "tier_1", "Event should have specified tier");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent with custom event ID", () => {
  const workspace = createTempWorkspace("aa-custom-id-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-custom-id", executionId: "exec-custom-id" });

    const customId = "evt_custom_12345";
    const result = appender.appendEvent({
      id: customId,
      taskId: "task-custom-id",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
    });

    assert.equal(result.event.id, customId, "Event should have custom ID");

    const found = eventRepo.findById(customId);
    assert.ok(found, "Event with custom ID should be findable in repository");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent generates ID when not provided", () => {
  const workspace = createTempWorkspace("aa-auto-id-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-auto-id", executionId: "exec-auto-id" });

    const result = appender.appendEvent({
      taskId: "task-auto-id",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
    });

    assert.ok(result.event.id.startsWith("evt_"), "Auto-generated ID should have evt_ prefix");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent with traceId option", () => {
  const workspace = createTempWorkspace("aa-trace-id-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-trace", executionId: "exec-trace" });

    const traceId = "trace-custom-abc123";
    const result = appender.appendEvent({
      taskId: "task-trace",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      executionId: "exec-trace",
    }, { traceId });

    assert.equal(result.event.traceId, traceId, "Event should have traceId");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender default eventTier is tier_2", () => {
  const workspace = createTempWorkspace("aa-default-tier-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-default-tier", executionId: "exec-default-tier" });

    const result = appender.appendEvent({
      taskId: "task-default-tier",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
    });

    assert.equal(result.event.eventTier, "tier_2", "Default eventTier should be tier_2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender appendEvent sets sessionId to null", () => {
  const workspace = createTempWorkspace("aa-session-id-");
  let db: SqliteDatabase | undefined;

  try {
    db = createDbWithOutbox(workspace);
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    seedTaskAndExecution(db, store, { taskId: "task-session", executionId: "exec-session" });

    const result = appender.appendEvent({
      taskId: "task-session",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ toStatus: "in_progress" }),
      executionId: "exec-session",
    });

    assert.equal(result.event.sessionId, null, "sessionId should be null");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
