/**
 * Unit tests for Event Repository - indexing, storage, and retrieval
 *
 * Tests the EventRepository for:
 * - Event indexing and storage (insertEvent, insertEventConsumerAck)
 * - Event retrieval (getEvent, listEventsByType, listEventsForTask, listAllEvents)
 * - Consumer ack management (markEventAck, getEventConsumerAck, listPendingEventsForConsumer)
 * - Tier 1 audit integrity (bootstrapTier1AuditIntegrityRecords)
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createTestDb(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "event-repo-test.db"));
  db.migrate();
  return db;
}

// ---------------------------------------------------------------------------
// Event Storage / Indexing Tests
// ---------------------------------------------------------------------------

test("EventRepository.insertEvent stores event with all fields", () => {
  const workspace = createTempWorkspace("aa-event-repo-insert-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const now = nowIso();
    const event = eventRepo.insertEvent({
      id: "evt_test_001",
      taskId: "task-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: JSON.stringify({ fromStatus: "queued", toStatus: "in_progress" }),
      traceId: "trace-1",
      createdAt: now,
    });

    assert.equal(event.id, "evt_test_001");
    assert.equal(event.taskId, "task-1");
    assert.equal(event.executionId, "exec-1");
    assert.equal(event.eventType, "task:status_changed");
    assert.equal(event.eventTier, "tier_1");
    assert.equal(event.traceId, "trace-1");
    assert.ok(event.payloadJson.includes("in_progress"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.insertEvent auto-detects tier from event type", () => {
  const workspace = createTempWorkspace("aa-event-repo-tier-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    // tier_1 event without explicit tier
    const tier1Event = eventRepo.insertEvent({
      id: "evt_t1",
      taskId: "task-1",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    assert.equal(tier1Event.eventTier, "tier_1");

    // tier_2 event
    const tier2Event = eventRepo.insertEvent({
      id: "evt_t2",
      taskId: "task-1",
      eventType: "dispatch:ticket_created",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    assert.equal(tier2Event.eventTier, "tier_2");

    // tier_3 event
    const tier3Event = eventRepo.insertEvent({
      id: "evt_t3",
      taskId: "task-1",
      eventType: "stream:chunk_emitted",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    assert.equal(tier3Event.eventTier, "tier_3");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.insertEvent creates consumer ack records for tier_1 events", () => {
  const workspace = createTempWorkspace("aa-event-repo-acks-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const event = eventRepo.insertEvent({
      id: "evt_ack_test",
      taskId: "task-1",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Get required consumers for task:status_changed
    const consumerIds = eventRepo.getRequiredConsumerIds(event.id);
    assert.ok(consumerIds.length > 0, "Should have consumer acks");
    assert.ok(consumerIds.includes("task_projection"), "Should have task_projection consumer");
    assert.ok(consumerIds.includes("inspect_projection"), "Should have inspect_projection consumer");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.insertEvent does not create consumer acks for tier_3 events", () => {
  const workspace = createTempWorkspace("aa-event-repo-noacks-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const event = eventRepo.insertEvent({
      id: "evt_tier3_noack",
      taskId: "task-1",
      eventType: "stream:chunk_emitted",
      eventTier: "tier_3",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    const consumerIds = eventRepo.getRequiredConsumerIds(event.id);
    assert.equal(consumerIds.length, 0, "tier_3 events should not have consumer acks");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.insertEvent handles null taskId and executionId", () => {
  const workspace = createTempWorkspace("aa-event-repo-nullable-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    const event = eventRepo.insertEvent({
      id: "evt_nullable",
      taskId: null,
      executionId: null,
      eventType: "system:heartbeat",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    assert.equal(event.taskId, null);
    assert.equal(event.executionId, null);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Event Retrieval Tests
// ---------------------------------------------------------------------------

test("EventRepository.getEvent retrieves event by id", () => {
  const workspace = createTempWorkspace("aa-event-repo-get-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const inserted = eventRepo.insertEvent({
      id: "evt_get_test",
      taskId: "task-1",
      executionId: "exec-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ status: "running" }),
      createdAt: nowIso(),
    });

    const retrieved = eventRepo.getEvent("evt_get_test");
    assert.ok(retrieved, "Should retrieve event");
    assert.equal(retrieved!.id, "evt_get_test");
    assert.equal(retrieved!.eventType, "task:status_changed");
    assert.ok(retrieved!.payloadJson.includes("running"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.getEvent returns undefined for non-existent event", () => {
  const workspace = createTempWorkspace("aa-event-repo-get-missing-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    const result = eventRepo.getEvent("non_existent_event_id");
    assert.equal(result, undefined, "Should return undefined for non-existent event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listEventsByType retrieves events by type", () => {
  const workspace = createTempWorkspace("aa-event-repo-bytype-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    // Insert multiple events of different types
    eventRepo.insertEvent({
      id: "evt_type_1",
      taskId: "task-1",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    eventRepo.insertEvent({
      id: "evt_type_2",
      taskId: "task-1",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    eventRepo.insertEvent({
      id: "evt_type_3",
      taskId: "task-1",
      eventType: "workflow:step_completed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    const taskEvents = eventRepo.listEventsByType("task:status_changed");
    assert.equal(taskEvents.length, 2, "Should have 2 task:status_changed events");
    for (const event of taskEvents) {
      assert.equal(event.eventType, "task:status_changed");
    }

    const workflowEvents = eventRepo.listEventsByType("workflow:step_completed");
    assert.equal(workflowEvents.length, 1, "Should have 1 workflow:step_completed event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listEventsByType with limit parameter", () => {
  const workspace = createTempWorkspace("aa-event-repo-limit-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    // Insert 5 events
    for (let i = 0; i < 5; i++) {
      eventRepo.insertEvent({
        id: `evt_limit_${i}`,
        taskId: "task-1",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: nowIso(),
      });
    }

    const events = eventRepo.listEventsByType("task:status_changed", 3);
    assert.equal(events.length, 3, "Should return at most 3 events");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listEventsForTask retrieves events for a task", () => {
  const workspace = createTempWorkspace("aa-event-repo-fortask-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    // Seed both tasks
    seedTaskAndExecution(db, store, { taskId: "task-fortask", executionId: "exec-fortask", traceId: "trace-ft" });
    seedTaskAndExecution(db, store, { taskId: "task-other", executionId: "exec-other", traceId: "trace-other" });

    eventRepo.insertEvent({
      id: "evt_task_1",
      taskId: "task-fortask",
      eventType: "task:created",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    eventRepo.insertEvent({
      id: "evt_task_2",
      taskId: "task-fortask",
      eventType: "task:started",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    eventRepo.insertEvent({
      id: "evt_task_3",
      taskId: "task-other",
      eventType: "task:created",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    const taskEvents = eventRepo.listEventsForTask("task-fortask");
    assert.equal(taskEvents.length, 2, "Should have 2 events for task-fortask");
    for (const event of taskEvents) {
      assert.equal(event.taskId, "task-fortask");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listEventsForTask with limit returns correct count", () => {
  const workspace = createTempWorkspace("aa-event-repo-fortask-limit-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-limit", executionId: "exec-limit", traceId: "trace-l" });

    // Insert 4 events
    for (let i = 0; i < 4; i++) {
      eventRepo.insertEvent({
        id: `evt_tl_${i}`,
        taskId: "task-limit",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: nowIso(),
      });
    }

    const events = eventRepo.listEventsForTask("task-limit", 2);
    assert.equal(events.length, 2, "Should return at most 2 events");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listAllEvents retrieves all events with pagination", () => {
  const workspace = createTempWorkspace("aa-event-repo-all-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-all", executionId: "exec-all", traceId: "trace-all" });

    // Insert 15 events
    for (let i = 0; i < 15; i++) {
      eventRepo.insertEvent({
        id: `evt_all_${i}`,
        taskId: "task-all",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: nowIso(),
      });
    }

    // Get first page
    const page1 = eventRepo.listAllEvents(10, 0);
    assert.equal(page1.length, 10, "First page should have 10 events");

    // Get second page
    const page2 = eventRepo.listAllEvents(10, 10);
    assert.equal(page2.length, 5, "Second page should have 5 events");

    // Total count
    const all = eventRepo.listAllEvents(100, 0);
    assert.equal(all.length, 15, "Total should be 15 events");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listAllEvents default pagination", () => {
  const workspace = createTempWorkspace("aa-event-repo-all-default-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-def", executionId: "exec-def", traceId: "trace-def" });

    // Insert 5 events
    for (let i = 0; i < 5; i++) {
      eventRepo.insertEvent({
        id: `evt_def_${i}`,
        taskId: "task-def",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: nowIso(),
      });
    }

    // Default: 1000 limit, 0 offset
    const events = eventRepo.listAllEvents();
    assert.equal(events.length, 5, "Should return all 5 events with defaults");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Consumer Ack Tests
// ---------------------------------------------------------------------------

test("EventRepository.markEventAck updates ack status to acked", () => {
  const workspace = createTempWorkspace("aa-event-repo-ack-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-ack", executionId: "exec-ack", traceId: "trace-ack" });

    const event = eventRepo.insertEvent({
      id: "evt_ack_mark",
      taskId: "task-ack",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Mark as acked
    eventRepo.markEventAck({
      eventId: event.id,
      consumerId: "task_projection",
      status: "acked",
      occurredAt: nowIso(),
    });

    const ack = eventRepo.getEventConsumerAck(event.id, "task_projection");
    assert.ok(ack, "Should have ack record");
    assert.equal(ack!.status, "acked");
    assert.ok(ack!.ackedAt, "Should have ackedAt timestamp");
    assert.equal(ack!.attemptCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.markEventAck updates ack status to failed with error code", () => {
  const workspace = createTempWorkspace("aa-event-repo-ack-fail-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-fail", executionId: "exec-fail", traceId: "trace-fail" });

    const event = eventRepo.insertEvent({
      id: "evt_ack_fail",
      taskId: "task-fail",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Mark as failed
    eventRepo.markEventAck({
      eventId: event.id,
      consumerId: "task_projection",
      status: "failed",
      occurredAt: nowIso(),
      errorCode: "delivery_failed: timeout",
    });

    const ack = eventRepo.getEventConsumerAck(event.id, "task_projection");
    assert.ok(ack, "Should have ack record");
    assert.equal(ack!.status, "failed");
    assert.ok(ack!.errorCode!.includes("timeout"), "Should have error code");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.getEventConsumerAck returns undefined for non-existent ack", () => {
  const workspace = createTempWorkspace("aa-event-repo-ack-missing-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    const ack = eventRepo.getEventConsumerAck("non_existent_event", "non_existent_consumer");
    assert.equal(ack, undefined, "Should return undefined for non-existent ack");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listPendingEventsForConsumer returns pending events", () => {
  const workspace = createTempWorkspace("aa-event-repo-pending-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-pending", executionId: "exec-pending", traceId: "trace-pend" });

    const event1 = eventRepo.insertEvent({
      id: "evt_pending_1",
      taskId: "task-pending",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    const event2 = eventRepo.insertEvent({
      id: "evt_pending_2",
      taskId: "task-pending",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Ack the first event
    eventRepo.markEventAck({
      eventId: event1.id,
      consumerId: "task_projection",
      status: "acked",
      occurredAt: nowIso(),
    });

    const pending = eventRepo.listPendingEventsForConsumer("task_projection");
    assert.ok(pending.length >= 1, "Should have pending events");
    assert.ok(pending.some((p) => p.event.id === "evt_pending_2"), "Should include event2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listPendingEventsForConsumer with limit", () => {
  const workspace = createTempWorkspace("aa-event-repo-pending-limit-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-pl", executionId: "exec-pl", traceId: "trace-pl" });

    // Insert 5 events
    for (let i = 0; i < 5; i++) {
      eventRepo.insertEvent({
        id: `evt_pl_${i}`,
        taskId: "task-pl",
        eventType: "task:status_changed",
        payloadJson: "{}",
        createdAt: nowIso(),
      });
    }

    const pending = eventRepo.listPendingEventsForConsumer("task_projection", 3);
    assert.ok(pending.length <= 3, "Should respect limit");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.ackAllConsumersForEvent acks all pending consumers", () => {
  const workspace = createTempWorkspace("aa-event-repo-ackall-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-ackall", executionId: "exec-ackall", traceId: "trace-aa" });

    const event = eventRepo.insertEvent({
      id: "evt_ackall",
      taskId: "task-ackall",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Ack all consumers
    eventRepo.ackAllConsumersForEvent(event.id, nowIso());

    const consumerIds = eventRepo.getRequiredConsumerIds(event.id);
    for (const consumerId of consumerIds) {
      const ack = eventRepo.getEventConsumerAck(event.id, consumerId);
      assert.equal(ack!.status, "acked", `${consumerId} should be acked`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.resetConsumerReplayState resets acked/failed events to pending", () => {
  const workspace = createTempWorkspace("aa-event-repo-reset-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-reset", executionId: "exec-reset", traceId: "trace-reset" });

    const event = eventRepo.insertEvent({
      id: "evt_reset",
      taskId: "task-reset",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Mark as acked
    eventRepo.markEventAck({
      eventId: event.id,
      consumerId: "task_projection",
      status: "acked",
      occurredAt: nowIso(),
    });

    // Reset replay state
    const resetCount = eventRepo.resetConsumerReplayState("task_projection");
    assert.ok(resetCount >= 1, "Should reset at least 1 event");

    const pending = eventRepo.listPendingEventsForConsumer("task_projection");
    assert.ok(pending.some((p) => p.event.id === "evt_reset"), "Event should be pending again");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Dead Letter Tests
// ---------------------------------------------------------------------------

test("EventRepository.insertEventDeadLetter stores dead letter record", () => {
  const workspace = createTempWorkspace("aa-event-repo-dlq-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    const deadLetter = {
      id: "dlq_test_001",
      originalEventId: "evt_original",
      eventType: "task:status_changed",
      payloadJson: '{"error": "original payload"}',
      consumerId: "task_projection",
      failureCount: 3,
      lastError: "delivery_timeout",
      deadLetteredAt: nowIso(),
      reprocessedAt: null,
      reprocessResult: null,
    };

    eventRepo.insertEventDeadLetter(deadLetter);

    const deadLetters = eventRepo.listEventDeadLetters();
    assert.equal(deadLetters.length, 1, "Should have 1 dead letter");
    assert.equal(deadLetters[0]!.originalEventId, "evt_original");
    assert.equal(deadLetters[0]!.failureCount, 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.listEventDeadLetters respects limit", () => {
  const workspace = createTempWorkspace("aa-event-repo-dlq-limit-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    // Insert 10 dead letters
    for (let i = 0; i < 10; i++) {
      eventRepo.insertEventDeadLetter({
        id: `dlq_limit_${i}`,
        originalEventId: `evt_orig_${i}`,
        eventType: "task:status_changed",
        payloadJson: "{}",
        consumerId: "task_projection",
        failureCount: 1,
        lastError: "error",
        deadLetteredAt: nowIso(),
        reprocessedAt: null,
        reprocessResult: null,
      });
    }

    const deadLetters = eventRepo.listEventDeadLetters(5);
    assert.equal(deadLetters.length, 5, "Should return at most 5 dead letters");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Tier 1 Audit Integrity Tests
// ---------------------------------------------------------------------------

test("EventRepository.bootstrapTier1AuditIntegrityRecords creates integrity records for tier_1 events", () => {
  const workspace = createTempWorkspace("aa-event-repo-integrity-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-integrity", executionId: "exec-integrity", traceId: "trace-int" });

    // Insert tier_1 event
    eventRepo.insertEvent({
      id: "evt_integrity",
      taskId: "task-integrity",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Bootstrap integrity records
    eventRepo.bootstrapTier1AuditIntegrityRecords();

    // Get integrity report
    const report = eventRepo.getTier1AuditIntegrityReport();
    assert.equal(report.checked, true, "Report should be checked");
    assert.ok(report.totalTrackedEvents >= 1, "Should track at least 1 event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.getTier1AuditIntegrityReport handles empty events", () => {
  const workspace = createTempWorkspace("aa-event-repo-integrity-empty-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);

    const report = eventRepo.getTier1AuditIntegrityReport();
    assert.equal(report.totalTrackedEvents, 0, "Should have 0 tracked events with no events");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Count and Status Tests
// ---------------------------------------------------------------------------

test("EventRepository.countPendingTier1Acks counts pending tier 1 acks", () => {
  const workspace = createTempWorkspace("aa-event-repo-count-pending-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-cp", executionId: "exec-cp", traceId: "trace-cp" });

    // Insert tier_1 event
    eventRepo.insertEvent({
      id: "evt_cp",
      taskId: "task-cp",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    const pendingCount = eventRepo.countPendingTier1Acks();
    assert.ok(pendingCount >= 1, "Should have at least 1 pending tier 1 ack");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository.countFailedTier1Acks counts failed tier 1 acks", () => {
  const workspace = createTempWorkspace("aa-event-repo-count-failed-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-cf", executionId: "exec-cf", traceId: "trace-cf" });

    const event = eventRepo.insertEvent({
      id: "evt_cf",
      taskId: "task-cf",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Mark as failed
    eventRepo.markEventAck({
      eventId: event.id,
      consumerId: "task_projection",
      status: "failed",
      occurredAt: nowIso(),
      errorCode: "test_failure",
    });

    const failedCount = eventRepo.countFailedTier1Acks();
    assert.ok(failedCount >= 1, "Should have at least 1 failed tier 1 ack");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Decision Trace Tests
// ---------------------------------------------------------------------------

test("EventRepository.listDispatchDecisionTracesByTask retrieves decision traces", () => {
  const workspace = createTempWorkspace("aa-event-repo-decision-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-decision", executionId: "exec-decision", traceId: "trace-dec" });

    // Insert a decision recorded event with proper payload format
    eventRepo.insertEvent({
      id: "evt_decision",
      taskId: "task-decision",
      executionId: "exec-decision",
      eventType: "dispatch:decision_recorded",
      payloadJson: JSON.stringify({
        ticketId: "ticket-1",
        executionId: "exec-decision",
        taskId: "task-decision",
        queueName: "default",
        preferredWorkerId: null,
        requiredCapabilities: [],
        evaluations: [],
      }),
      createdAt: nowIso(),
    });

    const traces = eventRepo.listDispatchDecisionTracesByTask("task-decision");
    assert.equal(traces.length, 1, "Should have 1 decision trace");
    assert.equal(traces[0]!.executionId, "exec-decision");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// List Failed Events Tests
// ---------------------------------------------------------------------------

test("EventRepository.listFailedEventsForConsumer returns only failed events", () => {
  const workspace = createTempWorkspace("aa-event-repo-failed-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-failed", executionId: "exec-failed", traceId: "trace-fl" });

    const event1 = eventRepo.insertEvent({
      id: "evt_failed_1",
      taskId: "task-failed",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });
    const event2 = eventRepo.insertEvent({
      id: "evt_failed_2",
      taskId: "task-failed",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    // Mark first as acked, second as failed
    eventRepo.markEventAck({
      eventId: event1.id,
      consumerId: "task_projection",
      status: "acked",
      occurredAt: nowIso(),
    });
    eventRepo.markEventAck({
      eventId: event2.id,
      consumerId: "task_projection",
      status: "failed",
      occurredAt: nowIso(),
      errorCode: "test_error",
    });

    const failed = eventRepo.listFailedEventsForConsumer("task_projection");
    assert.equal(failed.length, 1, "Should have 1 failed event");
    assert.equal(failed[0]!.event.id, "evt_failed_2");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
