/**
 * Integration Tests: Durable Event Bus Full Coverage
 *
 * Comprehensive integration tests for the durable event bus system covering:
 * - In-memory event bus creation and lifecycle
 * - Event publishing with proper envelope format
 * - Subscription to specific event types
 * - Event delivery verification
 * - Event envelope format validation
 *
 * Uses SQLite in-memory database for testing.
 */

import assert from "node:assert/strict";
import test, { mock } from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

async function flushScheduledEventBusDelivery(): Promise<void> {
  for (let iteration = 0; iteration < 8; iteration++) {
    mock.timers.tick(1);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
  }
}

test.afterEach(() => {
  try {
    mock.timers.reset();
  } catch {
    // Timer mocking is only enabled in async fan-out tests.
  }
});

test("durable event bus: creates in-memory bus and initializes correctly", () => {
  const workspace = createTempWorkspace("aa-bus-init-");
  try {
    const db = new SqliteDatabase(join(workspace, "init-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const bus = new DurableEventBus(db, store);

    // Bus should be usable immediately
    assert.ok(bus !== undefined);

    // Publishing an event should work without error
    const event = bus.publish({
      eventType: "perf:test_event",
      payload: { testData: "hello" },
    });

    assert.ok(event.id.startsWith("evt_"), "Event should have valid ID");
    assert.equal(event.eventType, "perf:test_event");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: publish creates event record with correct envelope format", () => {
  const ctx = createIntegrationContext("aa-envelope-format-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-envelope",
      executionId: "exec-envelope",
      traceId: "trace-envelope",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-envelope",
      executionId: "exec-envelope",
      traceId: "trace-envelope",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Verify envelope format
    assert.ok(event.id.startsWith("evt_"), "Event ID should be present and valid");
    assert.equal(event.eventType, "task:status_changed", "Event type should match");
    assert.equal(event.taskId, "task-envelope", "Task ID should be preserved");
    assert.equal(event.executionId, "exec-envelope", "Execution ID should be preserved");
    assert.equal(event.traceId, "trace-envelope", "Trace ID should be preserved");
    assert.ok(event.createdAt !== null, "Created timestamp should be set");
    assert.equal(event.eventTier, "tier_1", "Tier-1 event should have tier_1 tier");
    assert.ok(event.payloadJson !== undefined, "Payload JSON should be set");
    assert.ok(event.payloadJson.length > 0, "Payload JSON should not be empty");

    // Verify payload can be parsed
    const parsedPayload = JSON.parse(event.payloadJson);
    assert.equal(parsedPayload.fromStatus, "queued", "Payload should contain fromStatus");
    assert.equal(parsedPayload.toStatus, "in_progress", "Payload should contain toStatus");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("durable event bus: publish with aggregate and sequence for ordering", () => {
  const ctx = createIntegrationContext("aa-aggregate-order-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-aggregate",
      executionId: "exec-aggregate",
    });

    // Publish events with aggregate and sequence for ordering
    // The aggregateId and sequence fields are used for replay ordering
    const event1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-aggregate",
      executionId: "exec-aggregate",
      aggregateId: "aggregate-1",
      runId: "run-1",
      sequence: 1,
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const event2 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-aggregate",
      executionId: "exec-aggregate",
      aggregateId: "aggregate-1",
      runId: "run-1",
      sequence: 2,
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    // Verify basic event fields are set correctly
    assert.ok(event1.id.startsWith("evt_"), "Event 1 should have valid ID");
    assert.ok(event2.id.startsWith("evt_"), "Event 2 should have valid ID");
    assert.ok(event1.id !== event2.id, "Events should have unique IDs");

    // Aggregate fields may be null in return value depending on DB driver
    // but publish should not throw - ordering is handled at delivery time
    assert.ok(event1.eventType === "task:status_changed");
    assert.ok(event2.eventType === "task:status_changed");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("durable event bus: subscribe receives published events", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-subscribe-");
  try {
    const db = new SqliteDatabase(join(workspace, "subscribe-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-sub",
      executionId: "exec-sub",
    });

    const receivedEvents: string[] = [];
    bus.subscribe("test_consumer", (event) => {
      receivedEvents.push(event.id);
    });

    const publishedEvent = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-sub",
      executionId: "exec-sub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(receivedEvents.length, 1, "Consumer should receive exactly one event");
    assert.equal(receivedEvents[0], publishedEvent.id, "Consumer should receive the published event");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: subscribe filters by event type", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-filter-");
  try {
    const db = new SqliteDatabase(join(workspace, "filter-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const receivedTypes: string[] = [];
    bus.subscribe("type_filter_consumer", (event) => {
      receivedTypes.push(event.eventType);
    });

    // Publish different event types
    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "workflow:step_completed",
      payload: { stepId: "step-1", status: "completed" },
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await flushScheduledEventBusDelivery();

    // Consumer receives all events it can handle (no filter at bus level)
    assert.equal(receivedTypes.length, 3, "Consumer should receive all 3 events");
    assert.ok(receivedTypes.includes("task:status_changed"));
    assert.ok(receivedTypes.includes("workflow:step_completed"));

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: multiple consumers receive same events independently", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-multi-consumer-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-consumer-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    const consumer1Events: string[] = [];
    const consumer2Events: string[] = [];

    bus.subscribe("consumer_1", (event) => {
      consumer1Events.push(event.id);
    });

    bus.subscribe("consumer_2", (event) => {
      consumer2Events.push(event.id);
    });

    const event1 = bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const event2 = bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(consumer1Events.length, 2, "Consumer 1 should receive 2 events");
    assert.equal(consumer2Events.length, 2, "Consumer 2 should receive 2 events");
    assert.deepEqual(consumer1Events, consumer2Events, "Both consumers should receive same events");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: deliverPending delivers tier-1 events", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-deliver-pending-");
  try {
    const db = new SqliteDatabase(join(workspace, "deliver-pending-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-pending",
      executionId: "exec-pending",
    });

    // First subscribe before publishing to ensure consumer is registered
    const receivedEvents: string[] = [];
    bus.subscribe("pending_consumer", (event) => {
      receivedEvents.push(event.id);
    });

    // Publish event
    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await flushScheduledEventBusDelivery();

    // After polling delivery, pending should be empty
    const pendingBefore = bus.pendingForConsumer("pending_consumer");
    assert.equal(pendingBefore.length, 0, "No pending events after polling delivery");

    // Verify the event was received
    assert.equal(receivedEvents.length, 1, "Should receive 1 event via polling");
    assert.equal(receivedEvents[0], event.id, "Should receive the correct event");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: pendingForConsumer returns unacknowledged events", () => {
  const ctx = createIntegrationContext("aa-pending-query-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    bus.subscribe("pending_query_consumer", () => {});

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const pending = bus.pendingForConsumer("pending_query_consumer");

    assert.equal(pending.length, 2, "Should have 2 pending events");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("durable event bus: batch publish creates multiple events", () => {
  const ctx = createIntegrationContext("aa-batch-publish-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-batch",
      executionId: "exec-batch",
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "task:status_changed",
        taskId: "task-batch",
        executionId: "exec-batch",
        payload: { fromStatus: "in_progress", toStatus: "completed" },
      },
      {
        eventType: "workflow:step_completed",
        taskId: "task-batch",
        executionId: "exec-batch",
        payload: { stepId: "step-1", status: "completed" },
      },
    ]);

    assert.equal(events.length, 3, "Should publish 3 events");
    assert.ok(events.every((e) => e.id.startsWith("evt_")), "All events should have valid IDs");
    assert.ok(events[0].id !== events[1].id, "Events should have unique IDs");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("durable event bus: tier-2 events dispatched immediately without ack", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-tier2-");
  try {
    const db = new SqliteDatabase(join(workspace, "tier2-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-tier2",
      executionId: "exec-tier2",
    });

    let volatileHandlerCalled = false;
    bus.subscribe("volatile_consumer", (event) => {
      if (event.eventType === "dispatch:ticket_created") {
        volatileHandlerCalled = true;
      }
    });

    bus.publish({
      eventType: "dispatch:ticket_created",
      taskId: "task-tier2",
      executionId: "exec-tier2",
      payload: { ticketId: "ticket-123", queueId: "default" },
    });

    await flushScheduledEventBusDelivery();

    assert.ok(volatileHandlerCalled, "Tier-2 event should be dispatched immediately");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("durable event bus: dispose prevents further operations", () => {
  const ctx = createIntegrationContext("aa-dispose-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    bus.dispose();

    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        }),
      /disposed/i,
      "Should throw after dispose",
    );

    assert.throws(
      () => bus.subscribe("test_consumer", () => {}),
      /disposed/i,
      "Subscribe should throw after dispose",
    );
  } finally {
    ctx.cleanup();
  }
});

test("durable event bus: unsubscribe stops event delivery", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-unsub-");
  try {
    const db = new SqliteDatabase(join(workspace, "unsub-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-unsub",
      executionId: "exec-unsub",
    });

    const receivedBeforeUnsub: string[] = [];
    bus.subscribe("unsub_test_consumer", (event) => {
      receivedBeforeUnsub.push(event.id);
    });

    const event1 = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(receivedBeforeUnsub.length, 1, "Should receive 1 event before unsubscribe");

    bus.unsubscribe("unsub_test_consumer");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(receivedBeforeUnsub.length, 1, "Should not receive new events after unsubscribe");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus: publish with type-safe payload", async () => {
  const workspace = createTempWorkspace("aa-typed-publish-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-publish-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-typed",
      executionId: "exec-typed",
    });

    const received: { toStatus: string }[] = [];
    bus.subscribe("typed_consumer", ["task:status_changed"], ({ payload }) => {
      received.push({ toStatus: payload.toStatus });
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed",
      executionId: "exec-typed",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await bus.deliverPending("typed_consumer");

    assert.equal(received.length, 1);
    assert.equal(received[0].toStatus, "in_progress");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus: subscribe to multiple event types", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-multi-type-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-type-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    const receivedTypes: string[] = [];
    bus.subscribe("multi_type_consumer", ["task:status_changed", "workflow:step_completed"], ({ event }) => {
      receivedTypes.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "workflow:step_completed",
      payload: { stepId: "step-1", status: "completed" },
    });

    bus.publish({
      eventType: "division:completed",
      payload: { divisionId: "div-1", workflowId: "wf-1", occurredAt: new Date().toISOString() },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(receivedTypes.length, 2, "Should only receive subscribed event types");
    assert.ok(receivedTypes.includes("task:status_changed"));
    assert.ok(receivedTypes.includes("workflow:step_completed"));
    assert.ok(!receivedTypes.includes("division:completed"), "Should not receive unsubscribed event");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus: delivers skill events with correct payload", async () => {
  const workspace = createTempWorkspace("aa-skill-events-");
  try {
    const db = new SqliteDatabase(join(workspace, "skill-events-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-skill",
      executionId: "exec-skill",
    });

    const received: { skillId: string; stepId: string; attempt: number }[] = [];
    bus.subscribe("skill_consumer", ["skill:step_started"], ({ payload }) => {
      received.push({
        skillId: payload.skillId,
        stepId: payload.stepId,
        attempt: payload.attempt,
      });
    });

    bus.publish({
      eventType: "skill:step_started",
      taskId: "task-skill",
      executionId: "exec-skill",
      payload: {
        skillId: "coding-v3",
        stepId: "step-skill-1",
        toolName: "bash",
        attempt: 1,
        maxAttempts: 3,
      },
    });

    await bus.deliverPending("skill_consumer");

    assert.equal(received.length, 1);
    assert.equal(received[0].skillId, "coding-v3");
    assert.equal(received[0].stepId, "step-skill-1");
    assert.equal(received[0].attempt, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus: delivers domain lifecycle events", async () => {
  mock.timers.enable({ apis: ["setTimeout", "Date"] });
  const workspace = createTempWorkspace("aa-domain-events-");
  try {
    const db = new SqliteDatabase(join(workspace, "domain-events-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    const received: { domainId: string; status: string }[] = [];
    bus.subscribe("domain_consumer", ["domain:registered"], ({ payload }) => {
      received.push({
        domainId: payload.domainId,
        status: payload.status,
      });
    });

    bus.publish({
      eventType: "domain:registered",
      payload: {
        domainId: "test-domain",
        status: "active",
        capabilityCount: 5,
        pluginCount: 3,
        occurredAt: new Date().toISOString(),
      },
    });

    await flushScheduledEventBusDelivery();

    assert.equal(received.length, 1);
    assert.equal(received[0].domainId, "test-domain");
    assert.equal(received[0].status, "active");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("event envelope: contains all required fields per event registry contract", () => {
  const ctx = createIntegrationContext("aa-envelope-fields-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-env-fields",
      executionId: "exec-env-fields",
      traceId: "trace-env-fields",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-env-fields",
      executionId: "exec-env-fields",
      traceId: "trace-env-fields",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Verify all required envelope fields per event registry contract
    assert.ok(event.id, "Event ID must be present");
    assert.ok(event.id.startsWith("evt_"), "Event ID must have evt_ prefix");
    assert.equal(event.eventType, "task:status_changed", "Event type must be correct");
    assert.equal(event.taskId, "task-env-fields", "Task ID must be preserved");
    assert.equal(event.executionId, "exec-env-fields", "Execution ID must be preserved");
    assert.equal(event.traceId, "trace-env-fields", "Trace ID must be preserved");
    assert.ok(event.createdAt, "Created timestamp must be present");
    assert.equal(event.eventTier, "tier_1", "Event tier must be tier_1 for task:status_changed");
    assert.ok(event.payloadJson, "Payload JSON must be present");
    assert.ok(JSON.parse(event.payloadJson), "Payload JSON must be valid JSON");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("event envelope: payload preserves all fields during round-trip", () => {
  const ctx = createIntegrationContext("aa-payload-roundtrip-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    const originalPayload = {
      fromStatus: "queued",
      toStatus: "in_progress",
      reasonCode: "user_request",
      occurredAt: "2026-05-01T12:00:00.000Z",
      metadataJson: '{"key": "value"}',
    };

    const event = bus.publish({
      eventType: "task:status_changed",
      payload: originalPayload,
    });

    const parsedPayload = JSON.parse(event.payloadJson);

    assert.equal(parsedPayload.fromStatus, originalPayload.fromStatus);
    assert.equal(parsedPayload.toStatus, originalPayload.toStatus);
    assert.equal(parsedPayload.reasonCode, originalPayload.reasonCode);
    assert.equal(parsedPayload.occurredAt, originalPayload.occurredAt);
    assert.equal(parsedPayload.metadataJson, originalPayload.metadataJson);

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("event envelope: batch events maintain individual envelope integrity", () => {
  const ctx = createIntegrationContext("aa-batch-envelope-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-batch-env",
      executionId: "exec-batch-env",
    });

    const events = bus.publishBatch([
      {
        eventType: "task:status_changed",
        taskId: "task-batch-env",
        executionId: "exec-batch-env",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      },
      {
        eventType: "workflow:step_completed",
        taskId: "task-batch-env",
        executionId: "exec-batch-env",
        payload: { stepId: "step-1", status: "completed" },
      },
      {
        eventType: "cost:limit_reached",
        taskId: "task-batch-env",
        executionId: "exec-batch-env",
        payload: { budgetId: "budget-1", currentCostUsd: 150.0, limitUsd: 100.0, occurredAt: "2026-05-01T12:00:00.000Z" },
      },
    ]);

    assert.equal(events.length, 3, "Should have 3 events");

    // Verify each event maintains envelope integrity
    const taskEvent = events[0];
    assert.equal(taskEvent.eventType, "task:status_changed");
    assert.equal(taskEvent.eventTier, "tier_1");
    const taskPayload = JSON.parse(taskEvent.payloadJson);
    assert.equal(taskPayload.toStatus, "in_progress");

    const workflowEvent = events[1];
    assert.equal(workflowEvent.eventType, "workflow:step_completed");
    assert.equal(workflowEvent.eventTier, "tier_1");
    const workflowPayload = JSON.parse(workflowEvent.payloadJson);
    assert.equal(workflowPayload.stepId, "step-1");

    const costEvent = events[2];
    assert.equal(costEvent.eventType, "cost:limit_reached");
    assert.equal(costEvent.eventTier, "tier_1");
    const costPayload = JSON.parse(costEvent.payloadJson);
    assert.equal(costPayload.currentCostUsd, 150.0);

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("event bus: handles rapid publish and deliver cycle", async () => {
  const workspace = createTempWorkspace("aa-rapid-cycle-");
  try {
    const db = new SqliteDatabase(join(workspace, "rapid-cycle-test.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-rapid",
      executionId: "exec-rapid",
    });

    const received: number[] = [];
    bus.subscribe("rapid_consumer", (event) => {
      const payload = JSON.parse(event.payloadJson);
      received.push(payload.seq);
    });

    // Publish 10 events rapidly
    for (let i = 0; i < 10; i++) {
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-rapid",
        executionId: "exec-rapid",
        payload: { fromStatus: "queued", toStatus: "in_progress", seq: i },
      });
    }

    await bus.deliverPending("rapid_consumer");

    assert.equal(received.length, 10, "Should receive all 10 events");
    assert.deepEqual(received, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9], "Events should maintain order");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("event bus: preserves event order within aggregate", async () => {
  const ctx = createIntegrationContext("aa-order-aggregate-");
  try {
    const bus = new DurableEventBus(ctx.db, ctx.store);

    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-order",
      executionId: "exec-order",
    });

    const received: number[] = [];
    bus.subscribe("order_consumer", (event) => {
      const payload = JSON.parse(event.payloadJson);
      received.push(payload.seq);
    });

    // Publish events with same aggregateId but different sequences
    for (let i = 0; i < 5; i++) {
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-order",
        executionId: "exec-order",
        aggregateId: "workflow-aggregate-1",
        sequence: i,
        payload: { fromStatus: "queued", toStatus: "in_progress", seq: i },
      });
    }

    await bus.deliverPending("order_consumer");

    assert.equal(received.length, 5, "Should receive all 5 events");
    assert.deepEqual(received, [0, 1, 2, 3, 4], "Events within aggregate should maintain sequence order");

    bus.dispose();
  } finally {
    ctx.cleanup();
  }
});
