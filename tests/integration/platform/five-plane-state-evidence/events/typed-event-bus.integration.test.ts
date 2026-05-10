/**
 * Integration Tests: TypedEventBus → DurableEventBus → SQLite Pipeline
 *
 * Tests end-to-end event flow from TypedEventBus through DurableEventBus to SQLite storage.
 * Verifies publish/subscribe/deliver pattern with real database operations.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

test("integration: TypedEventBus.publish() stores event in SQLite via DurableEventBus", () => {
  const ctx = createIntegrationContext("aa-typed-event-");
  try {
    const typedBus = new TypedEventBus(ctx.db, ctx.store);

    const eventRecord = typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-event-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-event-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-event-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    assert.ok(eventRecord.id, "Published event should have an ID");
    assert.equal(eventRecord.eventType, "task:status_changed");
    assert.equal(eventRecord.taskId, "task-event-001");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TypedEventBus.subscribe() receives published events", async () => {
  const ctx = createIntegrationContext("aa-typed-sub-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    const receivedEvents: Array<{ eventType: string; payload: Record<string, unknown> }> = [];

    typedBus.subscribe("test-consumer-1", ["task:status_changed"], (envelope) => {
      receivedEvents.push({ eventType: envelope.event.eventType, payload: envelope.payload as Record<string, unknown> });
    });

    typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-sub-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-sub-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-sub-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    // Deliver pending events to consumer
    const delivered = await typedBus.deliverPending("test-consumer-1");
    assert.ok(delivered >= 1, "At least one event should be delivered");

    assert.equal(receivedEvents.length, 1, "Should receive exactly one event");
    assert.equal(receivedEvents[0].eventType, "task:status_changed");
    assert.equal((receivedEvents[0].payload as Record<string, unknown>).entityId, "task-sub-001");
  } finally {
    typedBus.unsubscribe("test-consumer-1");
    ctx.cleanup();
  }
});

test("integration: TypedEventBus.unsubscribe() stops event delivery", async () => {
  const ctx = createIntegrationContext("aa-typed-unsub-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    let callCount = 0;

    const handler = () => {
      callCount++;
    };

    typedBus.subscribe("unsub-consumer", ["task:status_changed"], handler);
    typedBus.unsubscribe("unsub-consumer");

    typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-unsub-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-unsub-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    await typedBus.deliverPending("unsub-consumer");
    assert.equal(callCount, 0, "Unsubscribed handler should not be called");
  } finally {
    ctx.cleanup();
  }
});

test("integration: TypedEventBus.pendingForConsumer() returns undelivered events", () => {
  const ctx = createIntegrationContext("aa-typed-pending-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    typedBus.subscribe("pending-consumer", ["task:status_changed", "workflow:step_completed"], () => {});

    // Publish multiple event types
    typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-pending-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-pending-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    typedBus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-pending-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-pending-002",
      traceContext: null,
      payload: {
        stepId: "step_1",
        workflowId: "task-pending-001",
        outputKey: "result",
        occurredAt: nowIso(),
      },
    });

    const pending = typedBus.pendingForConsumer("pending-consumer");
    assert.ok(pending.length >= 2, "Should have at least 2 pending events");
  } finally {
    typedBus.unsubscribe("pending-consumer");
    ctx.cleanup();
  }
});

test("integration: TypedEventBus delivers multiple events in order", async () => {
  const ctx = createIntegrationContext("aa-typed-multi-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    const received: string[] = [];

    typedBus.subscribe("multi-consumer", ["task:status_changed"], (envelope) => {
      const payload = envelope.payload as Record<string, unknown>;
      received.push(`${payload.entityId}:${payload.toStatus}`);
    });

    const taskIds = ["task-multi-001", "task-multi-002", "task-multi-003"];
    for (const taskId of taskIds) {
      typedBus.publish({
        eventType: "task:status_changed",
        taskId,
        sessionId: null,
        executionId: null,
        traceId: `trace-${taskId}`,
        traceContext: null,
        payload: {
          entityKind: "task",
          entityId: taskId,
          fromStatus: "queued",
          toStatus: "in_progress",
          reasonCode: "task.started",
          reasonDetail: null,
          actorType: "system",
          actorId: null,
          idempotencyKey: null,
          metadataJson: null,
          occurredAt: nowIso(),
        },
      });
    }

    await typedBus.deliverPending("multi-consumer");
    assert.equal(received.length, 3, "Should receive all 3 events");
    assert.equal(received[0], "task-multi-001:in_progress");
    assert.equal(received[1], "task-multi-002:in_progress");
    assert.equal(received[2], "task-multi-003:in_progress");
  } finally {
    typedBus.unsubscribe("multi-consumer");
    ctx.cleanup();
  }
});

test("integration: TypedEventBus filters events by subscribed type", async () => {
  const ctx = createIntegrationContext("aa-typed-filter-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    const received: string[] = [];

    // Only subscribe to task events, not workflow events
    typedBus.subscribe("filter-consumer", ["task:status_changed"], (envelope) => {
      received.push(envelope.event.eventType);
    });

    typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-filter-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-filter-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-filter-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    typedBus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-filter-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-filter-002",
      traceContext: null,
      payload: {
        stepId: "step_1",
        workflowId: "task-filter-001",
        outputKey: "result",
        occurredAt: nowIso(),
      },
    });

    await typedBus.deliverPending("filter-consumer");
    assert.equal(received.length, 1, "Should only receive task:status_changed event");
    assert.equal(received[0], "task:status_changed");
  } finally {
    typedBus.unsubscribe("filter-consumer");
    ctx.cleanup();
  }
});

test("integration: TypedEventBus handles high-risk command events", async () => {
  const ctx = createIntegrationContext("aa-typed-risk-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    const received: string[] = [];

    typedBus.subscribe("risk-consumer", ["platform.harness_run.status_changed"], (envelope) => {
      received.push(envelope.event.eventType);
    });

    typedBus.publish({
      eventType: "platform.harness_run.status_changed",
      taskId: "task-risk-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-risk-001",
      traceContext: null,
      payload: {
        status: "completed",
        runId: "run-risk-001",
        taskId: "task-risk-001",
        occurredAt: nowIso(),
      },
    });

    await typedBus.deliverPending("risk-consumer");
    assert.equal(received.length, 1);
    assert.equal(received[0], "platform.harness_run.status_changed");
  } finally {
    typedBus.unsubscribe("risk-consumer");
    ctx.cleanup();
  }
});

test("integration: TypedEventBus multiple consumers receive same events independently", async () => {
  const ctx = createIntegrationContext("aa-typed-indep-");
  const typedBus = new TypedEventBus(ctx.db, ctx.store);
  try {
    const consumer1Events: string[] = [];
    const consumer2Events: string[] = [];

    typedBus.subscribe("indep-consumer-1", ["task:status_changed"], (envelope) => {
      consumer1Events.push(envelope.event.eventType);
    });

    typedBus.subscribe("indep-consumer-2", ["task:status_changed"], (envelope) => {
      consumer2Events.push(envelope.event.eventType);
    });

    typedBus.publish({
      eventType: "task:status_changed",
      taskId: "task-indep-001",
      sessionId: null,
      executionId: null,
      traceId: "trace-indep-001",
      traceContext: null,
      payload: {
        entityKind: "task",
        entityId: "task-indep-001",
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "task.started",
        reasonDetail: null,
        actorType: "system",
        actorId: null,
        idempotencyKey: null,
        metadataJson: null,
        occurredAt: nowIso(),
      },
    });

    await typedBus.deliverPending("indep-consumer-1");
    await typedBus.deliverPending("indep-consumer-2");

    assert.equal(consumer1Events.length, 1, "Consumer 1 should receive event");
    assert.equal(consumer2Events.length, 1, "Consumer 2 should receive event independently");
  } finally {
    typedBus.unsubscribe("indep-consumer-1");
    typedBus.unsubscribe("indep-consumer-2");
    ctx.cleanup();
  }
});