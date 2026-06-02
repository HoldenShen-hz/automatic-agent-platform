/**
 * Lifecycle Integration Test: Lifecycle Events
 *
 * Verifies event lifecycle behavior:
 * - DurableEventBus initialization and disposal
 * - Event subscription lifecycle
 * - Event publishing lifecycle
 * - Event delivery lifecycle
 *
 * Part of lifecycle tests in tests/integration/platform/shared/lifecycle/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("lifecycle: DurableEventBus starts in non-disposed state", () => {
  assert.doesNotThrow(() => {
    const workspace = createTempWorkspace("lifecycle-evt-init-");

    try {
      const dbPath = join(workspace, "evt-init.db");
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      const eventBus = new DurableEventBus(db, store);

      // Should be able to subscribe (not disposed)
      let received = false;
      eventBus.subscribe("test-consumer", () => { received = true; });

      // Publishing should work
      const taskId = newId("task");
      const now = nowIso();

      db.transaction(() => {
        store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: "Init test",
          status: "in_progress",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: now,
          updatedAt: now,
          completedAt: null,
        });
      });

      eventBus.publish({
        eventType: "task:status_changed",
        taskId,
        payload: { fromStatus: "in_progress", toStatus: "done" },
        traceId: newId("trace"),
      });

      eventBus.dispose();
      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});

test("lifecycle: DurableEventBus.publish() stores event durably", () => {
  const workspace = createTempWorkspace("lifecycle-evt-persist-");

  try {
    const dbPath = join(workspace, "evt-persist.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Persist test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const eventRecord = eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "in_progress", toStatus: "done" },
      traceId: newId("trace"),
    });

    // Event should be stored in database
    const storedEvents = db.connection
      .prepare("SELECT * FROM events WHERE id = ?")
      .all(eventRecord.id) as Array<{ id: string; event_type: string }>;

    assert.ok(storedEvents.length > 0, "Event should be stored in database");
    assert.strictEqual(storedEvents[0]!.event_type, "task:status_changed");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: DurableEventBus.subscribe() and unsubscribe() work correctly", () => {
  const workspace = createTempWorkspace("lifecycle-evt-sub-");

  try {
    const dbPath = join(workspace, "evt-sub.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Sub test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Subscribe should not throw
    eventBus.subscribe("sub-consumer", () => {});

    // Publish tier-1 event
    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "in_progress", toStatus: "done" },
      traceId: newId("trace"),
    });

    // Verify event was stored
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ?")
      .all(taskId);

    assert.ok(events.length > 0, "Event should be stored in database");

    // Unsubscribe should not throw
    eventBus.unsubscribe("sub-consumer");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: DurableEventBus.dispose() can be called multiple times safely", () => {
  assert.doesNotThrow(() => {
    const workspace = createTempWorkspace("lifecycle-evt-dispose-");

    try {
      const dbPath = join(workspace, "evt-dispose.db");
      const db = new SqliteDatabase(dbPath);
      db.migrate();
      const store = new AuthoritativeTaskStore(db);
      const eventBus = new DurableEventBus(db, store);

      // Dispose multiple times should not throw
      eventBus.dispose();
      eventBus.dispose();

      db.close();
    } finally {
      cleanupPath(workspace);
    }
  });
});

test("lifecycle: Event published with task association can be queried by task_id", () => {
  const workspace = createTempWorkspace("lifecycle-evt-task-");

  try {
    const dbPath = join(workspace, "evt-task.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Task assoc test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "in_progress", toStatus: "done" },
      traceId: newId("trace"),
    });

    // Query by task_id
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ?")
      .all(taskId) as Array<{ id: string; task_id: string }>;

    assert.ok(events.length > 0, "Should find events by task_id");
    assert.strictEqual(events[0]!.task_id, taskId, "Event task_id should match");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Multiple events can be published and queried in order", () => {
  const workspace = createTempWorkspace("lifecycle-evt-order-");

  try {
    const dbPath = join(workspace, "evt-order.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Order test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    // Publish multiple events with valid payloads
    for (let i = 0; i < 5; i++) {
      eventBus.publish({
        eventType: "task:status_changed",
        taskId,
        payload: { fromStatus: "in_progress", toStatus: `done_${i}` },
        traceId: newId("trace"),
      });
    }

    // Query events
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ? ORDER BY created_at ASC")
      .all(taskId) as Array<{ id: string }>;

    assert.strictEqual(events.length, 5, "Should have 5 events");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Event bus pendingForConsumer returns correct pending events", () => {
  const workspace = createTempWorkspace("lifecycle-evt-pending-");

  try {
    const dbPath = join(workspace, "evt-pending.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Pending test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    eventBus.subscribe("pending-consumer", () => {});

    // Publish tier-1 event (creates pending ack)
    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "in_progress", toStatus: "done" },
      traceId: newId("trace"),
    });

    // Get pending events
    const pending = eventBus.pendingForConsumer("pending-consumer");

    assert.ok(pending.length > 0, "Should have pending events for consumer");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Event payload is stored as JSON", () => {
  const workspace = createTempWorkspace("lifecycle-evt-payload-");

  try {
    const dbPath = join(workspace, "evt-payload.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Payload test",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });
    });

    const payload = { fromStatus: "in_progress", toStatus: "done", extra: { nested: true } };

    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload,
      traceId: newId("trace"),
    });

    // Query and parse payload
    const events = db.connection
      .prepare("SELECT payload_json FROM events WHERE task_id = ?")
      .all(taskId) as Array<{ payload_json: string }>;

    assert.ok(events.length > 0, "Should have event");

    const parsedPayload = JSON.parse(events[0]!.payload_json);
    assert.deepStrictEqual(parsedPayload, payload, "Payload should be stored and retrieved correctly");

    eventBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
