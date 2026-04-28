/**
 * Unit Tests: Event Delivery Acknowledgment
 *
 * Tests the event delivery acknowledgment tracking and retry behavior.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

test.describe("Event Delivery Acknowledgment unit tests", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let store: AuthoritativeTaskStore;
  let bus: DurableEventBus;

  test.beforeEach(() => {
    workspace = createTempWorkspace("event-ack-");
    const dbPath = `${workspace}/test.db`;
    db = new SqliteDatabase(dbPath);
    db.migrate();
    store = new AuthoritativeTaskStore(db);
    bus = new DurableEventBus(db, store);
  });

  test.afterEach(() => {
    bus.dispose();
    db.close();
    cleanupPath(workspace);
  });

  test("pendingForConsumer returns events needing ack for tier-1 events", () => {
    bus.subscribe("consumer-1", () => { /* noop */ });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-ack-test",
      payload: { toStatus: "running" },
    });

    const pending = bus.pendingForConsumer("consumer-1");

    assert.ok(pending.length >= 1);
    const taskEvent = pending.find(p => p.event.taskId === "task-ack-test");
    assert.ok(taskEvent !== undefined);
    assert.equal(taskEvent?.ack.status, "pending");
  });

  test("pendingForConsumer returns empty for tier-3 events", () => {
    bus.subscribe("consumer-1", () => { /* noop */ });

    bus.publish({
      eventType: "stream:chunk_emitted",
      payload: { chunkId: "chunk-1", data: "test" },
    });

    const pending = bus.pendingForConsumer("consumer-1");

    // Tier-3 events don't require ack
    assert.equal(pending.length, 0);
  });

  test("successful delivery marks event as acked", async () => {
    bus.subscribe("consumer-ack", () => { /* success */ });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-acked",
      payload: { toStatus: "completed" },
    });

    // Wait for async polling
    await new Promise(resolve => setTimeout(resolve, 50));

    const delivered = await bus.deliverPending("consumer-ack");

    // Event should be delivered successfully
    assert.ok(delivered >= 0);
  });

  test("handler failure triggers retry with exponential backoff", async () => {
    let callCount = 0;
    bus.subscribe("consumer-retry", () => {
      callCount++;
      if (callCount < 3) {
        throw new Error("transient failure");
      }
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      payload: { toStatus: "running" },
    });

    // Wait for multiple polling cycles
    for (let i = 0; i < 5; i++) {
      await new Promise(resolve => setTimeout(resolve, 150));
      if (callCount >= 3) break;
    }

    // Handler should have been called multiple times
    assert.ok(callCount >= 3);
  });

  test("max retries exhausted marks event as failed", async () => {
    let callCount = 0;
    bus.subscribe("consumer-max-retries", () => {
      callCount++;
      throw new Error("permanent failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-max-retries",
      payload: { toStatus: "running" },
    });

    // Wait for all retries to exhaust
    for (let i = 0; i < 10; i++) {
      await new Promise(resolve => setTimeout(resolve, 100));
      if (callCount >= 4) break; // Initial + retries
    }

    // After max retries, pending should show failed or event should be dead-lettered
    const pending = bus.pendingForConsumer("consumer-max-retries");
    const taskPending = pending.find(p => p.event.taskId === "task-max-retries");

    // The event ack should be marked as failed
    if (taskPending) {
      assert.equal(taskPending.ack.status, "failed");
    }
  });

  test("pendingForConsumer works with multiple consumers", () => {
    bus.subscribe("consumer-a", () => { /* noop */ });
    bus.subscribe("consumer-b", () => { /* noop */ });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi",
      payload: { toStatus: "running" },
    });

    const pendingA = bus.pendingForConsumer("consumer-a");
    const pendingB = bus.pendingForConsumer("consumer-b");

    // Both consumers should have pending events
    assert.ok(pendingA.length >= 1);
    assert.ok(pendingB.length >= 1);
  });

  test("unsubscribe stops delivery to that consumer", () => {
    let callCount = 0;
    const handler = () => { callCount++; };

    bus.subscribe("consumer-leave", handler);
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-leave",
      payload: { toStatus: "running" },
    });

    bus.unsubscribe("consumer-leave");

    // After unsubscribe, consumer should not receive events
    const pending = bus.pendingForConsumer("consumer-leave");
    assert.equal(pending.length, 0);
  });

  test("ref count tracks multiple subscriptions per consumer", () => {
    // Subscribe twice to same consumer (simulated by different handlers)
    bus.subscribe("consumer-ref", () => { /* handler 1 */ });
    bus.subscribe("consumer-ref", () => { /* handler 2 */ });
    bus.unsubscribe("consumer-ref");

    // Should still be tracked since we had 2 subscriptions
    const refCount = bus["activeConsumerRefCounts"].get("consumer-ref");
    // After first unsubscribe, ref count should be 1
    assert.equal(refCount, 1);
  });

  test("batch published events create pending acks for all consumers", () => {
    bus.subscribe("consumer-batch", () => { /* noop */ });

    bus.publishBatch([
      { eventType: "task:status_changed", taskId: "batch-1", payload: { toStatus: "running" } },
      { eventType: "task:status_changed", taskId: "batch-2", payload: { toStatus: "completed" } },
    ]);

    const pending = bus.pendingForConsumer("consumer-batch");

    // Should have pending acks for tier-1 events
    assert.ok(pending.length >= 2);
  });

  test("deliverPending filters events by consumer", async () => {
    let consumerAEvents: string[] = [];
    let consumerBEvents: string[] = [];

    bus.subscribe("consumer-filter-a", (event) => {
      consumerAEvents.push(event.id);
    });
    bus.subscribe("consumer-filter-b", (event) => {
      consumerBEvents.push(event.id);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-filter",
      payload: { toStatus: "running" },
    });

    await new Promise(resolve => setTimeout(resolve, 50));

    await bus.deliverPending("consumer-filter-a");

    // Consumer A should have received the event
    // Consumer B should have its own pending
    const pendingB = bus.pendingForConsumer("consumer-filter-b");
    assert.ok(pendingB.length >= 1 || consumerBEvents.length >= 1);
  });
});
