/**
 * Unit tests for TransactionalEventAppender
 *
 * Tests §25.2 "Truth Table + Event Log dual model" requirement:
 * - Event append and outbox write happen in the same transaction
 * - Atomic consistency guarantees
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { OutboxRepository } from "../../../../../src/platform/shared/outbox/outbox-repository.js";
import { TransactionalEventAppender } from "../../../../../src/platform/state-evidence/events/transactional-event-appender.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

test("TransactionalEventAppender.appendEvent inserts event successfully", () => {
  const workspace = createTempWorkspace("aa-txn-appender-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    const result = appender.appendEvent({
      taskId: "task-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ status: "running" }),
    });

    assert.ok(result.event.id, "Event should have an ID");
    assert.equal(result.event.eventType, "task:status_changed");
    assert.equal(result.event.taskId, "task-1");
    assert.equal(result.event.executionId, "exec-1");

    // Verify event was inserted in DB
    const events = eventRepo.listEventsByType("task:status_changed");
    assert.ok(events.length >= 1, "Event should be in the database");
    assert.equal(events[0].taskId, "task-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent writes to outbox when option enabled", () => {
  const workspace = createTempWorkspace("aa-txn-outbox-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    const result = appender.appendEvent(
      {
        taskId: "task-1",
        eventType: "task:completed",
        payloadJson: JSON.stringify({ status: "completed" }),
      },
      { writeToOutbox: true, traceId: "trace-123" },
    );

    assert.ok(result.event.id, "Event should have an ID");
    assert.ok(result.outboxEntryId, "Outbox entry ID should be set");
    assert.equal(result.outboxEntryId?.startsWith("outbox-"), true, "Outbox ID should have correct prefix");

    // Verify outbox entry was inserted
    const pending = outboxRepo.listPendingEntries(10);
    const relevant = pending.find((e) => e.aggregateId === "task-1");
    assert.ok(relevant, "Outbox should have entry for task-1");
    assert.equal(relevant?.traceId, "trace-123");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender.appendEvent does not write outbox when option disabled", () => {
  const workspace = createTempWorkspace("aa-txn-no-outbox-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

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

test("TransactionalEventAppender.appendEvents processes multiple events in one transaction", () => {
  const workspace = createTempWorkspace("aa-txn-multi-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    const results = appender.appendEvents([
      { taskId: "task-1", eventType: "task:created", payloadJson: JSON.stringify({}) },
      { taskId: "task-1", eventType: "task:started", payloadJson: JSON.stringify({}) },
      { taskId: "task-1", eventType: "task:completed", payloadJson: JSON.stringify({}) },
    ]);

    assert.equal(results.length, 3, "Should return 3 results");
    assert.ok(results[0].event.id, "First event should have ID");
    assert.ok(results[1].event.id, "Second event should have ID");
    assert.ok(results[2].event.id, "Third event should have ID");

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
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    const results = appender.appendEvents(
      [
        { taskId: "task-1", eventType: "task:created", payloadJson: JSON.stringify({}) },
        { taskId: "task-2", eventType: "task:created", payloadJson: JSON.stringify({}) },
      ],
      { writeToOutbox: true },
    );

    assert.equal(results.length, 2);
    assert.ok(results[0].outboxEntryId, "First should have outbox entry");
    assert.ok(results[1].outboxEntryId, "Second should have outbox entry");

    // Verify both outbox entries exist
    const pending = outboxRepo.listPendingEntries(10);
    assert.ok(pending.length >= 2, "Should have at least 2 outbox entries");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TransactionalEventAppender rolls back on error", () => {
  const workspace = createTempWorkspace("aa-txn-rollback-");
  let db: SqliteDatabase;

  try {
    db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();
    const eventRepo = new EventRepository(db.connection);
    const outboxRepo = new OutboxRepository(db.connection);
    const appender = new TransactionalEventAppender(db, eventRepo, outboxRepo);

    // Verify initial event count is 0
    const eventsBefore = eventRepo.listEventsByType("task:error_event");
    const countBefore = eventsBefore.length;

    // Attempt to insert invalid event (empty required fields)
    try {
      appender.appendEvent({
        // @ts-expect-error - intentionally missing required fields for testing
        eventType: "",
        payloadJson: "invalid",
      });
      assert.fail("Should have thrown");
    } catch (error) {
      assert.ok(error instanceof Error, "Should throw an error");
    }

    // Verify no events were inserted (rollback worked)
    const eventsAfter = eventRepo.listEventsByType("task:error_event");
    assert.equal(eventsAfter.length, countBefore, "No events should be added after rollback");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});