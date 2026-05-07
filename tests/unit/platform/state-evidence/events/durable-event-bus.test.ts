import test from "node:test";
import assert from "node:assert/strict";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { DlqService, InMemoryDlqRepository } from "../../../../../src/platform/state-evidence/events/dlq-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { initHaCoordinatorForTests } from "../../../../helpers/ha-coordinator.js";

test("durable event bus publishes tier1 event and acks after delivery", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const seen: string[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-1",
      executionId: "exec-1",
      traceId: "trace-1",
      traceContext: {
        traceId: "trace-1",
        spanId: "span-1",
        parentSpanId: "span-root",
        correlationId: "task-1",
      },
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    const pendingBefore = bus.pendingForConsumer("inspect_projection");
    assert.equal(pendingBefore.length, 1);

    await bus.deliverPending("inspect_projection");

    const pendingAfter = bus.pendingForConsumer("inspect_projection");
    const event = store.listEventsForTask("task-1").events[0];
    const payload = event ? (JSON.parse(event.payloadJson) as Record<string, unknown>) : null;
    const traceContext = payload?.traceContext as Record<string, unknown> | undefined;
    assert.equal(seen.length, 1);
    assert.equal(pendingAfter.length, 0);
    assert.equal(traceContext?.spanId, "span-1");
    assert.equal(traceContext?.correlationId, "task-1");

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus publish auto-fans out to active subscribers", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    const seen: string[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-fanout", executionId: "exec-fanout", traceId: "trace-fanout" });

    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.id);
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-fanout",
      executionId: "exec-fanout",
      traceId: "trace-fanout",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.deepEqual(seen, [event.id]);
    assert.equal(bus.pendingForConsumer("inspect_projection").length, 0);

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus does not schedule tier2 fan-out after volatile dispatch", () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-tier2", executionId: "exec-tier2", traceId: "trace-tier2" });

    let scheduleFanOutCalls = 0;
    (bus as unknown as { scheduleFanOut: () => void }).scheduleFanOut = () => {
      scheduleFanOutCalls += 1;
    };

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-tier2",
      executionId: "exec-tier2",
      traceId: "trace-tier2",
      payload: {
        taskId: "task-tier2",
        ticketId: "ticket-tier2",
        status: "created",
      },
    });

    assert.equal(scheduleFanOutCalls, 0);
    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus dead-letters volatile tier2 delivery failures", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const dlqService = new DlqService(new InMemoryDlqRepository());
    const bus = new DurableEventBus(db, store, dlqService);
    seedTaskAndExecution(db, store, { taskId: "task-volatile-dlq", executionId: "exec-volatile-dlq", traceId: "trace-volatile-dlq" });

    bus.subscribe("inspect_projection", async () => {
      throw new Error("volatile subscriber exploded");
    });

    const event = bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-volatile-dlq",
      executionId: "exec-volatile-dlq",
      traceId: "trace-volatile-dlq",
      payload: {
        taskId: "task-volatile-dlq",
        ticketId: "ticket-volatile-dlq",
        status: "created",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const deadLetters = dlqService.listAll();
    assert.equal(deadLetters.length, 1);
    assert.equal(deadLetters[0]?.sourceEventId, event.id);
    assert.equal(deadLetters[0]?.consumerId, "inspect_projection");
    assert.equal(deadLetters[0]?.errorCode, "volatile_delivery_failed");

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus continues delivering later pending events after an earlier one dead-letters", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry", executionId: "exec-retry", traceId: "trace-retry" });
    const delivered: string[] = [];

    bus.subscribe("inspect_projection", async (event) => {
      if (event.payloadJson.includes("\"sequence\":1")) {
        throw new Error("projection unavailable");
      }
      delivered.push(event.id);
    });

    const first = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        sequence: 1,
      },
    });
    const second = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        sequence: 2,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 450));

    assert.deepEqual(delivered, [second.id]);
    const remaining = bus.pendingForConsumer("inspect_projection");
    assert.equal(remaining.length, 0);
    const firstAck = store.event.getEventConsumerAck(first.id, "inspect_projection");
    assert.equal(firstAck?.status, "dead_lettered");

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus dispose clears subscribers and rejects new operations", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dispose", executionId: "exec-dispose", traceId: "trace-dispose" });

    bus.subscribe("inspect_projection", async () => undefined);
    assert.equal(bus.pendingForConsumer("inspect_projection").length, 0);

    bus.dispose();

    assert.throws(() => bus.pendingForConsumer("inspect_projection"), /event_bus\.disposed/);
    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-dispose",
          executionId: "exec-dispose",
          traceId: "trace-dispose",
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        }),
      /event_bus\.disposed/,
    );
    await assert.rejects(() => bus.deliverPending("inspect_projection"), /event_bus\.disposed/);
  } finally {
    cleanup();
  }
});

test("durable event bus delivery retries MAX_DELIVERY_RETRIES times before dead-lettering", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-retry-exhaust", executionId: "exec-retry-exhaust", traceId: "trace-retry-exhaust" });
    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("handler always fails");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry-exhaust",
      executionId: "exec-retry-exhaust",
      traceId: "trace-retry-exhaust",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
        sequence: 1,
      },
    });

    // deliverPending uses swallowErrors=false, so errors propagate.
    // The handler should be called exactly MAX_DELIVERY_RETRIES times and
    // then the ack moves to dead_lettered instead of staying pending.
    await new Promise((resolve) => setTimeout(resolve, 450));

    assert.equal(attemptCount, 3);

    // After dead-lettering, the event should no longer be pending and the ack
    // should be persisted in terminal dead_lettered state.
    const remaining = bus.pendingForConsumer("inspect_projection");
    assert.equal(remaining.length, 0);

    const persistedEvent = store.listEventsForTask("task-retry-exhaust").events[0];
    const ack = persistedEvent
      ? store.event.getEventConsumerAck(persistedEvent.id, "inspect_projection")
      : undefined;
    assert.equal(ack?.status, "dead_lettered");
    assert.ok(ack?.errorCode?.includes("failed_after_3_retries"), `Expected error code with retry info, got: ${ack?.errorCode}`);

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus invalid payload rejects at publish time", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-invalid", executionId: "exec-invalid", traceId: "trace-invalid" });

    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-invalid",
          executionId: "exec-invalid",
          traceId: "trace-invalid",
          payload: { sequence: 1 },
        }),
      (error: unknown) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "event.payload_invalid",
    );
  } finally {
    cleanup();
  }
});

test("durable event bus rejects payload larger than 1MB", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-large", executionId: "exec-large", traceId: "trace-large" });

    // Create a payload that exceeds 1MB (1,000,000 bytes)
    // Must include valid task:status_changed fields for validation to pass before size check
    const largePayload = {
      fromStatus: "queued",
      toStatus: "in_progress",
      reasonCode: "scheduler.dispatch",
      extraData: "x".repeat(1_100_000),
    };

    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-large",
          executionId: "exec-large",
          traceId: "trace-large",
          payload: largePayload,
        }),
      (error: unknown) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "event.payload_too_large",
    );
  } finally {
    cleanup();
  }
});

test("durable event bus volatile subscriber error does not propagate", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-volatile", executionId: "exec-volatile", traceId: "trace-volatile" });

    bus.subscribe("volatile_consumer", async (_event) => {
      throw new Error("volatile handler always fails");
    });

    // Publishing stream:chunk_emitted (tier_3) triggers dispatchVolatile
    // The error should be caught and logged, not propagated
    const event = bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-volatile",
      executionId: "exec-volatile",
      traceId: "trace-volatile",
      payload: {
        sequence: 1,
        chunk: "test chunk data",
      },
    });

    // Give async handler time to execute
    await new Promise((resolve) => setTimeout(resolve, 50));

    // The publish should succeed (error doesn't propagate)
    assert.equal(event.eventType, "stream:chunk_emitted");

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus unsubscribe removes subscriber", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-unsub", executionId: "exec-unsub", traceId: "trace-unsub" });

    const seen: string[] = [];
    // Use inspect_projection - a required consumer for task:status_changed
    // Non-required consumers don't get auto-created pending acks, so delivery won't work
    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
      },
    });

    // Check pending after publish
    const pendingAfter = bus.pendingForConsumer("inspect_projection");
    assert.equal(pendingAfter.length, 1, "Should have 1 pending event after publish");

    // Wait for async fan-out delivery to complete
    await new Promise((resolve) => setTimeout(resolve, 150));

    assert.equal(seen.length, 1);

    // Unsubscribe
    bus.unsubscribe("inspect_projection");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      traceId: "trace-unsub",
      payload: {
        fromStatus: "in_progress",
        toStatus: "done",
        reasonCode: "complete",
      },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 30));

    // Should still only have 1 event since we unsubscribed
    assert.equal(seen.length, 1);
  } finally {
    cleanup();
  }
});

test("durable event bus dispose clears subscribers", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-dispose2", executionId: "exec-dispose2", traceId: "trace-dispose2" });

    const seen: string[] = [];
    bus.subscribe("dispose_consumer", async (event) => {
      seen.push(event.eventType);
    });

    bus.dispose();

    // After dispose, publish should throw synchronously
    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-dispose2",
          executionId: "exec-dispose2",
          traceId: "trace-dispose2",
          payload: {
            fromStatus: "queued",
            toStatus: "in_progress",
            reasonCode: "scheduler.dispatch",
          },
        }),
      /event_bus\.disposed/,
    );

    // Should not have received any events since bus is disposed
    assert.equal(seen.length, 0);
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch inserts multiple events in transaction", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch", executionId: "exec-batch", traceId: "trace-batch" });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "queued", toStatus: "in_progress", sequence: 1 },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "in_progress", toStatus: "completed", sequence: 2 },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        traceId: "trace-batch",
        payload: { fromStatus: "completed", toStatus: "done", sequence: 3 },
      },
    ]);

    assert.equal(events.length, 3);
    assert.notEqual(events[0]!.id, events[1]!.id);
    assert.notEqual(events[1]!.id, events[2]!.id);

    const allEvents = store.listEventsForTask("task-batch").events;
    assert.equal(allEvents.length, 3);
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch validates all payloads before inserting", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-validate", executionId: "exec-batch-validate", traceId: "trace-batch-validate" });

    // Second event has invalid payload (missing required fromStatus/toStatus)
    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-validate",
            executionId: "exec-batch-validate",
            traceId: "trace-batch-validate",
            payload: { fromStatus: "queued", toStatus: "in_progress" },
          },
          {
            eventType: "task:status_changed",
            taskId: "task-batch-validate",
            executionId: "exec-batch-validate",
            traceId: "trace-batch-validate",
            payload: { invalid: "payload" },
          },
        ]),
      /Invalid payload for event type/,
    );
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch rejects oversized payload", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-size", executionId: "exec-batch-size", traceId: "trace-batch-size" });

    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-size",
            executionId: "exec-batch-size",
            traceId: "trace-batch-size",
            payload: {
              fromStatus: "queued",
              toStatus: "in_progress",
              largeData: "x".repeat(1_100_000),
            },
          },
        ]),
      (error: unknown) =>
        typeof error === "object"
        && error !== null
        && "code" in error
        && error.code === "event.payload_too_large",
    );
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch fanning out to subscribers", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-fanout", executionId: "exec-batch-fanout", traceId: "trace-batch-fanout" });

    const seen: string[] = [];
    bus.subscribe("inspect_projection", async (event) => {
      seen.push(event.id);
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-fanout",
        executionId: "exec-batch-fanout",
        traceId: "trace-batch-fanout",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch-fanout",
        executionId: "exec-batch-fanout",
        traceId: "trace-batch-fanout",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      },
    ]);

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 30));

    assert.equal(seen.length, 2);
    assert.ok(seen.includes(events[0]!.id));
    assert.ok(seen.includes(events[1]!.id));

    bus.dispose();
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch creates ack records for tier1 events", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-ack", executionId: "exec-batch-ack", traceId: "trace-batch-ack" });

    bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-ack",
        executionId: "exec-batch-ack",
        traceId: "trace-batch-ack",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
    ]);

    const pending = bus.pendingForConsumer("inspect_projection");
    assert.equal(pending.length, 1);
  } finally {
    cleanup();
  }
});

test("durable event bus publishBatch dispose rejects new batch publish", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-batch-dispose", executionId: "exec-batch-dispose", traceId: "trace-batch-dispose" });

    bus.dispose();

    assert.throws(
      () =>
        bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: "task-batch-dispose",
            executionId: "exec-batch-dispose",
            traceId: "trace-batch-dispose",
            payload: { fromStatus: "queued", toStatus: "in_progress" },
          },
        ]),
      /event_bus\.disposed/,
    );
  } finally {
    cleanup();
  }
});

test("durable event bus multiple subscribers each receive events", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-multi-sub", executionId: "exec-multi-sub", traceId: "trace-multi-sub" });

    const seen1: string[] = [];
    const seen2: string[] = [];
    // Subscribe two different consumers - each gets their own handler
    // task:status_changed has registered consumers: ["task_projection", "inspect_projection"]
    bus.subscribe("task_projection", async (event) => {
      seen1.push(event.eventType);
    });
    bus.subscribe("inspect_projection", async (event) => {
      seen2.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-sub",
      executionId: "exec-multi-sub",
      traceId: "trace-multi-sub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // tier_1 events require deliverPending to be called for each consumer
    await bus.deliverPending("task_projection");
    await bus.deliverPending("inspect_projection");

    assert.equal(seen1.length, 1, "task_projection handler should be called once");
    assert.equal(seen2.length, 1, "inspect_projection handler should be called once");
  } finally {
    cleanup();
  }
});

test("durable event bus deliverPending returns count of delivered events", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-deliver-count", executionId: "exec-deliver-count", traceId: "trace-deliver-count" });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-deliver-count",
      executionId: "exec-deliver-count",
      traceId: "trace-deliver-count",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.subscribe("inspect_projection", async () => {});

    const delivered = await bus.deliverPending("inspect_projection");
    assert.equal(delivered, 1);
  } finally {
    cleanup();
  }
});

test("durable event bus pendingForConsumer returns empty for unknown consumer", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const pending = bus.pendingForConsumer("unknown_consumer");
    assert.equal(pending.length, 0);
  } finally {
    cleanup();
  }
});

test("durable event bus publish with traceContext injects trace fields into payload", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);
    seedTaskAndExecution(db, store, { taskId: "task-trace", executionId: "exec-trace", traceId: "trace-trace" });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-trace",
      executionId: "exec-trace",
      traceId: "trace-trace",
      traceContext: {
        traceId: "trace-trace",
        spanId: "span-abc",
        parentSpanId: "span-root",
        correlationId: "corr-123",
      },
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const events = store.listEventsForTask("task-trace").events;
    assert.equal(events.length, 1);
    const payload = JSON.parse(events[0]!.payloadJson) as Record<string, unknown>;
    assert.deepEqual(payload.traceContext, {
      traceId: "trace-trace",
      spanId: "span-abc",
      parentSpanId: "span-root",
      correlationId: "corr-123",
    });
  } finally {
    cleanup();
  }
});

test("durable event bus empty batch returns empty array", async () => {
  const { db, cleanup } = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const events = bus.publishBatch([]);
    assert.deepEqual(events, []);
  } finally {
    cleanup();
  }
});
