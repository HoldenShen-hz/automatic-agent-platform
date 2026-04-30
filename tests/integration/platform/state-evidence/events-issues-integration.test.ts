/**
 * Integration Tests: State Evidence Events Issues
 *
 * Tests covering specific issue areas:
 * - Issue #2233: DLQ service retry limits
 * - Issue #2242: Event inbox compression (memory leak)
 * - Issue #2237: Durable event bus pending ack filtering
 * - Issue #2234: Event registry validation
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { LayeredEventInbox } from "../../../../src/platform/state-evidence/events/layered-event-inbox.js";
import { DurableEventBus } from "../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { DlqService } from "../../../../src/platform/state-evidence/events/dlq-service.js";
import {
  getEventSchema,
  validateEventPayload,
  hasEventSchema,
  getRegisteredConsumers,
} from "../../../../src/platform/state-evidence/events/event-registry.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

// ============================================================================
// Issue #2233: DLQ Service Retry Limits
// ============================================================================

test("integration: DLQ service scheduleRetry enforces maxRetries limit - Issue #2233", () => {
  const ctx = createIntegrationContext("aa-dlq-retry-limit-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-limit-001",
      consumerId: "consumer-limit",
      errorCode: "permanent_error",
      payloadJson: '{"taskId":"t-limit"}',
    });

    // Schedule retries up to maxRetries (5)
    let current = record;
    for (let i = 0; i < 5; i++) {
      current = dlq.scheduleRetry(current.deadLetterId);
      assert.equal(current.retryCount, i + 1, `Retry count should be ${i + 1}`);
    }

    // The 6th retry should throw because maxRetries (5) is exceeded
    assert.throws(
      () => dlq.scheduleRetry(current.deadLetterId),
      /retry limit exceeded|exhausted/i,
      "Should throw when retry count exceeds maxRetries",
    );
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service retry count increments correctly up to limit - Issue #2233", () => {
  const ctx = createIntegrationContext("aa-dlq-retry-count-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-count-001",
      consumerId: "consumer-count",
      errorCode: "error",
      payloadJson: '{"taskId":"t-count"}',
    });

    // Verify initial state
    assert.equal(record.retryCount, 0, "Initial retry count should be 0");
    assert.equal(record.maxRetries, 5, "Max retries should be 5");

    // Schedule 5 retries
    let current = record;
    for (let i = 1; i <= 5; i++) {
      current = dlq.scheduleRetry(current.deadLetterId);
      assert.equal(current.retryCount, i, `After retry ${i}, count should be ${i}`);
    }

    // Verify final state before exceeding limit
    assert.equal(current.retryCount, 5, "Retry count should be 5 after 5 retries");
    assert.equal(current.status, "retrying", "Status should be retrying");
  } finally {
    ctx.cleanup();
  }
});

test("integration: DLQ service markRetryExhausted sets terminal state - Issue #2233", () => {
  const ctx = createIntegrationContext("aa-dlq-exhausted-terminal-");
  try {
    const dlq = new DlqService();

    const record = dlq.enqueue({
      sourceEventId: "evt-dlq-exhaust-001",
      consumerId: "consumer-exhaust",
      errorCode: "error",
      payloadJson: '{"taskId":"t-exhaust"}',
    });

    // Exhaust retries
    let current = record;
    for (let i = 0; i < 5; i++) {
      current = dlq.scheduleRetry(current.deadLetterId);
    }

    // Mark as retry exhausted
    const exhausted = dlq.markRetryExhausted(current.deadLetterId, "operator-exhaust");

    assert.equal(exhausted.status, "discarded", "Status should be discarded after exhaustion");
    assert.ok(exhausted.retryExhaustedAt !== null, "retryExhaustedAt should be set");
    assert.equal(exhausted.nextRetryAt, null, "nextRetryAt should be null");
  } finally {
    ctx.cleanup();
  }
});

// ============================================================================
// Issue #2242: Event Inbox Compression (Memory Leak)
// ============================================================================

test("integration: LayeredEventInbox records array grows without compression - Issue #2242", () => {
  // This test demonstrates the memory leak issue where records array
  // only grows and never shrinks (no compression implemented)

  const inbox = new LayeredEventInbox();

  inbox.registerConsumer({ consumerId: "test-consumer", kind: "truth" });

  // Add multiple events
  const event1 = {
    id: "evt-inbox-001",
    eventType: "task:status_changed",
    namespace: "platform",
    sourceOfTruth: "platform" as const,
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "transition_service",
    replayBehavior: "replay_as_fact" as const,
    payloadJson: JSON.stringify({ toStatus: "in_progress" }),
    createdAt: "2026-04-20T10:00:00.000Z",
    traceContext: null,
    entityId: null,
    causationId: null,
    correlationId: null,
    version: null,
  };

  const event2 = {
    id: "evt-inbox-002",
    eventType: "task:status_changed",
    namespace: "platform",
    sourceOfTruth: "platform" as const,
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "transition_service",
    replayBehavior: "replay_as_fact" as const,
    payloadJson: JSON.stringify({ toStatus: "completed" }),
    createdAt: "2026-04-20T10:01:00.000Z",
    traceContext: null,
    entityId: null,
    causationId: null,
    correlationId: null,
    version: null,
  };

  inbox.append(event1, "2026-04-20T10:00:00.000Z");
  inbox.append(event2, "2026-04-20T10:01:00.000Z");

  assert.equal(inbox.size(), 2, "Inbox should have 2 records");

  // Drain events
  inbox.drain("test-consumer", 10);

  // Issue #2242: After draining, records array should ideally be compressed
  // but currently it only marks cursor position without releasing memory
  // The size() still returns the original count
  assert.equal(inbox.size(), 2, "Issue #2242: records array not compressed after drain");

  // Drain again - no new events but size is still 2
  const secondDrain = inbox.drain("test-consumer", 10);
  assert.equal(secondDrain.length, 0, "Second drain should return 0 events");

  // Issue #2242: The records array still has 2 entries even though both were drained
  assert.equal(inbox.size(), 2, "Issue #2242: records array still not compressed");
});

test("integration: LayeredEventInbox has no compress method - Issue #2242", () => {
  const inbox = new LayeredEventInbox();

  // Issue #2242: There is no compress() method to reclaim memory
  // Verify that the method does not exist
  assert.equal(
    typeof (inbox as Record<string, unknown>).compress,
    "undefined",
    "Issue #2242: LayeredEventInbox should have no compress method",
  );
});

test("integration: LayeredEventInbox memory grows with repeated append/drain cycles - Issue #2242", () => {
  const inbox = new LayeredEventInbox();

  inbox.registerConsumer({ consumerId: "mem-consumer", kind: "projection" });

  // Create a large event
  const largePayload = { data: "x".repeat(10000) };
  const largeEvent = {
    id: "evt-large",
    eventType: "task:status_changed",
    namespace: "platform",
    sourceOfTruth: "platform" as const,
    replayable: true,
    sideEffectSafeToReplay: true,
    schemaOwner: "transition_service",
    replayBehavior: "replay_as_fact" as const,
    payloadJson: JSON.stringify(largePayload),
    createdAt: "2026-04-20T10:00:00.000Z",
    traceContext: null,
    entityId: null,
    causationId: null,
    correlationId: null,
    version: null,
  };

  // Simulate many append/drain cycles
  for (let i = 0; i < 100; i++) {
    const event = { ...largeEvent, id: `evt-cycle-${i}` };
    inbox.append(event, `2026-04-20T10:${String(i % 60).padStart(2, "0")}:00.000Z`);
    inbox.drain("mem-consumer", 1);
  }

  // Issue #2242: Despite draining all events, the internal records array
  // still holds all 100 entries, demonstrating the memory leak
  assert.equal(inbox.size(), 100, "Issue #2242: records array holds all entries even after drain");
});

// ============================================================================
// Issue #2237: Durable Event Bus Pending Ack Filtering
// ============================================================================

test("integration: DurableEventBus pendingForConsumer filters by registered consumers - Issue #2237", () => {
  const workspace = createTempWorkspace("aa-bus-pending-filter-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "pending-filter.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-pending-filter",
      executionId: "exec-pending-filter",
    });

    // Subscribe a specific consumer
    bus.subscribe("task_projection", async (_event) => {});

    // Publish an event that is NOT for "task_projection" consumer
    bus.publish({
      eventType: "stream:chunk_emitted", // tier_3 event with no registered consumers
      taskId: "task-pending-filter",
      executionId: "exec-pending-filter",
      payload: { chunk: "data" },
    });

    // Issue #2237: pendingForConsumer may return events for consumers
    // that are not registered for that event type (false pending count)
    const pending = bus.pendingForConsumer("task_projection");

    // stream:chunk_emitted has no registered consumers, so task_projection
    // should NOT have it in pending
    const hasStreamEvent = pending.some(
      (p) => p.event.eventType === "stream:chunk_emitted",
    );

    assert.equal(
      hasStreamEvent,
      false,
      "Issue #2237: Consumer should not have pending events for unregistered event types",
    );

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("integration: DurableEventBus ensurePendingAcksForActiveConsumers only creates acks for registered consumers - Issue #2237", () => {
  const workspace = createTempWorkspace("aa-bus-ack-filter-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "ack-filter.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-ack-filter",
      executionId: "exec-ack-filter",
    });

    // Subscribe only to "task_projection"
    bus.subscribe("task_projection", async (_event) => {});

    // Publish a tier_3 event (stream:chunk_emitted) which has NO registered consumers
    bus.publish({
      eventType: "stream:chunk_emitted",
      taskId: "task-ack-filter",
      executionId: "exec-ack-filter",
      payload: { chunk: "test" },
    });

    // Issue #2237: The bug is that ensurePendingAcksForActiveConsumers creates
    // pending acks for ALL active consumers without checking if they are
    // registered for the event type, leading to false pending counts

    // After the fix, pendingForConsumer should not return events that
    // the consumer is not registered for
    const pending = bus.pendingForConsumer("task_projection");

    // stream:chunk_emitted should not appear because task_projection
    // is not registered for that event type
    const streamPending = pending.filter(
      (p) => p.event.eventType === "stream:chunk_emitted",
    );

    assert.equal(
      streamPending.length,
      0,
      "Issue #2237: tier_3 events should not create false pending acks for unrelated consumers",
    );

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

test("integration: DurableEventBus pendingForConsumer returns events only for registered consumers - Issue #2237", () => {
  const workspace = createTempWorkspace("aa-bus-consumer-reg-");
  let db: SqliteDatabase | undefined;

  try {
    db = new SqliteDatabase(join(workspace, "consumer-reg.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new DurableEventBus(db, store);

    seedTaskAndExecution(db, store, {
      taskId: "task-consumer-reg",
      executionId: "exec-consumer-reg",
    });

    // Subscribe consumer to task:status_changed events only
    bus.subscribe("only_task_status", async (_event) => {});

    // Publish two different event types
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-consumer-reg",
      executionId: "exec-consumer-reg",
      payload: { toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "perf:test_event", // tier_3 with no registered consumers
      taskId: "task-consumer-reg",
      executionId: "exec-consumer-reg",
      payload: { test: true },
    });

    const pending = bus.pendingForConsumer("only_task_status");

    // Issue #2237: Only task:status_changed should be pending for this consumer
    // perf:test_event should NOT be pending because this consumer is not registered for it
    const taskStatusPending = pending.filter(
      (p) => p.event.eventType === "task:status_changed",
    );
    const perfEventPending = pending.filter(
      (p) => p.event.eventType === "perf:test_event",
    );

    assert.ok(
      taskStatusPending.length > 0,
      "task:status_changed should be pending for task_projection",
    );
    assert.equal(
      perfEventPending.length,
      0,
      "Issue #2237: perf:test_event should NOT be pending for consumer not registered for it",
    );

    bus.dispose();
  } finally {
    db?.close();
    cleanupPath(workspace);
  }
});

// ============================================================================
// Issue #2234: Event Registry Validation
// ============================================================================

test("integration: getEventSchema returns schema for known event types - Issue #2234", () => {
  // Known event types should return valid schemas
  const schema = getEventSchema("task:status_changed");
  assert.ok(schema !== undefined, "Schema should be returned for known event type");
  assert.equal(schema.type, "task:status_changed");
  assert.ok(schema.tier !== undefined, "Schema should have tier");
  assert.ok(schema.consumers !== undefined, "Schema should have consumers array");
});

test("integration: validateEventPayload validates correct payload - Issue #2234", () => {
  // Valid payload for task:status_changed
  const payload = {
    fromStatus: "queued",
    toStatus: "in_progress",
    occurredAt: "2026-04-20T10:00:00.000Z",
  };

  const result = validateEventPayload("task:status_changed", payload);
  assert.deepEqual(result, payload, "Valid payload should pass validation");
});

test("integration: validateEventPayload rejects invalid payload - Issue #2234", () => {
  // Invalid payload - missing required toStatus field
  const invalidPayload = {
    fromStatus: "queued",
    // toStatus is missing and required
  };

  assert.throws(
    () => validateEventPayload("task:status_changed", invalidPayload),
    /invalid payload/i,
    "Should reject payload missing required fields",
  );
});

test("integration: validateEventPayload rejects unknown event type - Issue #2234", () => {
  assert.throws(
    () => validateEventPayload("unknown:event:type", {}),
    /schema.*not.*found|missing/i,
    "Should reject unknown event type",
  );
});

test("integration: hasEventSchema returns true for known event types - Issue #2234", () => {
  assert.equal(hasEventSchema("task:status_changed"), true, "Known event type should return true");
  assert.equal(hasEventSchema("workflow:step_completed"), true, "Known event type should return true");
  assert.equal(hasEventSchema("platform.harness_run.status_changed"), true, "Platform event should return true");
});

test("integration: hasEventSchema returns false for unknown event types - Issue #2234", () => {
  assert.equal(hasEventSchema("unknown:event:type"), false, "Unknown event type should return false");
  assert.equal(hasEventSchema("not_registered"), false, "Unregistered event should return false");
});

test("integration: getRegisteredConsumers returns consumers for tier1 events - Issue #2234", () => {
  const consumers = getRegisteredConsumers("task:status_changed");
  assert.ok(Array.isArray(consumers), "Should return array");
  assert.ok(consumers.length > 0, "Tier-1 events should have registered consumers");
});

test("integration: getRegisteredConsumers returns empty array for tier3 events - Issue #2234", () => {
  const consumers = getRegisteredConsumers("stream:chunk_emitted");
  assert.deepEqual(consumers, [], "Tier-3 events should have no registered consumers");
});

test("integration: validateEventPayload enforces schema validation strictly - Issue #2234", () => {
  // Invalid: wrong type for toStatus (should be string)
  const invalidPayload = {
    fromStatus: "queued",
    toStatus: 123, // number instead of string
  };

  assert.throws(
    () => validateEventPayload("task:status_changed", invalidPayload),
    /invalid payload/i,
    "Should reject payload with wrong field types",
  );
});
