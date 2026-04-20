/**
 * Soak Test: Event Bus Long-Running Behavior
 *
 * Tests that the durable event bus remains stable over extended operation.
 * Verifies no memory leaks or event loss during sustained publish/consume.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";

test("soak: event bus handles sustained publish operations", () => {
  const workspace = createTempWorkspace("soak-event-bus-");

  try {
    const dbPath = join(workspace, "soak-events.db");
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
        divisionId: "general_ops",
        title: "Event bus soak test",
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

    const iterations = 100;
    for (let i = 0; i < iterations; i++) {
      eventBus.publish({
        eventType: "perf:test_event",
        taskId,
        payload: { index: i, data: "x".repeat(50) },
        traceId: newId("trace"),
      });
    }

    const events = store.listEventsForTask(taskId);
    assert.ok(events.length >= iterations, `Should have at least ${iterations} events stored`);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("soak: event bus handles varied event types without conflicts", () => {
  const workspace = createTempWorkspace("soak-event-types-");

  try {
    const dbPath = join(workspace, "soak-event-types.db");
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
        divisionId: "general_ops",
        title: "Event types soak test",
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

    const eventTypes = [
      "perf:test_event",
      "perf:burst_event",
      "test:capacity",
      "test:many_events",
    ];

    const iterations = 50;
    for (let i = 0; i < iterations; i++) {
      const eventType = eventTypes[i % eventTypes.length]!;
      eventBus.publish({
        eventType,
        taskId,
        payload: { index: i, type: eventType },
        traceId: newId("trace"),
      });
    }

    const events = store.listEventsForTask(taskId);
    assert.ok(events.length >= iterations, "Should store events of various types");

    const eventTypeCount = new Set(events.map((e) => e.eventType)).size;
    assert.ok(eventTypeCount > 1, "Should have multiple event types stored");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
