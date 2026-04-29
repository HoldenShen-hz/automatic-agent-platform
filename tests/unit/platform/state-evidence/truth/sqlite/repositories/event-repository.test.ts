import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EventRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/event-repository.js";
import { TaskRepository } from "../../../../../../../src/platform/state-evidence/truth/sqlite/repositories/task-repository.js";
import { SqliteDatabase } from "../../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../../helpers/fs.js";
import type { EventRecord, EventConsumerAckRecord } from "../../../../../../../src/platform/contracts/types/domain.js";

function createTestTask(
  taskRepo: TaskRepository,
  taskId: string,
  now: string,
  tenantId: string | null = null,
): void {
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId,
    title: `Task ${taskId}`,
    status: "in_progress",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: null,
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
  });
}

test("EventRepository insertEvent and getEvent round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-event-task-1", now);

    const event: EventRecord = {
      id: "sqlite-evt-001",
      taskId: "sqlite-event-task-1",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"newStatus":"in_progress"}',
      traceId: "trace-evt-001",
      createdAt: now,
    };

    repo.insertEvent(event);
    const result = repo.getEvent("sqlite-evt-001");

    assert.ok(result, "getEvent should return inserted event");
    assert.equal(result.id, "sqlite-evt-001");
    assert.equal(result.taskId, "sqlite-event-task-1");
    assert.equal(result.eventType, "task:status_changed");
    assert.equal(result.eventTier, "tier_2");
    assert.equal(result.payloadJson, '{"newStatus":"in_progress"}');
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository getEvent returns undefined for non-existent event", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const result = repo.getEvent("nonexistent-event-id");
    assert.strictEqual(result, undefined);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listEventsForTask returns events for a task", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-list-task-evts", now);

    for (let i = 1; i <= 3; i++) {
      repo.insertEvent({
        id: `sqlite-list-evt-${i}`,
        taskId: "sqlite-list-task-evts",
        sessionId: null,
        executionId: null,
        eventType: "task:status_changed",
        eventTier: "tier_2",
        payloadJson: `{"index":${i}}`,
        traceId: `trace-list-${i}`,
        createdAt: now,
      });
    }

    const results = repo.listEventsForTask("sqlite-list-task-evts");
    assert.equal(results.length, 3, "should return all 3 events");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listEventsForTask with limit returns specified number", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-limit-task-evts", now);

    for (let i = 1; i <= 5; i++) {
      repo.insertEvent({
        id: `sqlite-limit-evt-${i}`,
        taskId: "sqlite-limit-task-evts",
        sessionId: null,
        executionId: null,
        eventType: "task:status_changed",
        eventTier: "tier_2",
        payloadJson: `{"index":${i}}`,
        traceId: `trace-limit-${i}`,
        createdAt: now,
      });
    }

    const results = repo.listEventsForTask("sqlite-limit-task-evts", 3);
    assert.equal(results.length, 3, "should return only 3 events");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listEventsForTaskSnapshot returns stable stream version and cursor", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-snapshot-task", now);

    repo.insertEvent({
      id: "sqlite-snapshot-evt-001",
      taskId: "sqlite-snapshot-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"index":1}',
      traceId: "trace-snapshot-1",
      createdAt: now,
    });
    repo.insertEvent({
      id: "sqlite-snapshot-evt-002",
      taskId: "sqlite-snapshot-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"index":2}',
      traceId: "trace-snapshot-2",
      createdAt: now,
    });

    const snapshot = repo.listEventsForTaskSnapshot("sqlite-snapshot-task");
    assert.equal(snapshot.streamVersion, 2);
    assert.equal(snapshot.lastEventId, "sqlite-snapshot-evt-002");
    assert.equal(snapshot.lastCreatedAt, now);
    assert.ok(snapshot.snapshotCursor);
    assert.deepEqual(
      snapshot.events.map((event) => event.id),
      ["sqlite-snapshot-evt-001", "sqlite-snapshot-evt-002"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listEventsForTaskSinceCursor returns only events after the snapshot cursor", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    createTestTask(taskRepo, "sqlite-cursor-task", "2026-04-27T10:00:00.000Z");

    repo.insertEvent({
      id: "sqlite-cursor-evt-001",
      taskId: "sqlite-cursor-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"index":1}',
      traceId: "trace-cursor-1",
      createdAt: "2026-04-27T10:00:00.000Z",
    });
    repo.insertEvent({
      id: "sqlite-cursor-evt-002",
      taskId: "sqlite-cursor-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"index":2}',
      traceId: "trace-cursor-2",
      createdAt: "2026-04-27T10:00:00.000Z",
    });

    const snapshot = repo.listEventsForTaskSnapshot("sqlite-cursor-task");

    repo.insertEvent({
      id: "sqlite-cursor-evt-003",
      taskId: "sqlite-cursor-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: '{"index":3}',
      traceId: "trace-cursor-3",
      createdAt: "2026-04-27T10:00:01.000Z",
    });

    const delta = repo.listEventsForTaskSinceCursor("sqlite-cursor-task", snapshot.snapshotCursor!);
    assert.deepEqual(
      delta.map((event) => event.id),
      ["sqlite-cursor-evt-003"],
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listEventsByType returns matching events", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-type-task", now);

    repo.insertEvent({
      id: "sqlite-type-evt-1",
      taskId: "sqlite-type-task",
      sessionId: null,
      executionId: null,
      eventType: "task:created",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-type-1",
      createdAt: now,
    });
    repo.insertEvent({
      id: "sqlite-type-evt-2",
      taskId: "sqlite-type-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-type-2",
      createdAt: now,
    });
    repo.insertEvent({
      id: "sqlite-type-evt-3",
      taskId: "sqlite-type-task",
      sessionId: null,
      executionId: null,
      eventType: "task:created",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-type-3",
      createdAt: now,
    });

    const createdEvents = repo.listEventsByType("task:created");
    assert.equal(createdEvents.length, 2, "should return 2 task:created events");

    const statusEvents = repo.listEventsByType("task:status_changed");
    assert.equal(statusEvents.length, 1, "should return 1 task:status_changed event");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository insertEventConsumerAck and getEventConsumerAck round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-ack-task", now);

    repo.insertEvent({
      id: "sqlite-ack-evt-001",
      taskId: "sqlite-ack-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-ack-001",
      createdAt: now,
    });

    const ack: EventConsumerAckRecord = {
      id: "sqlite-ack-001",
      eventId: "sqlite-ack-evt-001",
      consumerId: "test-consumer-sqlite",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    };

    repo.insertEventConsumerAck(ack);

    const result = repo.getEventConsumerAck("sqlite-ack-evt-001", "test-consumer-sqlite");
    assert.ok(result);
    assert.equal(result.id, "sqlite-ack-001");
    assert.equal(result.eventId, "sqlite-ack-evt-001");
    assert.equal(result.consumerId, "test-consumer-sqlite");
    assert.equal(result.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository markEventAck updates ack status to acked", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-mark-ack-task", now);

    repo.insertEvent({
      id: "sqlite-mark-ack-evt",
      taskId: "sqlite-mark-ack-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-mark-ack",
      createdAt: now,
    });

    repo.insertEventConsumerAck({
      id: "sqlite-mark-ack-record",
      eventId: "sqlite-mark-ack-evt",
      consumerId: "consumer-mark-sqlite",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    repo.markEventAck("sqlite-mark-ack-evt", "consumer-mark-sqlite");

    const afterAck = repo.getEventConsumerAck("sqlite-mark-ack-evt", "consumer-mark-sqlite");
    assert.equal(afterAck?.status, "acked");
    assert.ok(afterAck?.ackedAt, "ackedAt should be set");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository markEventAck with object form updates with provided values", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-obj-ack-task", now);

    repo.insertEvent({
      id: "sqlite-obj-ack-evt",
      taskId: "sqlite-obj-ack-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-obj-ack",
      createdAt: now,
    });

    repo.insertEventConsumerAck({
      id: "sqlite-obj-ack-record",
      eventId: "sqlite-obj-ack-evt",
      consumerId: "consumer-obj-sqlite",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    repo.markEventAck({
      eventId: "sqlite-obj-ack-evt",
      consumerId: "consumer-obj-sqlite",
      status: "failed",
      occurredAt: now,
      errorCode: "processing.error",
    });

    const result = repo.getEventConsumerAck("sqlite-obj-ack-evt", "consumer-obj-sqlite");
    assert.equal(result?.status, "failed");
    assert.equal(result?.errorCode, "processing.error");
    assert.ok(result?.lastAttemptAt);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository insertEventDeadLetter and listEventDeadLetters round-trip", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    repo.insertEventDeadLetter({
      id: "sqlite-dlq-001",
      originalEventId: "evt-dlq-001",
      eventType: "task:status_changed",
      payloadJson: '{"reason":"dlq_test"}',
      consumerId: "dlq-consumer",
      failureCount: 3,
      lastError: "delivery.failed",
      deadLetteredAt: now,
      reprocessedAt: null,
      reprocessResult: null,
    });

    const deadLetters = repo.listEventDeadLetters();
    assert.equal(deadLetters.length, 1);
    assert.equal(deadLetters[0]?.id, "sqlite-dlq-001");
    assert.equal(deadLetters[0]?.originalEventId, "evt-dlq-001");
    assert.equal(deadLetters[0]?.consumerId, "dlq-consumer");
    assert.equal(deadLetters[0]?.failureCount, 3);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository listPendingEventsForConsumer returns pending acks", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-pending-consumer-task", now);

    repo.insertEvent({
      id: "sqlite-pending-evt-1",
      taskId: "sqlite-pending-consumer-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-pending-1",
      createdAt: now,
    });

    repo.insertEventConsumerAck({
      id: "sqlite-pending-ack-1",
      eventId: "sqlite-pending-evt-1",
      consumerId: "sqlite-test-consumer",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    const pending = repo.listPendingEventsForConsumer("sqlite-test-consumer");
    assert.equal(pending.length, 1);
    assert.equal(pending[0]?.event?.id, "sqlite-pending-evt-1");
    assert.equal(pending[0]?.ack?.status, "pending");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository getRequiredConsumerIds returns consumer ids for event", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-required-cons-task", now);

    // insertEvent automatically creates consumer acks for required consumers
    const event = repo.insertEvent({
      id: "sqlite-required-cons-evt",
      taskId: "sqlite-required-cons-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: "trace-required-cons",
      createdAt: now,
    });

    const consumerIds = repo.getRequiredConsumerIds(event.id);
    assert.ok(consumerIds.length >= 1, "should have at least one required consumer");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventRepository ackAllConsumersForEvent marks all pending/failed acks as acked", () => {
  const workspace = createTempWorkspace("aa-sqlite-event-repo-");
  const dbPath = join(workspace, "event-repo.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);
    const taskRepo = new TaskRepository(db.connection);

    const now = "2026-04-27T10:00:00.000Z";
    createTestTask(taskRepo, "sqlite-ack-all-task", now);

    const event = repo.insertEvent({
      id: "sqlite-ack-all-evt",
      taskId: "sqlite-ack-all-task",
      sessionId: null,
      executionId: null,
      eventType: "task:status_changed",
      eventTier: "tier_2",
      payloadJson: "{}",
      traceId: "trace-ack-all",
      createdAt: now,
    });

    // Manually add multiple consumer acks
    repo.insertEventConsumerAck({
      id: "sqlite-ack-all-consumer-1",
      eventId: event.id,
      consumerId: "consumer-1",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });
    repo.insertEventConsumerAck({
      id: "sqlite-ack-all-consumer-2",
      eventId: event.id,
      consumerId: "consumer-2",
      status: "pending",
      lastAttemptAt: null,
      ackedAt: null,
      errorCode: null,
      attemptCount: 0,
    });

    repo.ackAllConsumersForEvent(event.id, now);

    const ack1 = repo.getEventConsumerAck(event.id, "consumer-1");
    const ack2 = repo.getEventConsumerAck(event.id, "consumer-2");
    assert.equal(ack1?.status, "acked");
    assert.equal(ack2?.status, "acked");
    assert.ok(ack1?.ackedAt);
    assert.ok(ack2?.ackedAt);
  } finally {
    cleanupPath(workspace);
  }
});
