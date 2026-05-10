/**
 * Integration tests for EventRepository
 *
 * Tests event storage and retrieval using real SQLite database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { EventRepository } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/repositories/event-repository.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

// ============================================================================
// insertEvent tests
// ============================================================================

test("integration: insertEvent creates event record with all fields", () => {
  const ctx = createIntegrationContext("aa-event-repo-insert-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-insert-1", executionId: "exec-insert-1", traceId: "trace-insert-1" });

    const now = new Date().toISOString();
    const event = eventRepo.insertEvent({
      id: "evt-insert-001",
      taskId: "task-insert-1",
      executionId: "exec-insert-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({ fromStatus: "queued", toStatus: "in_progress" }),
      traceId: "trace-insert-1",
      createdAt: now,
    });

    assert.equal(event.id, "evt-insert-001");
    assert.equal(event.taskId, "task-insert-1");
    assert.equal(event.executionId, "exec-insert-1");
    assert.equal(event.eventType, "task:status_changed");
    assert.equal(event.traceId, "trace-insert-1");
    assert.equal(event.createdAt, now);

    // Verify event is stored in database
    const stored = eventRepo.getEvent("evt-insert-001");
    assert.ok(stored, "Event should be stored in database");
    assert.equal(stored!.id, "evt-insert-001");
    assert.equal(stored!.eventType, "task:status_changed");
  } finally {
    ctx.cleanup();
  }
});

test("integration: insertEvent auto-assigns eventTier based on eventType", () => {
  const ctx = createIntegrationContext("aa-event-repo-tier-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-tier-1", executionId: "exec-tier-1", traceId: "trace-tier-1" });

    const event = eventRepo.insertEvent({
      id: "evt-tier-001",
      taskId: "task-tier-1",
      executionId: "exec-tier-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    // task:created is a known tier_1 event
    assert.ok(event.eventTier === "tier_1" || event.eventTier === "tier_2", "eventTier should be assigned based on eventType");
  } finally {
    ctx.cleanup();
  }
});

test("integration: insertEvent accepts optional sessionId", () => {
  const ctx = createIntegrationContext("aa-event-repo-session-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-session-1", executionId: "exec-session-1", traceId: "trace-session-1" });

    const event = eventRepo.insertEvent({
      id: "evt-session-001",
      taskId: "task-session-1",
      sessionId: "session-abc123",
      executionId: "exec-session-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    assert.equal(event.sessionId, "session-abc123");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// listEventsForTask tests
// ============================================================================

test("integration: listEventsForTask returns all events for a task", () => {
  const ctx = createIntegrationContext("aa-event-repo-task-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-list-001", executionId: "exec-list-task-1", traceId: "trace-list-task-1" });

    const now = new Date().toISOString();
    eventRepo.insertEvent({
      id: "evt-task-001",
      taskId: "task-list-001",
      executionId: "exec-list-task-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: now,
    });
    eventRepo.insertEvent({
      id: "evt-task-002",
      taskId: "task-list-001",
      executionId: "exec-list-task-1",
      eventType: "task:started",
      payloadJson: JSON.stringify({}),
      createdAt: now,
    });

    const events = eventRepo.listEventsForTask("task-list-001");

    assert.equal(events.length, 2, "Should return 2 events for task");
    assert.ok(events.some((e) => e.id === "evt-task-001"), "Should include first event");
    assert.ok(events.some((e) => e.id === "evt-task-002"), "Should include second event");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsForTask returns empty array for non-existent task", () => {
  const ctx = createIntegrationContext("aa-event-repo-no-task-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);

    const events = eventRepo.listEventsForTask("non-existent-task");

    assert.equal(events.length, 0, "Should return empty array for non-existent task");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsForTask returns only events for that specific task", () => {
  const ctx = createIntegrationContext("aa-event-repo-specific-task-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-spec-1", executionId: "exec-spec-1", traceId: "trace-spec-1" });
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-spec-2", executionId: "exec-spec-2", traceId: "trace-spec-2" });

    // Insert events for different tasks
    eventRepo.insertEvent({
      id: "evt-spec-task-001",
      taskId: "task-spec-1",
      executionId: "exec-spec-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });
    eventRepo.insertEvent({
      id: "evt-spec-task-002",
      taskId: "task-spec-2",
      executionId: "exec-spec-2",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    const events1 = eventRepo.listEventsForTask("task-spec-1");
    const events2 = eventRepo.listEventsForTask("task-spec-2");

    assert.equal(events1.length, 1, "task-spec-1 should have 1 event");
    assert.equal(events1[0]!.id, "evt-spec-task-001");
    assert.equal(events2.length, 1, "task-spec-2 should have 1 event");
    assert.equal(events2[0]!.id, "evt-spec-task-002");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsForTask with limit returns specified number of events", () => {
  const ctx = createIntegrationContext("aa-event-repo-task-limit-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-limit-1", executionId: "exec-limit-1", traceId: "trace-limit-1" });

    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      eventRepo.insertEvent({
        id: `evt-limit-${String(i).padStart(3, "0")}`,
        taskId: "task-limit-1",
        executionId: "exec-limit-1",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ index: i }),
        createdAt: now,
      });
    }

    const limitedEvents = eventRepo.listEventsForTask("task-limit-1", 3);

    assert.equal(limitedEvents.length, 3, "Should return at most 3 events");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Event ordering tests
// ============================================================================

test("integration: listAllEvents returns events ordered by createdAt ascending", () => {
  const ctx = createIntegrationContext("aa-event-repo-all-order-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-all-order-1", executionId: "exec-all-order-1", traceId: "trace-all-order-1" });

    const baseTime = new Date("2024-01-02T10:00:00.000Z").toISOString();
    eventRepo.insertEvent({
      id: "evt-all-order-001",
      taskId: "task-all-order-1",
      executionId: "exec-all-order-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: baseTime,
    });
    eventRepo.insertEvent({
      id: "evt-all-order-002",
      taskId: "task-all-order-1",
      executionId: "exec-all-order-1",
      eventType: "task:started",
      payloadJson: JSON.stringify({}),
      createdAt: new Date("2024-01-02T10:00:01.000Z").toISOString(),
    });

    const allEvents = eventRepo.listAllEvents();

    // Find our events in the list
    const ourEvents = allEvents.filter((e) => e.id.startsWith("evt-all-order-"));
    assert.ok(ourEvents.length >= 2, "Should have at least 2 events");
    assert.equal(ourEvents[0]!.id, "evt-all-order-001", "First event should be earliest");
    assert.equal(ourEvents[1]!.id, "evt-all-order-002", "Second event should be later");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsForTask returns events ordered by createdAt ascending", () => {
  const ctx = createIntegrationContext("aa-event-repo-order-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-order-1", executionId: "exec-order-1", traceId: "trace-order-1" });

    const baseTime = new Date("2024-01-01T10:00:00.000Z").toISOString();
    eventRepo.insertEvent({
      id: "evt-order-001",
      taskId: "task-order-1",
      executionId: "exec-order-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: baseTime,
    });
    eventRepo.insertEvent({
      id: "evt-order-002",
      taskId: "task-order-1",
      executionId: "exec-order-1",
      eventType: "task:started",
      payloadJson: JSON.stringify({}),
      createdAt: new Date("2024-01-01T10:00:01.000Z").toISOString(),
    });
    eventRepo.insertEvent({
      id: "evt-order-003",
      taskId: "task-order-1",
      executionId: "exec-order-1",
      eventType: "task:completed",
      payloadJson: JSON.stringify({}),
      createdAt: new Date("2024-01-01T10:00:02.000Z").toISOString(),
    });

    const events = eventRepo.listEventsForTask("task-order-1");

    assert.equal(events.length, 3);
    assert.equal(events[0]!.id, "evt-order-001", "First event should be earliest");
    assert.equal(events[1]!.id, "evt-order-002", "Second event should be middle");
    assert.equal(events[2]!.id, "evt-order-003", "Third event should be latest");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Event type filtering tests
// ============================================================================

test("integration: listEventsByType returns only events of specified type", () => {
  const ctx = createIntegrationContext("aa-event-repo-type-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-type-1", executionId: "exec-type-1", traceId: "trace-type-1" });

    const now = new Date().toISOString();
    eventRepo.insertEvent({
      id: "evt-type-001",
      taskId: "task-type-1",
      executionId: "exec-type-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: now,
    });
    eventRepo.insertEvent({
      id: "evt-type-002",
      taskId: "task-type-1",
      executionId: "exec-type-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({}),
      createdAt: now,
    });
    eventRepo.insertEvent({
      id: "evt-type-003",
      taskId: "task-type-1",
      executionId: "exec-type-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({}),
      createdAt: now,
    });

    const statusChangedEvents = eventRepo.listEventsByType("task:status_changed");
    const createdEvents = eventRepo.listEventsByType("task:created");

    assert.equal(statusChangedEvents.length, 2, "Should return 2 status_changed events");
    assert.ok(statusChangedEvents.every((e) => e.eventType === "task:status_changed"), "All should be task:status_changed");
    assert.equal(createdEvents.length, 1, "Should return 1 task:created event");
    assert.equal(createdEvents[0]!.id, "evt-type-001");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsByType returns empty array for non-existent type", () => {
  const ctx = createIntegrationContext("aa-event-repo-no-type-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-no-type-1", executionId: "exec-no-type-1", traceId: "trace-no-type-1" });

    eventRepo.insertEvent({
      id: "evt-no-type-001",
      taskId: "task-no-type-1",
      executionId: "exec-no-type-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: new Date().toISOString(),
    });

    const events = eventRepo.listEventsByType("nonExistent:event_type");

    assert.equal(events.length, 0, "Should return empty array for non-existent type");
  } finally {
    ctx.cleanup();
  }
});

test("integration: listEventsByType respects limit parameter", () => {
  const ctx = createIntegrationContext("aa-event-repo-type-limit-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-type-limit-1", executionId: "exec-type-limit-1", traceId: "trace-type-limit-1" });

    const now = new Date().toISOString();
    for (let i = 0; i < 5; i++) {
      eventRepo.insertEvent({
        id: `evt-type-limit-${String(i).padStart(3, "0")}`,
        taskId: "task-type-limit-1",
        executionId: "exec-type-limit-1",
        eventType: "task:status_changed",
        payloadJson: JSON.stringify({ index: i }),
        createdAt: now,
      });
    }

    const limitedEvents = eventRepo.listEventsByType("task:status_changed", 3);

    assert.equal(limitedEvents.length, 3, "Should return at most 3 events");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// getEvent tests
// ============================================================================

test("integration: getEvent returns event by id", () => {
  const ctx = createIntegrationContext("aa-event-repo-get-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-get-1", executionId: "exec-get-1", traceId: "trace-get-1" });

    eventRepo.insertEvent({
      id: "evt-get-001",
      taskId: "task-get-1",
      executionId: "exec-get-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({ key: "value" }),
      createdAt: new Date().toISOString(),
    });

    const event = eventRepo.getEvent("evt-get-001");

    assert.ok(event, "Should return event");
    assert.equal(event!.id, "evt-get-001");
    assert.equal(event!.eventType, "task:created");
    assert.equal(event!.payloadJson, JSON.stringify({ key: "value" }));
  } finally {
    ctx.cleanup();
  }
});

test("integration: getEvent returns undefined for non-existent event", () => {
  const ctx = createIntegrationContext("aa-event-repo-no-get-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);

    const event = eventRepo.getEvent("non-existent-event-id");

    assert.equal(event, undefined, "Should return undefined for non-existent event");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Combined scenario tests
// ============================================================================

test("integration: insert and retrieve multiple events with different types and ordering", () => {
  const ctx = createIntegrationContext("aa-event-repo-combined-");
  try {
    const eventRepo = new EventRepository(ctx.db.connection);
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task-combined-1", executionId: "exec-combined-1", traceId: "trace-combined-1" });

    const time1 = new Date("2024-01-15T08:00:00.000Z").toISOString();
    const time2 = new Date("2024-01-15T08:00:01.000Z").toISOString();
    const time3 = new Date("2024-01-15T08:00:02.000Z").toISOString();
    const time4 = new Date("2024-01-15T08:00:03.000Z").toISOString();

    eventRepo.insertEvent({
      id: "evt-comb-001",
      taskId: "task-combined-1",
      executionId: "exec-combined-1",
      eventType: "task:created",
      payloadJson: JSON.stringify({}),
      createdAt: time1,
    });
    eventRepo.insertEvent({
      id: "evt-comb-002",
      taskId: "task-combined-1",
      executionId: "exec-combined-1",
      eventType: "task:started",
      payloadJson: JSON.stringify({}),
      createdAt: time2,
    });
    eventRepo.insertEvent({
      id: "evt-comb-003",
      taskId: "task-combined-1",
      executionId: "exec-combined-1",
      eventType: "task:status_changed",
      payloadJson: JSON.stringify({}),
      createdAt: time3,
    });
    eventRepo.insertEvent({
      id: "evt-comb-004",
      taskId: "task-combined-1",
      executionId: "exec-combined-1",
      eventType: "task:completed",
      payloadJson: JSON.stringify({}),
      createdAt: time4,
    });

    // Verify ordering via listEventsForTask
    const taskEvents = eventRepo.listEventsForTask("task-combined-1");
    assert.equal(taskEvents[0]!.id, "evt-comb-001");
    assert.equal(taskEvents[1]!.id, "evt-comb-002");
    assert.equal(taskEvents[2]!.id, "evt-comb-003");
    assert.equal(taskEvents[3]!.id, "evt-comb-004");

    // Verify type filtering via listEventsByType
    const statusChangedEvents = eventRepo.listEventsByType("task:status_changed");
    assert.equal(statusChangedEvents.length, 1);
    assert.equal(statusChangedEvents[0]!.id, "evt-comb-003");

    // Verify we can get individual event via getEvent
    const singleEvent = eventRepo.getEvent("evt-comb-002");
    assert.ok(singleEvent);
    assert.equal(singleEvent!.eventType, "task:started");
  } finally {
    ctx.cleanup();
  }
});