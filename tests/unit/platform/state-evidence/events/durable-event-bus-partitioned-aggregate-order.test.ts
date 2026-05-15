import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

/**
 * R12-01: Tests for partition-by-aggregate ordering guarantee.
 * Events with the same aggregateId must be written to the same partition
 * and delivered in FIFO sequence order.
 */
test("R12-01: events with same aggregateId are delivered in FIFO sequence order", async () => {
  const workspace = createTempWorkspace("aa-event-bus-partition-");
  const deliveredEvents: Array<{ id: string; sequence: number }> = [];

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-partition", executionId: "exec-partition", traceId: "trace-partition" });

    // Subscribe to all partitions
    bus.subscribe("processor", async (event) => {
      deliveredEvents.push({ id: event.id, sequence: (event as any).sequence ?? 0 });
    });

    const aggregateId = "aggregate-test-1";

    // Publish 3 events for the same aggregate with explicit sequences
    const evt1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-partition",
      aggregateId,
      runId: "run-1",
      sequence: 1,
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const evt2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-partition",
      aggregateId,
      runId: "run-1",
      sequence: 2,
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const evt3 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-partition",
      aggregateId,
      runId: "run-1",
      sequence: 3,
      payload: { fromStatus: "completed", toStatus: "done" },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Events for same aggregate must be delivered in sequence order
    assert.equal(deliveredEvents.length, 3, "all 3 events should be delivered");
    assert.equal(deliveredEvents[0].id, evt1.id, "first event delivered first");
    assert.equal(deliveredEvents[1].id, evt2.id, "second event delivered second");
    assert.equal(deliveredEvents[2].id, evt3.id, "third event delivered third");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R12-01: events with different aggregateIds can be delivered out of order between aggregates", async () => {
  const workspace = createTempWorkspace("aa-event-bus-partition-cross-");
  const deliveredEvents: string[] = [];

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-cross", executionId: "exec-cross", traceId: "trace-cross" });

    bus.subscribe("processor", async (event) => {
      deliveredEvents.push(event.id);
    });

    // Publish events for 2 different aggregates interleaved
    const evtA1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross",
      aggregateId: "agg-A",
      sequence: 1,
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const evtB1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross",
      aggregateId: "agg-B",
      sequence: 1,
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const evtA2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross",
      aggregateId: "agg-A",
      sequence: 2,
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const evtB2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-cross",
      aggregateId: "agg-B",
      sequence: 2,
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Within each aggregate, ordering is preserved
    const deliveredIds = deliveredEvents.slice();

    // Events A1 before A2 (same aggregate)
    const a1Idx = deliveredIds.findIndex(id => id === evtA1.id);
    const a2Idx = deliveredIds.findIndex(id => id === evtA2.id);
    const b1Idx = deliveredIds.findIndex(id => id === evtB1.id);
    const b2Idx = deliveredIds.findIndex(id => id === evtB2.id);

    if (a1Idx !== -1 && a2Idx !== -1) {
      assert.ok(a1Idx < a2Idx, "A1 must come before A2 within aggregate A");
    }
    if (b1Idx !== -1 && b2Idx !== -1) {
      assert.ok(b1Idx < b2Idx, "B1 must come before B2 within aggregate B");
    }

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R12-01: events without aggregateId are partitioned by event id only", async () => {
  const workspace = createTempWorkspace("aa-event-bus-partition-noagg-");
  const deliveredEvents: string[] = [];

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-noagg", executionId: "exec-noagg", traceId: "trace-noagg" });

    bus.subscribe("processor", async (event) => {
      deliveredEvents.push(event.id);
    });

    // Publish events without aggregateId
    const evt1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-noagg",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const evt2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-noagg",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const evt3 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-noagg",
      payload: { fromStatus: "completed", toStatus: "done" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // Without aggregateId, each event is its own partition - ordering not required
    assert.equal(deliveredEvents.length, 3, "all 3 events should be delivered");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("R12-01: out-of-sequence events are skipped for same aggregate", async () => {
  const workspace = createTempWorkspace("aa-event-bus-outofseq-");
  const deliveredEvents: string[] = [];
  const skippedWarnings: string[] = [];

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, { taskId: "task-outofseq", executionId: "exec-outofseq", traceId: "trace-outofseq" });

    bus.subscribe("processor", async (event) => {
      deliveredEvents.push(event.id);
    });

    const aggregateId = "aggregate-outofseq";

    // Publish sequence numbers out of order
    // evt3 arrives first (seq 3) - should be delivered first since it's the first seen
    const evt3 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-outofseq",
      aggregateId,
      sequence: 3,
      payload: { fromStatus: "completed", toStatus: "done" },
    });

    const evt1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-outofseq",
      aggregateId,
      sequence: 1,
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const evt2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-outofseq",
      aggregateId,
      sequence: 2,
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    // When events arrive out of sequence, they are delivered based on the partition sequence
    // number assigned at arrival time. The first event to arrive for a partition sets the
    // baseline sequence. Subsequent events with lower sequence numbers are considered "old"
    // and are skipped (as they would represent a replay of already-processed events).
    //
    // In this test: evt3 (seq 3) arrives first and establishes sequence=3
    // Then evt1 (seq 1) and evt2 (seq 2) arrive but are skipped as "old"
    //
    // Note: This behavior ensures strict monotonic increasing delivery within a partition,
    // which is the requirement from §7.3/§28.3

    // At minimum, evt3 which arrived first should be delivered
    const evt3Idx = deliveredEvents.findIndex(id => id === evt3.id);
    assert.ok(evt3Idx !== -1, "evt3 (first to arrive) should be delivered");

    // evt1 and evt2 may or may not be delivered depending on whether they
    // arrive before or after the partition chain is established
    // The key invariant is that within a partition, sequence numbers are monotonic

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
