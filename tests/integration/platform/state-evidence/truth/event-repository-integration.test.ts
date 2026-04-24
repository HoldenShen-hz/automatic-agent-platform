// @ts-nocheck
/**
 * Integration Tests: Event Store Operations
 *
 * Tests for event storage and retrieval using AuthoritativeTaskStore
 * with SQLite in-memory database.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";

test("event store persists and retrieves event", () => {
  const ctx = createIntegrationContext("aa-event-repo-");
  try {
    const eventId = "event-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: eventId,
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: '{"taskId":"new-task"}',
        traceId: null,
        createdAt: now,
      });
    });

    const event = ctx.store.getEvent(eventId);

    assert.ok(event, "Event should be retrieved");
    assert.equal(event!.id, eventId);
    assert.equal(event!.eventType, "task.created");
    assert.ok(event!.eventTier, "Event should have a tier assigned");
  } finally {
    ctx.cleanup();
  }
});

test("event store returns null for non-existent event", () => {
  const ctx = createIntegrationContext("aa-event-notfound-");
  try {
    const result = ctx.store.getEvent("non-existent-event");
    assert.equal(result, null);
  } finally {
    ctx.cleanup();
  }
});

test("event store filters events by type", () => {
  const ctx = createIntegrationContext("aa-event-type-");
  try {
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: "event-type-001",
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      ctx.store.insertEvent({
        id: "event-type-002",
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      ctx.store.insertEvent({
        id: "event-type-003",
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "execution.started",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });
    });

    const taskCreatedEvents = ctx.store.listEventsByType("task.created");
    assert.equal(taskCreatedEvents.length, 2);

    const executionStartedEvents = ctx.store.listEventsByType("execution.started");
    assert.equal(executionStartedEvents.length, 1);
  } finally {
    ctx.cleanup();
  }
});

test("event store tracks consumer acknowledgments", () => {
  const ctx = createIntegrationContext("aa-event-ack-");
  try {
    const eventId = "event-ack-001";
    const consumerId = "consumer-001";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: eventId,
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      ctx.store.insertEventConsumerAck({
        id: "eack-001",
        eventId,
        consumerId,
        status: "pending",
        lastAttemptAt: null,
        ackedAt: null,
        errorCode: null,
        attemptCount: 0,
      });
    });

    const ack = ctx.store.getEventConsumerAck(eventId, consumerId);

    assert.ok(ack, "Acknowledgment should be retrieved");
    assert.equal(ack!.eventId, eventId);
    assert.equal(ack!.consumerId, consumerId);
    assert.equal(ack!.status, "pending");
  } finally {
    ctx.cleanup();
  }
});

test("event store marks consumer acknowledgment as acked", () => {
  const ctx = createIntegrationContext("aa-event-mark-");
  try {
    const eventId = "event-mark-001";
    const consumerId = "consumer-mark";
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: eventId,
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      ctx.store.insertEventConsumerAck({
        id: "eack-mark-001",
        eventId,
        consumerId,
        status: "pending",
        lastAttemptAt: null,
        ackedAt: null,
        errorCode: null,
        attemptCount: 0,
      });
    });

    const ackTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.markEventAck(eventId, consumerId, "acked", ackTime, null);
    });

    const ack = ctx.store.getEventConsumerAck(eventId, consumerId);
    assert.equal(ack!.status, "acked");
    assert.equal(ack!.attemptCount, 1);
  } finally {
    ctx.cleanup();
  }
});

test("event store acks all consumers for an event", () => {
  const ctx = createIntegrationContext("aa-event-ackall-");
  try {
    const eventId = "event-ackall-001";
    const now = new Date().toISOString();
    const consumers = ["consumer-a", "consumer-b", "consumer-c"];

    ctx.db.transaction(() => {
      ctx.store.insertEvent({
        id: eventId,
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task.created",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });

      for (const consumerId of consumers) {
        ctx.store.insertEventConsumerAck({
          id: `eack-all-${consumerId}`,
          eventId,
          consumerId,
          status: "pending",
          lastAttemptAt: null,
          ackedAt: null,
          errorCode: null,
          attemptCount: 0,
        });
      }
    });

    const ackTime = new Date().toISOString();
    ctx.db.transaction(() => {
      ctx.store.ackAllConsumersForEvent(eventId, ackTime);
    });

    for (const consumerId of consumers) {
      const ack = ctx.store.getEventConsumerAck(eventId, consumerId);
      assert.equal(ack!.status, "acked");
    }
  } finally {
    ctx.cleanup();
  }
});

test("event store counts pending tier 1 acks", () => {
  const ctx = createIntegrationContext("aa-event-tier1-");
  try {
    const now = new Date().toISOString();

    ctx.db.transaction(() => {
      // task:status_changed is tier_1
      ctx.store.insertEvent({
        id: "event-tier1-001",
        taskId: null,
        sessionId: null,
        executionId: null,
        eventType: "task:status_changed",
        payloadJson: "{}",
        traceId: null,
        createdAt: now,
      });
    });

    const count = ctx.store.countPendingTier1Acks();
    assert.ok(count >= 1, "Should have at least one pending tier 1 ack");
  } finally {
    ctx.cleanup();
  }
});
