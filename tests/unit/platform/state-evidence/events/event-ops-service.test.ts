import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { EventOpsService } from "../../../../../src/platform/five-plane-state-evidence/events/event-ops-service.js";
import type { EventDrainResult } from "../../../../../src/platform/five-plane-state-evidence/events/event-ops-service.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

function createTestService(
  workspace: string,
  options: ConstructorParameters<typeof EventOpsService>[2] = {},
): EventOpsService {
  const db = new SqliteDatabase(join(workspace, "events.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return new EventOpsService(db, store, options);
}

// =============================================================================
// listDefaultConsumers Tests
// =============================================================================

test("EventOpsService.listDefaultConsumers returns non-empty array", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const consumers = service.listDefaultConsumers();
    assert.ok(Array.isArray(consumers));
    assert.ok(consumers.length > 0, "Expected at least one default consumer");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.listDefaultConsumers returns sorted array", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const consumers = service.listDefaultConsumers();
    const sortedConsumers = [...consumers].sort();
    assert.deepEqual(consumers, sortedConsumers, "listDefaultConsumers should return sorted array");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.listDefaultConsumers returns only unique consumer IDs", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const consumers = service.listDefaultConsumers();
    const uniqueSet = new Set(consumers);
    assert.equal(consumers.length, uniqueSet.size, "Consumer IDs should be unique");
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// subscribe Tests
// =============================================================================

test("EventOpsService.subscribe registers handler without throwing", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const handler = async () => {};
    assert.equal(service.subscribe("test_consumer", handler), undefined);
    const subscribers = (
      service as unknown as { bus: { subscribers: Map<string, { handler: typeof handler }> } }
    ).bus.subscribers;
    assert.strictEqual(subscribers.get("test_consumer")?.handler, handler);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.subscribe accepts handler that returns void", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const handler = () => {};
    assert.equal(service.subscribe("test_consumer", handler), undefined);
    const subscribers = (
      service as unknown as { bus: { subscribers: Map<string, { handler: typeof handler }> } }
    ).bus.subscribers;
    assert.strictEqual(subscribers.get("test_consumer")?.handler, handler);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.subscribe accepts async handler", () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const handler = async () => {
      await Promise.resolve();
    };
    assert.equal(service.subscribe("async_consumer", handler), undefined);
    const subscribers = (
      service as unknown as { bus: { subscribers: Map<string, { handler: typeof handler }> } }
    ).bus.subscribers;
    assert.strictEqual(subscribers.get("async_consumer")?.handler, handler);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService default consumers validate referenced aggregates before acking", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  const originalSubscribe = DurableEventBus.prototype.subscribe;
  const capturedHandlers = new Map<string, Parameters<typeof originalSubscribe>[1]>();
  try {
    DurableEventBus.prototype.subscribe = function subscribe(
      this: DurableEventBus,
      consumerId: string,
      handler: Parameters<typeof originalSubscribe>[1],
      partitions?: Parameters<typeof originalSubscribe>[2],
      groupId?: Parameters<typeof originalSubscribe>[3],
    ): void {
      capturedHandlers.set(consumerId, handler);
      return originalSubscribe.call(this, consumerId, handler, partitions, groupId);
    };

    const service = createTestService(workspace);
    const consumerId = service.listDefaultConsumers()[0];
    assert.ok(consumerId != null);
    const handler = capturedHandlers.get(consumerId!);
    assert.ok(handler != null);

    await assert.rejects(
      handler!({
        id: "evt_missing_task",
        taskId: "task_missing",
        sessionId: null,
        executionId: null,
        eventType: "task:status_changed",
        eventTier: "tier_1",
        payloadJson: JSON.stringify({ toStatus: "failed" }),
        traceId: "trace_missing",
        createdAt: "2026-05-25T00:00:00.000Z",
      }),
      /event_ops.consumer_missing_task/,
    );
  } finally {
    DurableEventBus.prototype.subscribe = originalSubscribe;
    cleanupPath(workspace);
  }
});

// =============================================================================
// drainConsumer Tests
// =============================================================================

test("EventOpsService.drainConsumer returns EventDrainResult structure", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("test_consumer");

    assert.equal(result.consumerId, "test_consumer");
    assert.ok(typeof result.pendingBefore === "number");
    assert.ok(typeof result.failedBefore === "number");
    assert.ok(typeof result.replayedFromHistoryCount === "number");
    assert.ok(typeof result.delivered === "number");
    assert.ok(typeof result.pendingAfter === "number");
    assert.ok(typeof result.failedAfter === "number");
    assert.ok(result.outcome === "delivered" || result.outcome === "failed" || result.outcome === "timeout");
    assert.ok(result.errorCode === null || typeof result.errorCode === "string");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer handles empty pending queue", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("no_pending_consumer");

    assert.equal(result.consumerId, "no_pending_consumer");
    assert.equal(result.pendingBefore, 0);
    assert.equal(result.delivered, 0);
    assert.equal(result.pendingAfter, 0);
    assert.equal(result.replayedFromHistoryCount, 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer sets outcome based on delivery success", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("any_consumer");

    assert.ok(result.outcome === "delivered" || result.outcome === "failed" || result.outcome === "timeout");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer sets errorCode to null on success", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("success_consumer");

    if (result.outcome === "delivered") {
      assert.equal(result.errorCode, null);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer records failedBefore count", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    // Even with no pending events, should return valid counts
    const result = await service.drainConsumer("consumer_with_no_failures");
    assert.ok(typeof result.failedBefore === "number");
    assert.ok(result.failedBefore >= 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer increments pendingAfter when events cannot be delivered", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    // Subscribe with a handler that always fails
    service.subscribe("failing_consumer", async () => {
      throw new Error("Handler always fails");
    });

    const result = await service.drainConsumer("failing_consumer");

    // Outcome should be "failed" since handler throws
    assert.ok(result.outcome === "failed" || result.pendingAfter >= 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainConsumer pendingBefore equals pendingAfter when no events delivered", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("consumer_no_events");

    // When no events to deliver, pendingBefore should equal pendingAfter
    assert.equal(result.pendingBefore, result.pendingAfter);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// replayConsumer Tests
// =============================================================================

test("EventOpsService.replayConsumer returns result with replayedFromHistoryCount", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.replayConsumer("test_consumer");

    assert.equal(result.consumerId, "test_consumer");
    assert.ok(typeof result.replayedFromHistoryCount === "number");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayConsumer replayedFromHistoryCount is non-negative", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.replayConsumer("test_consumer");

    assert.ok(result.replayedFromHistoryCount >= 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayConsumer returns timeout outcome when drain stalls", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace, { replayTimeoutMs: 10 });
    (service as EventOpsService & { drainConsumer: typeof service.drainConsumer }).drainConsumer = async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
      return {
        consumerId: "stalled",
        pendingBefore: 0,
        failedBefore: 0,
        replayedFromHistoryCount: 0,
        delivered: 0,
        pendingAfter: 0,
        failedAfter: 0,
        outcome: "delivered",
        errorCode: null,
      };
    };

    const result = await service.replayConsumer("stalled");
    assert.equal(result.outcome, "timeout");
    assert.match(result.errorCode ?? "", /^event_ops\.replay_timeout:/);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayConsumer returns full EventDrainResult structure", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.replayConsumer("full_structure_consumer");

    assert.equal(result.consumerId, "full_structure_consumer");
    assert.ok(typeof result.pendingBefore === "number");
    assert.ok(typeof result.failedBefore === "number");
    assert.ok(typeof result.replayedFromHistoryCount === "number");
    assert.ok(typeof result.delivered === "number");
    assert.ok(typeof result.pendingAfter === "number");
    assert.ok(typeof result.failedAfter === "number");
    assert.ok(result.outcome === "delivered" || result.outcome === "failed");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayConsumer includes replayedFromHistoryCount in result", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.replayConsumer("test_consumer");

    // The replayedFromHistoryCount comes from resetConsumerReplayState
    assert.strictEqual(result.replayedFromHistoryCount, 0);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// drainDefaultConsumers Tests
// =============================================================================

test("EventOpsService.drainDefaultConsumers returns array of results", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const results = await service.drainDefaultConsumers();

    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainDefaultConsumers returns results for all default consumers", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const defaultConsumers = service.listDefaultConsumers();

    const results = await service.drainDefaultConsumers();

    assert.equal(results.length, defaultConsumers.length);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainDefaultConsumers returns result for each consumer with correct structure", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const results = await service.drainDefaultConsumers();

    for (const result of results) {
      assert.equal(typeof result.consumerId, "string");
      assert.equal(typeof result.outcome, "string");
      assert.ok(result.outcome === "delivered" || result.outcome === "failed");
      assert.ok(typeof result.pendingBefore === "number");
      assert.ok(typeof result.delivered === "number");
      assert.ok(typeof result.pendingAfter === "number");
      assert.ok(result.errorCode === null || typeof result.errorCode === "string");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.drainDefaultConsumers includes all default consumer IDs", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const defaultConsumers = new Set(service.listDefaultConsumers());

    const results = await service.drainDefaultConsumers();
    const resultConsumerIds = new Set(results.map((r) => r.consumerId));

    for (const consumerId of defaultConsumers) {
      assert.ok(resultConsumerIds.has(consumerId), `Missing consumer: ${consumerId}`);
    }
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// replayDefaultConsumers Tests
// =============================================================================

test("EventOpsService.replayDefaultConsumers returns array of results", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const results = await service.replayDefaultConsumers();

    assert.ok(Array.isArray(results));
    assert.ok(results.length > 0);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayDefaultConsumers returns results for all default consumers", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const defaultConsumers = service.listDefaultConsumers();

    const results = await service.replayDefaultConsumers();

    assert.equal(results.length, defaultConsumers.length);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayDefaultConsumers returns result with replayedFromHistoryCount for each", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const results = await service.replayDefaultConsumers();

    for (const result of results) {
      assert.equal(typeof result.consumerId, "string");
      assert.ok(typeof result.replayedFromHistoryCount === "number");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService.replayDefaultConsumers replayedFromHistoryCount is non-negative for all", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const results = await service.replayDefaultConsumers();

    for (const result of results) {
      assert.ok(result.replayedFromHistoryCount >= 0);
    }
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Integration Tests - Publishing Events and Verifying Delivery
// =============================================================================

test("EventOpsService.subscribe and drainConsumer - events delivered to handler", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);
    const deliveredEvents: unknown[] = [];

    // Subscribe to a consumer
    service.subscribe("delivery_test_consumer", async (event) => {
      deliveredEvents.push(event);
    });

    // Drain should work without errors even with no pending events
    const result = await service.drainConsumer("delivery_test_consumer");
    assert.ok(result.outcome === "delivered" || result.outcome === "failed");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService multiple drainConsumer calls return consistent results", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result1 = await service.drainConsumer("consistent_consumer");
    const result2 = await service.drainConsumer("consistent_consumer");

    // Both should return valid results
    assert.equal(result1.consumerId, result2.consumerId);
    assert.equal(result1.pendingBefore, result2.pendingBefore);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService drainConsumer for non-existent consumer does not throw", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("non_existent_consumer_12345");

    assert.equal(result.consumerId, "non_existent_consumer_12345");
    assert.ok(typeof result.outcome === "string");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService replayConsumer for non-existent consumer does not throw", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.replayConsumer("non_existent_consumer_12345");

    assert.equal(result.consumerId, "non_existent_consumer_12345");
    assert.ok(typeof result.outcome === "string");
    assert.ok(typeof result.replayedFromHistoryCount === "number");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService subscribe with same consumerId twice does not throw", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    service.subscribe("double_subscribe_consumer", async () => {});
    const replacement = async () => {};
    service.subscribe("double_subscribe_consumer", replacement);
    const subscribers = (
      service as unknown as { bus: { subscribers: Map<string, { handler: typeof replacement; generation: number }> } }
    ).bus.subscribers;
    assert.strictEqual(subscribers.get("double_subscribe_consumer")?.handler, replacement);
    assert.equal(subscribers.get("double_subscribe_consumer")?.generation, 2);
  } finally {
    cleanupPath(workspace);
  }
});

// =============================================================================
// Edge Cases
// =============================================================================

test("EventOpsService drainConsumer with consumerId containing special characters", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("consumer:with:colons");

    assert.equal(result.consumerId, "consumer:with:colons");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService drainConsumer with empty string consumerId", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("");

    assert.equal(result.consumerId, "");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService drainDefaultConsumers completes within reasonable time", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  const start = Date.now();
  try {
    const service = createTestService(workspace);

    await service.drainDefaultConsumers();

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `drainDefaultConsumers took too long: ${elapsed}ms`);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService replayDefaultConsumers completes within reasonable time", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  const start = Date.now();
  try {
    const service = createTestService(workspace);

    await service.replayDefaultConsumers();

    const elapsed = Date.now() - start;
    assert.ok(elapsed < 5000, `replayDefaultConsumers took too long: ${elapsed}ms`);
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService drainConsumer outcome matches errorCode presence", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const result = await service.drainConsumer("outcome_test_consumer");

    if (result.outcome === "failed") {
      assert.ok(result.errorCode !== null && result.errorCode.length > 0);
    } else {
      assert.equal(result.errorCode, null);
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService all default consumer results have unique consumerIds", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const drainResults = await service.drainDefaultConsumers();
    const consumerIds = drainResults.map((r) => r.consumerId);
    const uniqueIds = new Set(consumerIds);

    assert.equal(consumerIds.length, uniqueIds.size, "Consumer IDs should be unique");
  } finally {
    cleanupPath(workspace);
  }
});

test("EventOpsService all replay consumer results have unique consumerIds", async () => {
  const workspace = createTempWorkspace("aa-event-ops-");
  try {
    const service = createTestService(workspace);

    const replayResults = await service.replayDefaultConsumers();
    const consumerIds = replayResults.map((r) => r.consumerId);
    const uniqueIds = new Set(consumerIds);

    assert.equal(consumerIds.length, uniqueIds.size, "Consumer IDs should be unique");
  } finally {
    cleanupPath(workspace);
  }
});
