/**
 * Reliability Integration Test: Observable Audit Trails
 *
 * Verifies audit events can be stored and queried.
 * Part of reliability tests per strategy doc Section 6.0c.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus } from "../../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("reliability: events can be stored and queried for audit", () => {
  const workspace = createTempWorkspace("reliability-audit-");

  try {
    const dbPath = join(workspace, "audit.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Audit test",
        status: "pending",
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

    // Publish events using event bus (creates audit trail)
    for (let i = 0; i < 3; i++) {
      eventBus.publish({
        eventType: "task:status_changed",
        taskId,
        payload: {
          fromStatus: "pending",
          toStatus: "in_progress",
          sequence: i,
        },
        traceId: newId("trace"),
      });
    }

    // Events should be queryable
    const events = db.connection
      .prepare("SELECT * FROM events WHERE task_id = ? ORDER BY created_at")
      .all(taskId) as Array<{
        id: string;
        event_type: string;
        payload_json: string;
        created_at: string;
      }>;

    assert.ok(events.length >= 3, "Should have at least 3 events");
    assert.strictEqual(events[0]!.event_type, "task:status_changed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: event ordering is preserved by created_at", () => {
  const workspace = createTempWorkspace("reliability-event-order-");

  try {
    const dbPath = join(workspace, "event-order.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Event order test",
        status: "pending",
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

    // Create multiple events
    for (let i = 0; i < 5; i++) {
      eventBus.publish({
        eventType: "task:status_changed",
        taskId,
        payload: {
          fromStatus: i === 0 ? "pending" : "in_progress",
          toStatus: "in_progress",
          sequence: i,
        },
        traceId: newId("trace"),
      });
    }

    // Query events ordered by created_at
    const events = db.connection
      .prepare("SELECT created_at FROM events WHERE task_id = ? ORDER BY created_at ASC")
      .all(taskId) as Array<{ created_at: string }>;

    assert.ok(events.length >= 5, "Should have at least 5 events");
    // Verify timestamps are in ascending order
    for (let i = 1; i < events.length; i++) {
      assert.ok(
        events[i]!.created_at >= events[i - 1]!.created_at,
        "Events should be ordered by created_at",
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: events contain trace_id for observability", () => {
  const workspace = createTempWorkspace("reliability-trace-");

  try {
    const dbPath = join(workspace, "trace.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const traceId = newId("trace");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Trace test",
        status: "pending",
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

    // Publish event with trace_id
    eventBus.publish({
      eventType: "task:status_changed",
      taskId,
      payload: { fromStatus: "pending", toStatus: "in_progress" },
      traceId,
    });

    // Check events have trace_id
    const events = db.connection
      .prepare("SELECT trace_id, event_type FROM events WHERE task_id = ?")
      .all(taskId) as Array<{ trace_id: string | null; event_type: string }>;

    assert.ok(events.length > 0, "Should have events");
    assert.strictEqual(events[0]!.trace_id, traceId, "Event should have correct trace_id");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("reliability: event payload preserves data for replay", () => {
  const workspace = createTempWorkspace("reliability-payload-");

  try {
    const dbPath = join(workspace, "payload.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const now = nowIso();

    // Create task
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general-ops",
        title: "Payload test",
        status: "pending",
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

    // Publish event with complex payload
    const payload = {
      fromStatus: "pending",
      toStatus: "in_progress",
      metadata: {
        actor: "test-user",
        reason: "manual_start",
        timestamp: now,
      },
    };

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

    assert.ok(events.length > 0, "Should have events");
    const parsedPayload = JSON.parse(events[0]!.payload_json);
    assert.strictEqual(parsedPayload.fromStatus, "pending");
    assert.strictEqual(parsedPayload.toStatus, "in_progress");
    assert.strictEqual(parsedPayload.metadata.actor, "test-user");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
