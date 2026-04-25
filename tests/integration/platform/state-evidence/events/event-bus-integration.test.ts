/**
 * Integration Test: Event Bus Integration
 *
 * Tests event publishing, subscription delivery, acknowledgments,
 * fan-out patterns, and error handling using SQLite and temporary workspaces.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { TypedEventBus } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("integration: event bus publishes typed event and creates pending acks for tier-1 consumers", () => {
  const ctx = createIntegrationContext("aa-event-bus-typed-");
  try {
    const bus = new TypedEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-typed-publish",
      executionId: "exec-typed-publish",
      traceId: "trace-typed-publish",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-publish",
      executionId: "exec-typed-publish",
      traceId: "trace-typed-publish",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    assert.ok(event.id.startsWith("evt_"), "Event should have valid ID with evt_ prefix");
    assert.equal(event.eventType, "task:status_changed", "Event type should match");
    assert.equal(event.eventTier, "tier_1", "task:status_changed should be tier_1");

    const acks = ctx.store.listPendingTier1Acks(event.id);
    assert.ok(acks.length > 0, "Tier-1 event should create ack records for consumers");
  } finally {
    ctx.cleanup();
  }
});

test("integration: typed event bus delivers events to subscribers and handles acknowledgments", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-deliver-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-bus-deliver.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-deliver",
      executionId: "exec-typed-deliver",
      traceId: "trace-typed-deliver",
    });

    let deliveredEvents: string[] = [];
    bus.subscribe("typed_consumer", (event) => {
      deliveredEvents.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-deliver",
      executionId: "exec-typed-deliver",
      traceId: "trace-typed-deliver",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(deliveredEvents.includes(event.id), "Subscriber should receive the tier-1 event via deliverPending");

    const pending = bus.pendingForConsumer("typed_consumer");
    assert.equal(pending.length, 0, "After delivery, no pending events should remain for consumer");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: event bus publishBatch publishes multiple events atomically", () => {
  const ctx = createIntegrationContext("aa-bus-batch-");
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
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "dispatch:ticket_created",
        taskId: "task-batch-atomic",
        executionId: "exec-batch-atomic",
        traceId: "trace-batch-atomic-2",
        payload: { ticketId: "ticket-batch-atomic-1", queueId: "default" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch-atomic",
        executionId: "exec-batch-atomic",
        traceId: "trace-batch-atomic-3",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      },
    ]);

    assert.equal(events.length, 3, "Should publish all 3 events");
    assert.ok(events.every((e) => e.id.startsWith("evt_")), "All events should have valid IDs");
    assert.ok(events.every((e) => e.eventTier != null), "All events should have a tier assigned");

    const firstEventAcks = ctx.store.listPendingTier1Acks(events[0]?.id ?? "");
    assert.ok(firstEventAcks.length > 0, "Tier-1 events should create ack records");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: event bus dispatches tier-2 events to volatile handlers immediately", async () => {
  const workspace = createTempWorkspace("aa-bus-volatile-");
  try {
    const db = new SqliteDatabase(join(workspace, "bus-volatile.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-volatile",
      executionId: "exec-volatile",
      traceId: "trace-volatile",
    });

    let handlerCalled = false;
    bus.subscribe("volatile_handler", (event) => {
      if (event.eventType === "dispatch:ticket_created") {
        handlerCalled = true;
      }
    });

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-volatile",
      executionId: "exec-volatile",
      traceId: "trace-volatile",
      payload: { ticketId: "ticket-volatile-1", queueId: "default" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(handlerCalled, "Tier-2 dispatch events should be dispatched to volatile handlers immediately");
    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: event bus rejects payloads exceeding 1MB limit", () => {
  const ctx = createIntegrationContext("aa-bus-oversized-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-oversized",
      executionId: "exec-oversized",
      traceId: "trace-oversized",
    });

    const largePayload = { data: "x".repeat(1_000_001) };

    assert.throws(
      () =>
        bus.publish({
          eventType: "dispatch:ticket_created",
          taskId: "task-oversized",
          executionId: "exec-oversized",
          traceId: "trace-oversized",
          payload: largePayload,
        }),
      (err: Error) => /payload_too_large|exceeds maximum/i.test(err.message),
      "Should reject payloads exceeding 1MB",
    );

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: event bus can unsubscribe and stop receiving events", async () => {
  const workspace = createTempWorkspace("aa-bus-unsub-");
  try {
    const db = new SqliteDatabase(join(workspace, "bus-unsub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
    });

    let deliveredCount = 0;
    bus.subscribe("unsub_consumer", (event) => {
      deliveredCount++;
    });

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub-1",
      payload: { ticketId: "ticket-unsub-1", queueId: "default" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const countBeforeUnsub = deliveredCount;

    bus.unsubscribe("unsub_consumer");

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub-2",
      payload: { ticketId: "ticket-unsub-2", queueId: "default" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(deliveredCount, countBeforeUnsub, "Unsubscribed consumer should not receive new events");
    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: typed event bus provides type-safe payload parsing on delivery", async () => {
  const workspace = createTempWorkspace("aa-typed-payload-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-payload.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const typedBus = new TypedEventBus(db, store);
    const durableBus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-payload",
      executionId: "exec-typed-payload",
      traceId: "trace-typed-payload",
    });

    let receivedPayload: { fromStatus: string; toStatus: string } | null = null;
    typedBus.subscribe("typed_payload_consumer", ["task:status_changed"] as const, (envelope) => {
      receivedPayload = envelope.payload;
    });

    durableBus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-payload",
      executionId: "exec-typed-payload",
      traceId: "trace-typed-payload",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(receivedPayload !== null, "Payload should be received");
    assert.equal(receivedPayload?.fromStatus, "queued", "From status should match");
    assert.equal(receivedPayload?.toStatus, "in_progress", "To status should match");

    durableBus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: event bus multiple consumers each receive their own pending events", async () => {
  const ctx = createIntegrationContext("aa-bus-multi-consumer-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-multi-consumer",
      executionId: "exec-multi-consumer",
      traceId: "trace-multi-consumer",
    });

    let consumerAEvents: string[] = [];
    let consumerBEvents: string[] = [];

    bus.subscribe("consumer_a", (event) => {
      consumerAEvents.push(event.id);
    });

    bus.subscribe("consumer_b", (event) => {
      consumerBEvents.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-consumer",
      executionId: "exec-multi-consumer",
      traceId: "trace-multi-consumer",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(consumerAEvents.includes(event.id), "Consumer A should have received the event");
    assert.ok(consumerBEvents.includes(event.id), "Consumer B should have also received the event");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: event bus dispose prevents further operations", () => {
  const ctx = createIntegrationContext("aa-bus-dispose-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispose",
      executionId: "exec-dispose",
      traceId: "trace-dispose",
    });

    bus.dispose();

    assert.throws(
      () =>
        bus.publish({
          eventType: "dispatch:ticket_created",
          taskId: "task-dispose",
          executionId: "exec-dispose",
          traceId: "trace-dispose",
          payload: { ticketId: "ticket-dispose", queueId: "default" },
        }),
      (err: Error) => /disposed/i.test(err.message),
      "Should throw when publishing after dispose",
    );

    assert.throws(
      () => bus.subscribe("new_consumer", () => {}),
      (err: Error) => /disposed/i.test(err.message),
      "Should throw when subscribing after dispose",
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: event bus pendingForConsumer returns correct pending events", () => {
  const ctx = createIntegrationContext("aa-bus-pending-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending",
    });

    bus.subscribe("pending_consumer", () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending-1",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      traceId: "trace-pending-2",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const pending = bus.pendingForConsumer("pending_consumer");
    assert.equal(pending.length, 2, "Consumer should have 2 pending events");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("integration: event bus deliverPending acknowledges events and clears pending", async () => {
  const ctx = createIntegrationContext("aa-bus-ack-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-ack",
      executionId: "exec-ack",
      traceId: "trace-ack",
    });

    let handlerCalled = false;
    bus.subscribe("ack_consumer", (event) => {
      handlerCalled = true;
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-ack",
      executionId: "exec-ack",
      traceId: "trace-ack",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    const pendingBefore = bus.pendingForConsumer("ack_consumer").length;

    const delivered = await bus.deliverPending("ack_consumer");
    const pendingAfter = bus.pendingForConsumer("ack_consumer").length;

    assert.ok(handlerCalled, "Handler should have been called");
    assert.ok(pendingBefore > 0, "Should have pending events before deliverPending");
    assert.equal(pendingAfter, 0, "Should have no pending events after deliverPending");
    assert.equal(delivered, pendingBefore, "Delivered count should match pending count");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});
