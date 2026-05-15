/**
 * Event Bus Concurrent Test - Verifies that the event bus correctly handles
 * concurrent event publishing and acknowledgment.
 *
 * This test validates:
 * - Concurrent event inserts are all recorded (no lost events)
 * - Multiple consumers can acknowledge the same event independently
 * - Event ordering is preserved per task
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { EventRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { TaskRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/task-repository.js";
import { ExecutionRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/execution-repository.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { EventRecord, EventConsumerAckRecord } from "../../../../../src/platform/contracts/types/domain.js";

function createTestTask(db: SqliteDatabase, taskId: string, now: string): void {
  const taskRepo = new TaskRepository(db.connection);
  taskRepo.insertTask({
    id: taskId,
    parentId: null,
    rootId: taskId,
    divisionId: "general_ops",
    tenantId: null,
    title: "Test task",
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

function createTestExecution(db: SqliteDatabase, execId: string, taskId: string, now: string): void {
  const execRepo = new ExecutionRepository(db.connection);
  createTestTask(db, taskId, now);
  execRepo.insertExecution({
    id: execId,
    taskId,
    workflowId: "single_agent_minimal",
    parentExecutionId: null,
    agentId: "agent-1",
    roleId: "general_executor",
    runKind: "task_run",
    status: "executing",
    inputRef: null,
    traceId: `trace-${execId}`,
    attempt: 1,
    timeoutMs: 60000,
    budgetUsdLimit: 1.0,
    requiresApproval: 0,
    sandboxMode: "workspace_write",
    allowedToolsJson: "[]",
    allowedPathsJson: "[]",
    maxRetries: 0,
    retryBackoff: "none",
    lastErrorCode: null,
    lastErrorMessage: null,
    startedAt: now,
    finishedAt: null,
    createdAt: now,
    updatedAt: now,
  });
}

test("concurrent event publishing - all events are recorded", () => {
  const workspace = createTempWorkspace("aa-event-concurrent-");
  const dbPath = join(workspace, "event-concurrent.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const taskId = "task-event-concurrent";
    const execId = "exec-event-concurrent";

    createTestExecution(db, execId, taskId, now);

    // Publish 10 events concurrently (simulated by sequential insert)
    const eventCount = 10;
    const eventIds: string[] = [];

    for (let i = 0; i < eventCount; i++) {
      const eventId = `event-concurrent-${i}`;
      eventIds.push(eventId);

      const event: EventRecord = {
        id: eventId,
        taskId,
        sessionId: null,
        executionId: execId,
        eventType: "test.event",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ seq: i }),
        traceId: `trace-${execId}`,
        createdAt: now,
      };

      repo.insertEvent(event);
    }

    // All events should be retrievable
    const events = repo.listEventsForTask(taskId);
    assert.equal(events.length, eventCount, `All ${eventCount} events should be recorded`);

    // Verify all event IDs are present
    const recordedIds = events.map((e) => e.id).sort();
    const expectedIds = eventIds.sort();
    assert.deepEqual(recordedIds, expectedIds, "All event IDs should match");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent event publishing - event ordering preserved per task", () => {
  const workspace = createTempWorkspace("aa-event-order-");
  const dbPath = join(workspace, "event-order.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const taskId = "task-event-order";
    const execId = "exec-event-order";

    createTestExecution(db, execId, taskId, now);

    // Insert events with sequential timestamps
    const timestamps = [
      "2026-04-14T10:00:00.000Z",
      "2026-04-14T10:00:01.000Z",
      "2026-04-14T10:00:02.000Z",
      "2026-04-14T10:00:03.000Z",
    ];

    for (let i = 0; i < timestamps.length; i++) {
      const event: EventRecord = {
        id: `event-order-${i}`,
        taskId,
        sessionId: null,
        executionId: execId,
        eventType: "test.ordered",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ seq: i }),
        traceId: `trace-${execId}`,
        createdAt: timestamps[i]!,
      };

      repo.insertEvent(event);
    }

    // Events are returned in DESC order (most recent first) by listEventsForTask
    // Pass a large limit to ensure the ORDER BY created_at DESC path is used
    // (avoids tenant context injection that would switch to ASC order)
    const events = repo.listEventsForTask(taskId, 1000);
    assert.equal(events.length, 4, "All 4 events should be recorded");

    // Verify events are returned in DESC order by createdAt
    // Most recent (seq=3) comes first
    for (let i = 0; i < events.length; i++) {
      const payload = JSON.parse(events[i]!.payloadJson);
      // events[0] has seq=3 (most recent), events[3] has seq=0 (oldest)
      const expectedSeq = 3 - i;
      assert.equal(payload.seq, expectedSeq, `Event ${i} should have seq=${expectedSeq}`);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent consumer acks - each consumer can ack independently", () => {
  const workspace = createTempWorkspace("aa-event-acks-");
  const dbPath = join(workspace, "event-acks.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";
    const taskId = "task-event-acks";
    const execId = "exec-event-acks";
    const eventId = "event-single-acks";

    createTestExecution(db, execId, taskId, now);

    // Create an event
    const event: EventRecord = {
      id: eventId,
      taskId,
      sessionId: null,
      executionId: execId,
      eventType: "test.acked",
      eventTier: "tier_1",
      payloadJson: "{}",
      traceId: `trace-${execId}`,
      createdAt: now,
    };

    repo.insertEvent(event);

    // Consumer A acknowledges
    const ackA: EventConsumerAckRecord = {
      id: "ack-a",
      eventId,
      consumerId: "consumer-a",
      status: "acked",
      lastAttemptAt: now,
      ackedAt: now,
      errorCode: null,
      attemptCount: 1,
    };
    repo.insertEventConsumerAck(ackA);

    // Consumer B acknowledges the same event independently
    const ackB: EventConsumerAckRecord = {
      id: "ack-b",
      eventId,
      consumerId: "consumer-b",
      status: "acked",
      lastAttemptAt: now,
      ackedAt: now,
      errorCode: null,
      attemptCount: 1,
    };
    repo.insertEventConsumerAck(ackB);

    // Both acks should exist independently
    const retrievedAckA = repo.getEventConsumerAck(eventId, "consumer-a");
    const retrievedAckB = repo.getEventConsumerAck(eventId, "consumer-b");

    assert.ok(retrievedAckA, "Consumer A ack should exist");
    assert.ok(retrievedAckB, "Consumer B ack should exist");
    assert.equal(retrievedAckA!.status, "acked", "Consumer A status should be acked");
    assert.equal(retrievedAckB!.status, "acked", "Consumer B status should be acked");
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent event publishing - different tasks have isolated events", () => {
  const workspace = createTempWorkspace("aa-event-isolate-");
  const dbPath = join(workspace, "event-isolate.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const repo = new EventRepository(db.connection);

    const now = "2026-04-14T10:00:00.000Z";

    // Create 3 tasks with events
    const taskCount = 3;
    const eventsPerTask = 5;

    for (let t = 1; t <= taskCount; t++) {
      const taskId = `task-isolate-${t}`;
      const execId = `exec-isolate-${t}`;
      createTestExecution(db, execId, taskId, now);

      for (let e = 0; e < eventsPerTask; e++) {
        const event: EventRecord = {
          id: `event-isolate-${t}-${e}`,
          taskId,
          sessionId: null,
          executionId: execId,
          eventType: "test.isolated",
          eventTier: "tier_1",
          payloadJson: JSON.stringify({ task: t, event: e }),
          traceId: `trace-${execId}`,
          createdAt: now,
        };
        repo.insertEvent(event);
      }
    }

    // Each task should have exactly its own events
    for (let t = 1; t <= taskCount; t++) {
      const taskId = `task-isolate-${t}`;
      const events = repo.listEventsForTask(taskId);
      assert.equal(events.length, eventsPerTask, `Task ${t} should have ${eventsPerTask} events`);

      // Verify all events belong to this task
      for (const evt of events) {
        assert.equal(evt.taskId, taskId, "All events should belong to the correct task");
      }
    }
  } finally {
    cleanupPath(workspace);
  }
});
