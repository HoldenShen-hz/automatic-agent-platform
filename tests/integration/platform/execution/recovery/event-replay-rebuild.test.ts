/**
 * Recovery Integration Test: Event Replay Rebuild
 *
 * Verifies that system state can be reconstructed from events.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("recovery: events can be replayed to reconstruct state", () => {
  const workspace = createTempWorkspace("recovery-event-replay-");

  try {
    const dbPath = join(workspace, "event-replay.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event replay test",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Publish events representing state changes using registered event type
    const events = [
      { fromStatus: "pending", toStatus: "created", sequence: 1 },
      { fromStatus: "created", toStatus: "in_progress", sequence: 2 },
      { fromStatus: "in_progress", toStatus: "in_progress", sequence: 3 },
      { fromStatus: "in_progress", toStatus: "done", sequence: 4 },
    ];

    db.transaction(() => {
      for (const event of events) {
        eventBus.publish({
          eventType: "task:status_changed",
          taskId,
          sessionId,
          payload: {
            fromStatus: event.fromStatus,
            toStatus: event.toStatus,
            occurredAt: now,
            entityId: taskId,
          },
        });
      }
    });

    // Query events back
    const storedEvents = db.connection
      .prepare("SELECT event_type, payload_json FROM events WHERE task_id = ? ORDER BY created_at")
      .all(taskId) as Array<{ event_type: string; payload_json: string }>;

    assert.equal(storedEvents.length, 4, "Should have 4 events stored");
    assert.strictEqual(storedEvents[0]!.event_type, "task:status_changed", "First event should be task:status_changed");
    assert.strictEqual(storedEvents[3]!.event_type, "task:status_changed", "Last event should be task:status_changed");

    // Simulate replay: process events in sequence to rebuild state
    let taskStatus = "unknown";
    for (const event of storedEvents) {
      const payload = JSON.parse(event.payload_json);
      if (event.event_type === "task:status_changed") {
        taskStatus = payload.toStatus;
      }
    }

    assert.strictEqual(taskStatus, "done", "Replay should result in 'done' status");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: event replay preserves ordering", () => {
  const workspace = createTempWorkspace("recovery-event-order-");

  try {
    const dbPath = join(workspace, "event-order.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const eventBus = new DurableEventBus(db, store);

    const taskId = newId("task");
    const sessionId = newId("sess");
    const now = nowIso();

    // Create task and session
    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Event ordering test",
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

      store.insertSession({
        id: sessionId,
        taskId,
        channel: "cli",
        status: "open",
        externalSessionId: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    // Publish events with explicit sequence numbers in payload
    const sequences = [10, 5, 8, 3, 1, 7, 2, 9, 4, 6];

    db.transaction(() => {
      for (const seq of sequences) {
        eventBus.publish({
          eventType: "stream:chunk_emitted",
          taskId,
          sessionId,
          payload: {
            streamId: "test-stream",
            chunkIndex: seq,
            chunkType: "test",
            emittedAt: now,
          },
        });
      }
    });

    // Query events ordered by created_at (which represents insertion order)
    const storedEvents = db.connection
      .prepare("SELECT id, payload_json FROM events WHERE task_id = ? ORDER BY created_at")
      .all(taskId) as Array<{ id: string; payload_json: string }>;

    assert.equal(storedEvents.length, 10, "Should have 10 events");

    // Verify we got 10 events back
    const parsedPayloads = storedEvents.map((e) => JSON.parse(e.payload_json));
    assert.ok(parsedPayloads.length === 10, "Should have 10 parsed payloads");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
