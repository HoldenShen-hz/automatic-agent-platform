/**
 * Focused unit tests for EventRepository audit, counters, and failed-event queries.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { EventRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createTestDb(workspace: string): SqliteDatabase {
  const db = new SqliteDatabase(join(workspace, "event-repo-test.db"));
  db.migrate();
  return db;
}

test("EventRepository.bootstrapTier1AuditIntegrityRecords creates integrity records for tier_1 events", () => {
  const workspace = createTempWorkspace("aa-event-repo-integrity-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-integrity", executionId: "exec-integrity", traceId: "trace-int" });

    eventRepo.insertEvent({
      id: "evt_integrity",
      taskId: "task-integrity",
      eventType: "task:status_changed",
      payloadJson: "{}",
      createdAt: nowIso(),
    });

    eventRepo.bootstrapTier1AuditIntegrityRecords();

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

test("EventRepository.countPendingTier1Acks counts pending tier 1 acks", () => {
  const workspace = createTempWorkspace("aa-event-repo-count-pending-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-cp", executionId: "exec-cp", traceId: "trace-cp" });

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

test("EventRepository.listDispatchDecisionTracesByTask retrieves decision traces", () => {
  const workspace = createTempWorkspace("aa-event-repo-decision-");
  let db: SqliteDatabase;

  try {
    db = createTestDb(workspace);
    const eventRepo = new EventRepository(db.connection);
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, { taskId: "task-decision", executionId: "exec-decision", traceId: "trace-dec" });

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
