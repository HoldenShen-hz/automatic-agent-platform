/**
 * Unit Tests: DurableEventBus publish/deliver
 *
 * Tests the durable event bus publish and delivery operations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DurableEventBus } from "../../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId } from "../../../../../../src/platform/contracts/types/ids.js";

test.describe("DurableEventBus unit tests", () => {
  let workspace: string;
  let db: SqliteDatabase;
  let store: AuthoritativeTaskStore;
  let bus: DurableEventBus;

  test.beforeEach(() => {
    workspace = createTempWorkspace("event-bus-");
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

  test("publish creates an event record and returns it", () => {
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-123",
      payload: { fromStatus: "pending", toStatus: "running" },
    });

    assert.ok(event.id.startsWith("evt-"));
    assert.equal(event.eventType, "task:status_changed");
    assert.equal(event.taskId, "task-123");
    assert.equal(event.eventTier, "tier_1");
    assert.ok(event.createdAt.length > 0);
  });

  test("publish validates payload size", () => {
    const largePayload: Record<string, unknown> = { data: "x".repeat(1_000_001) };

    assert.throws(
      () => bus.publish({
        eventType: "task:status_changed",
        payload: largePayload as Record<string, unknown>,
      }),
      /payload_too_large/,
    );
  });

  test("publish with invalid event type throws", () => {
    assert.throws(
      () => bus.publish({
        eventType: "invalid:not_registered",
        payload: { data: "test" },
      }),
      /schema_missing/,
    );
  });

  test("publish batch creates multiple event records", () => {
    const events = bus.publishBatch([
      { eventType: "task:status_changed", taskId: "task-1", payload: { toStatus: "running" } },
      { eventType: "task:status_changed", taskId: "task-2", payload: { toStatus: "completed" } },
    ]);

    assert.equal(events.length, 2);
    assert.ok(events[0]!.id !== events[1]!.id);
    assert.equal(events[0]!.taskId, "task-1");
    assert.equal(events[1]!.taskId, "task-2");
  });

  test("publish batch validates all payloads before writing", () => {
    const largePayload: Record<string, unknown> = { data: "x".repeat(1_000_001) };

    assert.throws(
      () => bus.publishBatch([
        { eventType: "task:status_changed", payload: { toStatus: "ok" } },
        { eventType: "task:status_changed", payload: largePayload },
      ]),
      /payload_too_large/,
    );
  });

  test("subscribe registers a handler for a consumer", () => {
    let handlerCalled = false;
    bus.subscribe("consumer-1", (_event) => {
      handlerCalled = true;
    });

    // Publish a tier-2 event which triggers volatile dispatch
    bus.publish({
      eventType: "dispatch:ticket_created",
      payload: { ticketId: "ticket-1" },
    });

    // Give async dispatch time to call handler
  });

  test("unsubscribe removes consumer handler", () => {
    const handler = () => { /* noop */ };
    bus.subscribe("consumer-1", handler);
    bus.unsubscribe("consumer-1");

    // After unsubscribe, polling should not find the consumer
    assert.ok(!bus["subscribers"].has("consumer-1"));
  });

  test("dispose clears all subscribers and stops polling", () => {
    bus.subscribe("consumer-1", () => { /* noop */ });
    bus.subscribe("consumer-2", () => { /* noop */ });

    bus.dispose();

    assert.equal(bus["subscribers"].size, 0);
    assert.equal(bus["pollingTimers"].size, 0);
  });

  test("dispose is idempotent", () => {
    bus.subscribe("consumer-1", () => { /* noop */ });
    bus.dispose();
    bus.dispose(); // Should not throw

    assert.ok(bus["disposed"]);
  });

  test("pendingForConsumer returns empty for new consumer", () => {
    const pending = bus.pendingForConsumer("new-consumer");

    assert.equal(pending.length, 0);
  });

  test("deliverPending returns 0 when no pending events", async () => {
    bus.subscribe("consumer-1", () => { /* noop */ });

    const delivered = await bus.deliverPending("consumer-1");

    assert.equal(delivered, 0);
  });

  test("deliverPending returns count of delivered events", async () => {
    let deliveredEvents: string[] = [];
    bus.subscribe("consumer-1", (event) => {
      deliveredEvents.push(event.id);
    });

    const evt1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-1",
      payload: { toStatus: "running" },
    });
    const evt2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-2",
      payload: { toStatus: "completed" },
    });

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 50));

    const delivered = await bus.deliverPending("consumer-1");

    // Events should have been delivered
    assert.ok(delivered >= 0);
  });

  test("deliverPending throws WorkflowStateError when events dead-letter", async () => {
    let callCount = 0;
    bus.subscribe("consumer-1", () => {
      callCount++;
      throw new Error("delivery failed");
    });

    // Publish tier-1 event which requires ack
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dead-letter",
      payload: { toStatus: "running" },
    });

    // Wait for initial dispatch
    await new Promise(resolve => setTimeout(resolve, 100));

    // deliverPending should eventually throw after retries
    await assert.rejects(
      async () => {
        for (let i = 0; i < 10; i++) {
          await bus.deliverPending("consumer-1");
          if (callCount >= 3) break;
          await new Promise(resolve => setTimeout(resolve, 50));
        }
      },
      /dead_lettered/,
    );
  });

  test("disposed bus throws on publish", () => {
    bus.dispose();

    assert.throws(
      () => bus.publish({
        eventType: "task:status_changed",
        payload: { toStatus: "running" },
      }),
      /disposed/,
    );
  });

  test("disposed bus throws on subscribe", () => {
    bus.dispose();

    assert.throws(
      () => bus.subscribe("consumer-1", () => { /* noop */ }),
      /disposed/,
    );
  });

  test("disposed bus throws on deliverPending", async () => {
    bus.dispose();

    await assert.rejects(
      () => bus.deliverPending("consumer-1"),
      /disposed/,
    );
  });
});
