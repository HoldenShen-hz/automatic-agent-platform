/**
 * Integration Tests: DurableEventBus publish/deliver
 *
 * Tests the durable event bus with real SQLite database.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test.describe("DurableEventBus integration tests", () => {
  let ctx: ReturnType<typeof createIntegrationContext>;
  let bus: DurableEventBus;

  test.beforeEach(() => {
    ctx = createIntegrationContext("event-bus-");
    bus = new DurableEventBus(ctx.db, ctx.store);
  });

  test.afterEach(() => {
    bus.dispose();
    ctx.cleanup();
  });

  test("publish stores event in database", () => {
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-1",
      payload: { fromStatus: "pending", toStatus: "running" },
    });

    // Verify event is persisted in store
    const stored = ctx.store.event.getEvent(event.id);
    assert.ok(stored !== null);
    assert.equal(stored.id, event.id);
    assert.equal(stored.eventType, "task:status_changed");
  });

  test("publish creates ack records for required consumers", () => {
    bus.subscribe("consumer-1", () => { /* noop */ });
    bus.subscribe("consumer-2", () => { /* noop */ });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-ack",
      payload: { toStatus: "running" },
    });

    // Verify ack records created for tier-1 event
    const pending = bus.pendingForConsumer("consumer-1");
    const pending2 = bus.pendingForConsumer("consumer-2");

    assert.ok(pending.some(p => p.event.id === event.id));
    assert.ok(pending2.some(p => p.event.id === event.id));
  });

  test("publish with tier-2 event does not create ack records", () => {
    bus.subscribe("consumer-tier2", () => { /* noop */ });

    bus.publish({
      eventType: "dispatch:ticket_created",
      payload: { ticketId: "ticket-1" },
    });

    const pending = bus.pendingForConsumer("consumer-tier2");
    assert.equal(pending.length, 0);
  });

  test("deliverPending delivers events to handler", async () => {
    let deliveredEventId: string | null = null;
    bus.subscribe("consumer-deliver", (event) => {
      deliveredEventId = event.id;
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-deliver",
      payload: { toStatus: "running" },
    });

    // Wait for async dispatch
    await new Promise(resolve => setTimeout(resolve, 50));

    const delivered = await bus.deliverPending("consumer-deliver");

    assert.ok(delivered >= 1);
    assert.ok(deliveredEventId !== null);
  });

  test("ack is called on successful delivery", async () => {
    bus.subscribe("consumer-ack", () => { /* success */ });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-sync-ack",
      payload: { toStatus: "completed" },
    });

    // Wait for dispatch
    await new Promise(resolve => setTimeout(resolve, 50));

    await bus.deliverPending("consumer-ack");

    // Verify event is no longer pending (acked)
    const pending = bus.pendingForConsumer("consumer-ack");
    const ackedEvent = pending.find(p => p.event.taskId === "task-sync-ack");
    // After successful delivery, event should be acked
    assert.ok(ackedEvent === undefined || ackedEvent.ack.status === "acked");
  });

  test("handler error triggers retry mechanism", async () => {
    let attempts = 0;
    bus.subscribe("consumer-retry", () => {
      attempts++;
      if (attempts < 3) {
        throw new Error("retry error");
      }
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      payload: { toStatus: "running" },
    });

    // Trigger delivery multiple times
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 200));
      await bus.deliverPending("consumer-retry");
      if (attempts >= 3) break;
    }

    assert.ok(attempts >= 3);
  });

  test("max delivery attempts results in dead-letter", async () => {
    let attempts = 0;
    const maxRetries = 3;
    bus.subscribe("consumer-dl", () => {
      attempts++;
      throw new Error("permanent failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dl",
      payload: { toStatus: "running" },
    });

    // Wait for retry exhaustion
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      try {
        await bus.deliverPending("consumer-dl");
      } catch {
        // Expected to throw after max retries
        break;
      }
      if (attempts > maxRetries) break;
    }

    // Verify ack status is failed after max retries
    const pending = bus.pendingForConsumer("consumer-dl");
    const dlEvent = pending.find(p => p.event.taskId === "task-dl");
    assert.ok(dlEvent !== undefined);
    assert.equal(dlEvent.ack.status, "failed");
  });

  test("multiple consumers receive independent ack tracking", () => {
    bus.subscribe("consumer-x", () => { /* noop */ });
    bus.subscribe("consumer-y", () => { /* noop */ });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi",
      payload: { toStatus: "running" },
    });

    const pendingX = bus.pendingForConsumer("consumer-x");
    const pendingY = bus.pendingForConsumer("consumer-y");

    // Each consumer should have its own pending ack record
    const eventX = pendingX.find(p => p.event.id === event.id);
    const eventY = pendingY.find(p => p.event.id === event.id);

    assert.ok(eventX !== undefined);
    assert.ok(eventY !== undefined);
    assert.notEqual(eventX.ack.status, eventY.ack.status); // Independent
  });

  test("batch publish creates multiple events", () => {
    const events = bus.publishBatch([
      { eventType: "task:status_changed", taskId: "batch-1", payload: { toStatus: "running" } },
      { eventType: "task:status_changed", taskId: "batch-2", payload: { toStatus: "completed" } },
      { eventType: "task:status_changed", taskId: "batch-3", payload: { toStatus: "failed" } },
    ]);

    assert.equal(events.length, 3);

    // Verify all events persisted
    for (const evt of events) {
      const stored = ctx.store.event.getEvent(evt.id);
      assert.ok(stored !== null);
    }
  });

  test("disposed bus rejects further operations", () => {
    bus.dispose();

    assert.throws(
      () => bus.publish({
        eventType: "task:status_changed",
        payload: { toStatus: "running" },
      }),
      /disposed/,
    );

    assert.throws(
      () => bus.subscribe("consumer", () => { /* noop */ }),
      /disposed/,
    );
  });
});
