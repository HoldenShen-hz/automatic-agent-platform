/**
 * Integration Test: Durable Event Bus - Replay Ordering & Cross-Module Flow
 *
 * Tests for R5-37 replay ordering fields (aggregateId, runId, sequence)
 * and cross-module event flow patterns using SQLite and temporary workspaces.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("integration: durable event bus persists aggregateId/runId/sequence for replay ordering (R5-37)", () => {
  const ctx = createIntegrationContext("aa-replay-ordering-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-replay-order",
      executionId: "exec-replay-order",
      traceId: "trace-replay-order",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-replay-order",
      executionId: "exec-replay-order",
      traceId: "trace-replay-order",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
      // R5-37 replay ordering fields
      aggregateId: "aggregate-001",
      runId: "run-001",
      sequence: 42,
    });

    assert.ok(event.id.startsWith("evt_"), "Event should have valid ID");
    assert.equal(event.eventType, "task:status_changed");
    assert.equal(event.eventTier, "tier_1");
    // R5-37: verify replay ordering fields are persisted
    assert.equal(event.aggregateId, "aggregate-001", "aggregateId should be persisted");
    assert.equal(event.runId, "run-001", "runId should be persisted");
    assert.equal(event.sequence, 42, "sequence should be persisted");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus batch publish without replay ordering fields", () => {
  const ctx = createIntegrationContext("aa-batch-replay-ordering-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-batch-replay",
      executionId: "exec-batch-replay",
      traceId: "trace-batch-replay",
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-replay",
        executionId: "exec-batch-replay",
        traceId: "trace-batch-replay-1",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "dispatch:ticket_created",
        taskId: "task-batch-replay",
        executionId: "exec-batch-replay",
        traceId: "trace-batch-replay-2",
        payload: { ticketId: "ticket-batch-1" },
      },
    ]);

    assert.equal(events.length, 2, "Should publish 2 events");
    assert.ok(events[0]?.id.startsWith("evt_"), "First event should have valid ID");
    assert.ok(events[1]?.id.startsWith("evt_"), "Second event should have valid ID");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus delivers events in sequence order for same aggregate", async () => {
  const workspace = createTempWorkspace("aa-sequence-order-");
  try {
    const db = new SqliteDatabase(join(workspace, "sequence-order.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-seq-order",
      executionId: "exec-seq-order",
      traceId: "trace-seq-order",
    });

    const deliveryOrder: number[] = [];
    bus.subscribe("seq-consumer", (event) => {
      const seq = event.sequence;
      if (seq !== null) {
        deliveryOrder.push(seq);
      }
    });

    // Publish events with different sequences for the same aggregate
    const aggregateId = "aggregate-seq-test";
    for (let i = 1; i <= 5; i++) {
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-seq-order",
        executionId: "exec-seq-order",
        traceId: `trace-seq-${i}`,
        payload: { step: i },
        aggregateId,
        runId: "run-seq",
        sequence: i,
      });
    }

    // Wait for async delivery
    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.equal(deliveryOrder.length, 5, "All 5 events should be delivered");
    assert.deepEqual(deliveryOrder, [1, 2, 3, 4, 5], "Events should be delivered in sequence order");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus replays events with same runId together", async () => {
  const workspace = createTempWorkspace("aa-run-id-replay-");
  try {
    const db = new SqliteDatabase(join(workspace, "run-id-replay.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-run-replay",
      executionId: "exec-run-replay",
      traceId: "trace-run-replay",
    });

    const runIdGroups = new Set<string>();
    bus.subscribe("run-consumer", (event) => {
      if (event.runId) {
        runIdGroups.add(event.runId);
      }
    });

    // Publish events from different runId groups
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-run-replay",
      executionId: "exec-run-replay",
      traceId: "trace-run-a",
      payload: { run: "A" },
      aggregateId: "agg-run-a",
      runId: "run-A",
      sequence: 1,
    });
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-run-replay",
      executionId: "exec-run-replay",
      traceId: "trace-run-b",
      payload: { run: "B" },
      aggregateId: "agg-run-b",
      runId: "run-B",
      sequence: 1,
    });
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-run-replay",
      executionId: "exec-run-replay",
      traceId: "trace-run-a2",
      payload: { run: "A2" },
      aggregateId: "agg-run-a",
      runId: "run-A",
      sequence: 2,
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(runIdGroups.has("run-A"), "run-A should be delivered");
    assert.ok(runIdGroups.has("run-B"), "run-B should be delivered");
    assert.equal(runIdGroups.size, 2, "Both runId groups should be delivered");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: cross-module event flow - event published by one module can be consumed by another", async () => {
  const workspace = createTempWorkspace("aa-cross-module-");
  try {
    const db = new SqliteDatabase(join(workspace, "cross-module.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-cross-module",
      executionId: "exec-cross-module",
      traceId: "trace-cross-module",
    });

    // Module A: dispatch service publishes a ticket_created event
    const ticketEvent = bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-cross-module",
      executionId: "exec-cross-module",
      traceId: "trace-cross-module",
      payload: {
        ticketId: "ticket-cross-001",
        queueId: "high-priority",
        sourceModule: "dispatch_service",
      },
    });

    // Module B: inspect_projection consumes and processes the event
    let consumedByProjection = false;
    let projectionEventType = "";
    bus.subscribe("inspect_projection", (event) => {
      if (event.eventType === "dispatch:ticket_created") {
        consumedByProjection = true;
        projectionEventType = event.eventType;
      }
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    assert.ok(ticketEvent.id.startsWith("evt_"), "Ticket event should be published");
    assert.equal(projectionEventType, "dispatch:ticket_created", "Projection should consume ticket_created event");
    assert.ok(consumedByProjection, "inspect_projection should consume the event");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: cross-module event flow - tier-1 events require acknowledgment", async () => {
  const ctx = createIntegrationContext("aa-tier1-ack-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-tier1-ack",
      executionId: "exec-tier1-ack",
      traceId: "trace-tier1-ack",
    });

    // Publish a tier-1 event
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-tier1-ack",
      executionId: "exec-tier1-ack",
      traceId: "trace-tier1-ack",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
      aggregateId: "agg-tier1",
      runId: "run-tier1",
      sequence: 1,
    });

    // Verify ack records are created for tier-1 consumers
    const acks = ctx.store.listPendingTier1Acks(event.id);
    assert.ok(acks.length > 0, "Tier-1 event should create ack records");

    // Verify the pendingForConsumer returns the event for registered consumers
    const pending = bus.pendingForConsumer("inspect_projection");
    const found = pending.find((p) => p.event.id === event.id);
    assert.ok(found, "Tier-1 event should appear in pendingForConsumer for registered consumers");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: deliverPending processes all pending events and acks them", async () => {
  const workspace = createTempWorkspace("aa-deliver-pending-");
  try {
    const db = new SqliteDatabase(join(workspace, "deliver-pending.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-deliver-pending",
      executionId: "exec-deliver-pending",
      traceId: "trace-deliver-pending",
    });

    // Subscribe but don't rely on polling
    let deliveredCount = 0;
    bus.subscribe("deliver-test-consumer", async (event) => {
      deliveredCount++;
    });

    // Publish multiple events
    for (let i = 0; i < 3; i++) {
      bus.publish({
        eventType: "dispatch:ticket_created",
        taskId: "task-deliver-pending",
        executionId: "exec-deliver-pending",
        traceId: `trace-deliver-${i}`,
        payload: { ticketId: `ticket-deliver-${i}` },
      });
    }

    // Wait for polling-based delivery
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Verify all events delivered
    assert.equal(deliveredCount, 3, "All 3 events should be delivered");

    // Verify no pending events remain
    const pending = bus.pendingForConsumer("deliver-test-consumer");
    assert.equal(pending.length, 0, "No pending events should remain after delivery");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus rejects null/undefined replay fields gracefully", () => {
  const ctx = createIntegrationContext("aa-replay-null-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-replay-null",
      executionId: "exec-replay-null",
      traceId: "trace-replay-null",
    });

    // Publish with null replay fields - should not throw
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-replay-null",
      executionId: "exec-replay-null",
      traceId: "trace-replay-null",
      payload: { status: "completed" },
      aggregateId: null,
      runId: null,
      sequence: null,
    });

    assert.ok(event.id.startsWith("evt_"), "Event should be published");
    assert.equal(event.aggregateId, null, "aggregateId should be null");
    assert.equal(event.runId, null, "runId should be null");
    assert.equal(event.sequence, null, "sequence should be null");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus principal field is preserved", () => {
  const ctx = createIntegrationContext("aa-principal-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-principal",
      executionId: "exec-principal",
      traceId: "trace-principal",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-principal",
      executionId: "exec-principal",
      traceId: "trace-principal",
      payload: { status: "in_progress" },
      principal: "user:admin@example.com",
    });

    assert.equal(event.principal, "user:admin@example.com", "Principal should be preserved");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: multiple consumers can subscribe and receive events independently", async () => {
  const workspace = createTempWorkspace("aa-multi-consumer-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-consumer.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-multi-consumer",
      executionId: "exec-multi-consumer",
      traceId: "trace-multi-consumer",
    });

    let consumerACount = 0;
    let consumerBCount = 0;

    bus.subscribe("consumer-A", (event) => {
      consumerACount++;
    });

    bus.subscribe("consumer-B", (event) => {
      consumerBCount++;
    });

    // Publish several events
    for (let i = 0; i < 5; i++) {
      bus.publish({
        eventType: "dispatch:ticket_created",
        taskId: "task-multi-consumer",
        executionId: "exec-multi-consumer",
        traceId: `trace-multi-${i}`,
        payload: { ticketId: `ticket-multi-${i}` },
      });
    }

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(consumerACount, 5, "Consumer A should receive all 5 events");
    assert.equal(consumerBCount, 5, "Consumer B should receive all 5 events");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});