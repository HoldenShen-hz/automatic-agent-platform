/**
 * Unit tests for DurableEventBus retry loop - Issue #2033
 *
 * Tests that the retry loop runs exactly MAX_DELIVERY_RETRIES times (not 4 times).
 * Bug: The loop condition `0..<=MAX(3)` meant the loop actually ran 4 times instead of 3.
 *
 * Issue #2033: durable-event-bus.ts:358 - Retry loop 0..<=MAX(3) actually 4 times
 */

import assert from "node:assert/strict";
import test from "node:test";

import { DurableEventBus } from "../../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { initHaCoordinatorForTests } from "../../../../helpers/ha-coordinator.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

/**
 * Issue #2033: Retry loop bug analysis
 *
 * The buggy pattern was:
 *   for (let attempt = 0; attempt <= MAX_DELIVERY_RETRIES; attempt++)
 *
 * With MAX_DELIVERY_RETRIES = 3, this runs: 0, 1, 2, 3 = 4 iterations
 *
 * The fixed pattern should be:
 *   for (let attempt = 1; attempt <= MAX_DELIVERY_RETRIES; attempt++)
 *
 * Which runs: 1, 2, 3 = 3 iterations
 *
 * These tests verify the correct retry behavior.
 */

test("durable-event-bus retry loop: exactly 3 attempts when MAX_DELIVERY_RETRIES is 3", async () => {
  const context = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(context.db);
    const bus = new DurableEventBus(context.db, store);
    seedTaskAndExecution(context.db, store, { taskId: "task-retry", executionId: "exec-retry", traceId: "trace-retry" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Simulated handler failure");
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-retry",
      executionId: "exec-retry",
      traceId: "trace-retry",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete (3 attempts * ~100ms backoff + buffer)
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // Issue #2033: Exactly 3 attempts (not 4)
    assert.equal(attemptCount, 3, `Expected exactly 3 retry attempts, got ${attemptCount}`);

    bus.dispose();
  } finally {
    context.cleanup();
  }
});

test("durable-event-bus retry loop: first attempt fails, second succeeds", async () => {
  const context = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(context.db);
    const bus = new DurableEventBus(context.db, store);
    seedTaskAndExecution(context.db, store, { taskId: "task-first-fail", executionId: "exec-first-fail", traceId: "trace-first-fail" });

    let attemptCount = 0;
    const delivered: string[] = [];

    bus.subscribe("inspect_projection", async (event) => {
      attemptCount++;
      if (attemptCount === 1) {
        throw new Error("Temporary failure on first attempt");
      }
      delivered.push(event.id);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-first-fail",
      executionId: "exec-first-fail",
      traceId: "trace-first-fail",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for delivery and retry
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Should succeed on second attempt after first fails
    assert.equal(delivered.length, 1, "Event should be delivered after successful retry");
    assert.equal(attemptCount, 2, "Should have exactly 2 attempts (1 failure + 1 success)");

    bus.dispose();
  } finally {
    context.cleanup();
  }
});

test("durable-event-bus retry loop: all 3 attempts fail triggers dead-letter", async () => {
  const context = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(context.db);
    const bus = new DurableEventBus(context.db, store);
    seedTaskAndExecution(context.db, store, { taskId: "task-all-fail", executionId: "exec-all-fail", traceId: "trace-all-fail" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      throw new Error("Permanent failure");
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-all-fail",
      executionId: "exec-all-fail",
      traceId: "trace-all-fail",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete
    await new Promise((resolve) => setTimeout(resolve, 2500));

    // All 3 attempts should have been made
    assert.equal(attemptCount, 3, `Expected exactly 3 attempts before dead-letter, got ${attemptCount}`);

    // Event should be dead-lettered (removed from pending queue)
    const pending = bus.pendingForConsumer("inspect_projection");
    const deadLettered = pending.filter((p) => p.event.id === event.id);
    assert.equal(deadLettered.length, 0, "Event should be dead-lettered after exhausting retries");

    bus.dispose();
  } finally {
    context.cleanup();
  }
});

test("durable-event-bus retry loop: backoff delay increases between attempts", async () => {
  const context = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(context.db);
    const bus = new DurableEventBus(context.db, store);
    seedTaskAndExecution(context.db, store, { taskId: "task-backoff", executionId: "exec-backoff", traceId: "trace-backoff" });

    const attemptTimestamps: number[] = [];

    bus.subscribe("inspect_projection", async (_event) => {
      attemptTimestamps.push(Date.now());
      throw new Error("Temporary failure");
    });

    const startTime = Date.now();
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-backoff",
      executionId: "exec-backoff",
      traceId: "trace-backoff",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for all retries to complete
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // We should have exactly 3 attempts
    assert.equal(attemptTimestamps.length, 3, `Expected exactly 3 attempts, got ${attemptTimestamps.length}`);

    // The backoff should be increasing (exponential backoff)
    const delay1to2 = attemptTimestamps[1]! - attemptTimestamps[0]!;
    const delay2to3 = attemptTimestamps[2]! - attemptTimestamps[1]!;

    // Second delay should be larger than first (exponential backoff)
    assert.ok(delay2to3 > delay1to2, `Expected increasing backoff: ${delay1to2}ms then ${delay2to3}ms`);

    bus.dispose();
  } finally {
    context.cleanup();
  }
});

test("durable-event-bus retry loop: successful delivery does not dead-letter", async () => {
  const context = initHaCoordinatorForTests();

  try {
    const store = new AuthoritativeTaskStore(context.db);
    const bus = new DurableEventBus(context.db, store);
    seedTaskAndExecution(context.db, store, { taskId: "task-success", executionId: "exec-success", traceId: "trace-success" });

    let attemptCount = 0;

    bus.subscribe("inspect_projection", async (_event) => {
      attemptCount++;
      // Always succeed
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-success",
      executionId: "exec-success",
      traceId: "trace-success",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for delivery
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Should have exactly 1 attempt (succeeded on first try)
    assert.equal(attemptCount, 1, "Should have exactly 1 attempt on successful delivery");
    assert.equal(attemptCount, 1, "No retries needed for successful delivery");

    bus.dispose();
  } finally {
    context.cleanup();
  }
});
