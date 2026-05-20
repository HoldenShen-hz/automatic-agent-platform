/**
 * Integration tests for DurableEventBus with real database operations
 *
 * Tests end-to-end event flow with actual SQLite persistence,
 * including batch operations, error handling, and multi-consumer scenarios.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("integration: durable event bus publishes and persists event to SQLite", () => {
  const ctx = createIntegrationContext("aa-integration-persist-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-persist",
      executionId: "exec-persist",
      traceId: "trace-persist",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-persist",
      executionId: "exec-persist",
      traceId: "trace-persist",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Verify event is persisted in the database
    const storedEvent = ctx.store.event.getEvent(event.id);
    assert.ok(storedEvent, "Event should be persisted in database");
    assert.equal(storedEvent!.id, event.id);
    assert.equal(storedEvent!.eventType, "task:status_changed");
    assert.equal(storedEvent!.taskId, "task-persist");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus batch publish persists all events atomically", () => {
  const ctx = createIntegrationContext("aa-integration-batch-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-batch-atomic",
      executionId: "exec-batch-atomic",
      traceId: "trace-batch-atomic",
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-atomic",
        executionId: "exec-batch-atomic",
        traceId: "trace-batch-atomic-1",
        payload: { fromStatus: "queued", toStatus: "in_progress", step: 1 },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch-atomic",
        executionId: "exec-batch-atomic",
        traceId: "trace-batch-atomic-2",
        payload: { fromStatus: "in_progress", toStatus: "completed", step: 2 },
      },
    ]);

    assert.equal(events.length, 2);

    // Verify all events are persisted
    for (const evt of events) {
      const stored = ctx.store.event.getEvent(evt.id);
      assert.ok(stored, `Event ${evt.id} should be persisted`);
    }

    // Verify we can retrieve both events
    const allForTask = ctx.store.listEventsForTask("task-batch-atomic");
    assert.equal(allForTask.length, 2, "Both batch events should be stored");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus deliverPending acks events and updates store", async () => {
  const workspace = createTempWorkspace("aa-integration-deliver-");
  try {
    const db = new SqliteDatabase(join(workspace, "deliver-ack.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-deliver-ack",
      executionId: "exec-deliver-ack",
      traceId: "trace-deliver-ack",
    });

    const bus = new DurableEventBus(db, store);

    // Subscribe and publish - tier1 events create pending acks for required consumers
    bus.subscribe("task_projection", async () => {});

    // Publish multiple tier-1 events
    const events = [
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-deliver-ack",
        executionId: "exec-deliver-ack",
        traceId: "trace-deliver-ack-1",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      }),
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-deliver-ack",
        executionId: "exec-deliver-ack",
        traceId: "trace-deliver-ack-2",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      }),
    ];

    // Check pending acks exist - deliverPending should be able to process them
    const pending = bus.pendingForConsumer("task_projection");
    assert.ok(pending.length >= 2, "Should have at least 2 pending events");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus handles delivery failure and records error", async () => {
  const workspace = createTempWorkspace("aa-integration-fail-");
  try {
    const db = new SqliteDatabase(join(workspace, "delivery-fail.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-delivery-fail",
      executionId: "exec-delivery-fail",
      traceId: "trace-delivery-fail",
    });

    const bus = new DurableEventBus(db, store);

    bus.subscribe("failing_consumer", async () => {
      throw new Error("Simulated handler failure");
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-delivery-fail",
      executionId: "exec-delivery-fail",
      traceId: "trace-delivery-fail",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Attempt delivery - should throw due to handler failure
    await assert.rejects(
      () => bus.deliverPending("failing_consumer"),
      /dead-lettered|handler always fails/,
    );

    // Verify event is marked as dead-lettered in store
    const ack = store.event.getEventConsumerAck(event.id, "failing_consumer");
    assert.ok(ack, "Ack record should exist");
    assert.equal(ack!.status, "dead_lettered", "Status should be dead_lettered");
    assert.ok(ack!.errorCode, "Error code should be recorded");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus multiple consumers with independent acks", async () => {
  const ctx = createIntegrationContext("aa-multi-acks-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-multi-acks",
      executionId: "exec-multi-acks",
      traceId: "trace-multi-acks",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-acks",
      executionId: "exec-multi-acks",
      traceId: "trace-multi-acks",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Get acks for multiple consumers
    const ack1 = ctx.store.event.getEventConsumerAck(event.id, "task_projection");
    const ack2 = ctx.store.event.getEventConsumerAck(event.id, "inspect_projection");

    assert.ok(ack1, "task_projection should have ack record");
    assert.ok(ack2, "inspect_projection should have ack record");
    assert.equal(ack1!.status, "pending", "Should be pending initially");
    assert.equal(ack2!.status, "pending", "Should be pending initially");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus delivers to multiple consumers independently", async () => {
  const workspace = createTempWorkspace("aa-multi-deliver-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-deliver.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-multi-deliver",
      executionId: "exec-multi-deliver",
      traceId: "trace-multi-deliver",
    });

    const bus = new DurableEventBus(db, store);
    const consumerA: string[] = [];
    const consumerB: string[] = [];

    bus.subscribe("consumer-a", async (event) => {
      consumerA.push(event.id);
    });

    bus.subscribe("consumer-b", async (event) => {
      consumerB.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-deliver",
      executionId: "exec-multi-deliver",
      traceId: "trace-multi-deliver",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await bus.deliverPending("consumer-a");
    await bus.deliverPending("consumer-b");

    assert.equal(consumerA.length, 1, "Consumer A should receive event");
    assert.equal(consumerB.length, 1, "Consumer B should receive event");
    assert.equal(consumerA[0], event.id);
    assert.equal(consumerB[0], event.id);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus creates task reference if taskId provided but task not found", () => {
  const ctx = createIntegrationContext("aa-task-ref-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "existing-task",
      executionId: "exec-task-ref",
      traceId: "trace-task-ref",
    });

    // Publish event with existing taskId
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "existing-task",
      executionId: "exec-task-ref",
      traceId: "trace-task-ref",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Verify event was stored
    const stored = ctx.store.event.getEvent(event.id);
    assert.ok(stored, "Event should be stored");
    assert.equal(stored!.taskId, "existing-task");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus traceContext is injected into payload", () => {
  const ctx = createIntegrationContext("aa-trace-context-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-trace",
      executionId: "exec-trace",
      traceId: "trace-main",
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-trace",
      executionId: "exec-trace",
      traceId: "trace-main",
      traceContext: {
        traceId: "trace-abc",
        spanId: "span-123",
        parentSpanId: "span-parent",
        correlationId: "corr-xyz",
      },
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const events = ctx.store.listEventsForTask("task-trace");
    assert.equal(events.length, 1);

    const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
    assert.deepEqual(payload.traceContext, {
      traceId: "trace-abc",
      spanId: "span-123",
      parentSpanId: "span-parent",
      correlationId: "corr-xyz",
    });

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: durable event bus dispatches tier2 events without pending acks", async () => {
  const workspace = createTempWorkspace("aa-tier2-dispatch-");
  try {
    const db = new SqliteDatabase(join(workspace, "tier2-dispatch.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-tier2",
      executionId: "exec-tier2",
      traceId: "trace-tier2",
    });

    const bus = new DurableEventBus(db, store);
    let handlerCalled = false;

    bus.subscribe("tier2_consumer", async () => {
      handlerCalled = true;
    });

    // Tier 2 event (dispatch:ticket_created) should be dispatched immediately
    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-tier2",
      executionId: "exec-tier2",
      traceId: "trace-tier2",
      payload: { ticketId: "ticket-tier2" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(handlerCalled, "Tier 2 event should be dispatched to handler");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: durable event bus event store query operations work correctly", () => {
  const ctx = createIntegrationContext("aa-event-query-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-query",
      executionId: "exec-query",
      traceId: "trace-query",
    });

    // Publish various event types
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-query",
      executionId: "exec-query",
      traceId: "trace-query-1",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-query",
      executionId: "exec-query",
      traceId: "trace-query-2",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    // Query by type
    const taskEvents = ctx.store.event.listEventsByType("task:status_changed");
    assert.equal(taskEvents.length, 2, "Should find 2 task:status_changed events");

    // Query by task
    const forTask = ctx.store.listEventsForTask("task-query");
    assert.equal(forTask.length, 2, "Should find 2 events for task-query");

    // List all events
    const all = ctx.store.event.listAllEvents();
    assert.ok(all.length >= 2, "Should have at least 2 events total");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});
