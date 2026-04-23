/**
 * Integration Tests: Takeover Queue Manager
 *
 * Tests the TakeoverQueueManager with real event emission tracking
 * and database-backed workflow integration.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { TakeoverQueueManager, type TakeoverQueueConfig } from "../../../../../src/platform/control-plane/incident-control/takeover-queue-manager.js";
import type {
  TakeoverLifecycleEvent,
  TakeoverEventPayload,
  AsyncTakeoverActionType,
} from "../../../../../src/platform/control-plane/incident-control/human-takeover-service-async.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

interface TrackedEvent {
  event: TakeoverLifecycleEvent;
  payload: unknown;
  timestamp: string;
}

function createTrackingEventEmitter() {
  const events: TrackedEvent[] = [];
  return {
    events,
    emit<T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]) {
      events.push({
        event,
        payload,
        timestamp: nowIso(),
      });
    },
  };
}

function createTestConfig(overrides: Partial<TakeoverQueueConfig> = {}): TakeoverQueueConfig {
  return {
    maxQueueDepth: 100,
    defaultPriority: 5,
    ...overrides,
  };
}

// =============================================================================
// Construction & Basic Operations
// =============================================================================

test("TakeoverQueueManager integration: enqueue emits request_enqueued event", () => {
  const workspace = createTempWorkspace("aa-queue-enqueue-");
  const dbPath = join(workspace, "queue-enqueue.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-queue-1",
      executionId: "exec-queue-1",
      traceId: "trace-queue-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    const entry = manager.enqueue({
      taskId: "task-queue-1",
      operatorId: "operator-1",
      reasonCode: "incident.test",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.test" },
    });

    assert.equal(entry.status, "pending");
    assert.equal(entry.taskId, "task-queue-1");
    assert.ok(entry.requestId.startsWith("tkrq_"));
    assert.equal(emitter.events.length, 1);
    assert.equal(emitter.events[0]?.event, "takeover:request_enqueued");
    assert.equal((emitter.events[0]?.payload as { taskId: string }).taskId, "task-queue-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: cancel emits no event but removes from queue", () => {
  const workspace = createTempWorkspace("aa-queue-cancel-");
  const dbPath = join(workspace, "queue-cancel.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-cancel-1",
      executionId: "exec-cancel-1",
      traceId: "trace-cancel-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    const entry = manager.enqueue({
      taskId: "task-cancel-1",
      operatorId: "operator-1",
      reasonCode: "incident.cancel_test",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.cancel_test" },
    });

    assert.equal(manager.getQueueDepth(), 1);

    const cancelled = manager.cancel(entry.requestId);

    assert.equal(cancelled, true);
    assert.equal(manager.getQueueDepth(), 0);
    // Cancel does not emit an event
    assert.equal(emitter.events.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: priority ordering across multiple entries", () => {
  const workspace = createTempWorkspace("aa-queue-priority-");
  const dbPath = join(workspace, "queue-priority.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-priority-1",
      executionId: "exec-priority-1",
      traceId: "trace-priority-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    // Enqueue in random order
    manager.enqueue({
      taskId: "low-priority",
      operatorId: "op",
      reasonCode: "incident.low",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.low" },
      priority: 10,
    });

    manager.enqueue({
      taskId: "high-priority",
      operatorId: "op",
      reasonCode: "incident.high",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.high" },
      priority: 1,
    });

    manager.enqueue({
      taskId: "medium-priority",
      operatorId: "op",
      reasonCode: "incident.medium",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.medium" },
      priority: 5,
    });

    const pending = manager.getPendingRequests();
    assert.equal(pending[0]?.taskId, "high-priority");
    assert.equal(pending[1]?.taskId, "medium-priority");
    assert.equal(pending[2]?.taskId, "low-priority");
    assert.equal(manager.getQueueDepth(), 3);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: queue depth respects maxQueueDepth", () => {
  const workspace = createTempWorkspace("aa-queue-depth-");
  const dbPath = join(workspace, "queue-depth.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-depth-1",
      executionId: "exec-depth-1",
      traceId: "trace-depth-1",
    });

    const smallConfig = createTestConfig({ maxQueueDepth: 3 });
    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(smallConfig, emitter);

    // Fill the queue
    manager.enqueue({
      taskId: "task-1",
      operatorId: "op",
      reasonCode: "incident.fill",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.fill" },
    });
    manager.enqueue({
      taskId: "task-2",
      operatorId: "op",
      reasonCode: "incident.fill",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.fill" },
    });
    manager.enqueue({
      taskId: "task-3",
      operatorId: "op",
      reasonCode: "incident.fill",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.fill" },
    });

    assert.equal(manager.getQueueDepth(), 3);

    // Fourth should throw with queue_full error
    assert.throws(() => {
      manager.enqueue({
        taskId: "task-overflow",
        operatorId: "op",
        reasonCode: "incident.overflow",
        actionType: "open_session",
        payload: { type: "open_session", reasonCode: "incident.overflow" },
      });
    }, /Takeover request queue is full/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: findPending and findNextPending work correctly", () => {
  const workspace = createTempWorkspace("aa-queue-find-");
  const dbPath = join(workspace, "queue-find.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-find-1",
      executionId: "exec-find-1",
      traceId: "trace-find-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    const entry1 = manager.enqueue({
      taskId: "task-first",
      operatorId: "op",
      reasonCode: "incident.first",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.first" },
    });

    manager.enqueue({
      taskId: "task-second",
      operatorId: "op",
      reasonCode: "incident.second",
      actionType: "modify_input",
      payload: { type: "modify_input", sessionId: "s1", inputJson: "{}", reasonCode: "incident.second" },
    });

    const found = manager.findPending(entry1.requestId);
    assert.ok(found);
    assert.equal(found?.taskId, "task-first");

    const next = manager.findNextPending();
    assert.ok(next);
    assert.equal(next?.taskId, "task-first");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: removeEntry cleans up completed entries", () => {
  const workspace = createTempWorkspace("aa-queue-remove-");
  const dbPath = join(workspace, "queue-remove.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-remove-1",
      executionId: "exec-remove-1",
      traceId: "trace-remove-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    const entry = manager.enqueue({
      taskId: "task-remove",
      operatorId: "op",
      reasonCode: "incident.remove",
      actionType: "open_session",
      payload: { type: "open_session", reasonCode: "incident.remove" },
    });

    assert.equal(manager.getQueueDepth(), 1);

    manager.removeEntry(entry.requestId);

    assert.equal(manager.getQueueDepth(), 0);
    assert.equal(manager.findPending(entry.requestId), undefined);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TakeoverQueueManager integration: all action types can be enqueued", () => {
  const workspace = createTempWorkspace("aa-queue-types-");
  const dbPath = join(workspace, "queue-types.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-types-1",
      executionId: "exec-types-1",
      traceId: "trace-types-1",
    });

    const emitter = createTrackingEventEmitter();
    const manager = new TakeoverQueueManager(createTestConfig(), emitter);

    const actionTypes: AsyncTakeoverActionType[] = [
      "open_session",
      "modify_input",
      "switch_worker",
      "retry_execution",
      "set_current_step",
      "write_step_output",
      "skip_current_step",
      "complete_task",
      "acknowledge_takeover",
    ];

    for (const actionType of actionTypes) {
      const entry = manager.enqueue({
        taskId: `task-${actionType}`,
        operatorId: "op",
        reasonCode: "incident.testing",
        actionType,
        payload: { type: actionType, sessionId: "s1" } as any,
      });
      assert.equal(entry.actionType, actionType, `Action type ${actionType} should be stored`);
    }

    assert.equal(manager.getQueueDepth(), actionTypes.length);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
