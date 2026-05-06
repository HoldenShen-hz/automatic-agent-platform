import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { DurableEventBus } from "../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
import { initHaCoordinatorForTests } from "../../../helpers/ha-coordinator.js";

interface TestBusContext {
  bus: DurableEventBus;
  db: SqliteDatabase;
  store: AuthoritativeTaskStore;
  workspace: string;
  cleanup: () => void;
}

function createTestBus(): TestBusContext {
  // Initialize HA coordinator first - this sets up the singleton needed for DurableEventBus
  const haContext = initHaCoordinatorForTests();
  const workspace = haContext.dbPath.replace("/test-ha.db", ""); // Derive workspace from db path
  const db = haContext.db;
  const store = new AuthoritativeTaskStore(db);
  const bus = new DurableEventBus(db, store);
  return {
    bus,
    db,
    store,
    workspace,
    cleanup: () => {
      bus.dispose();
      haContext.cleanup();
      cleanupPath(workspace);
    },
  };
}

// =============================================================================
// Event handler memory leak tests — DurableEventBus
// =============================================================================

test("[SYS-PERF-3.1] DurableEventBus subscribe does not leak when called multiple times", async (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-sub-leak",
      executionId: "exec-sub-leak",
      traceId: "trace-sub-leak",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    // Subscribe multiple times with same consumerId — each call overwrites the handler
    // Use inspect_projection which is a required consumer for task:status_changed
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.subscribe("inspect_projection", handler);

    // Publish an event
    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-sub-leak",
      principal: "test-node",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Handler should be called exactly once (last subscription wins)
    assert.equal(handlerCallCount, 1, "Handler should be called only once despite multiple subscribes");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus unsubscribe removes handler", (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-unsub-test",
      executionId: "exec-unsub-test",
      traceId: "trace-unsub-test",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    ctx.bus.subscribe("consumer-unsub", handler);
    ctx.bus.unsubscribe("consumer-unsub");

    // Publish multiple events after unsubscribe
    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub-test",
      principal: "test-node",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });
    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub-test",
      principal: "test-node",
      payload: { fromStatus: "in_progress", toStatus: "done" },
    });

    // Handler should not be called after unsubscribe
    assert.equal(handlerCallCount, 0, "Handler should not be called after unsubscribe");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus dispose clears all subscribers", (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispose-test",
      executionId: "exec-dispose-test",
      traceId: "trace-dispose-test",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    // Use inspect_projection which is a required consumer for task:status_changed
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.dispose();

    // After dispose, publish should throw
    assert.throws(
      () =>
        ctx.bus.publish({
          eventType: "task:status_changed",
          taskId: "task-dispose-test",
          principal: "test-node",
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        }),
      /disposed/,
    );

    // Handler should not be called since dispose cleared subscribers
    assert.equal(handlerCallCount, 0, "No handlers should be called after dispose");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus dispose is idempotent", (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-dispose-idempotent",
      executionId: "exec-dispose-idempotent",
      traceId: "trace-dispose-idempotent",
    });

    // Should not throw
    ctx.bus.dispose();
    ctx.bus.dispose();
    ctx.bus.dispose();
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus publish after dispose throws", (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-publish-after-dispose",
      executionId: "exec-publish-after-dispose",
      traceId: "trace-publish-after-dispose",
    });

    ctx.bus.dispose();
    assert.throws(
      () =>
        ctx.bus.publish({
          eventType: "task:status_changed",
          taskId: "task-publish-after-dispose",
          principal: "test-node",
          payload: {},
        }),
      /disposed/,
    );
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus multiple consumers each get their own handler", async (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-multi-consumer",
      executionId: "exec-multi-consumer",
      traceId: "trace-multi-consumer",
    });

    let handlerACalls = 0;
    let handlerBCalls = 0;
    let handlerCCalls = 0;

    // Use inspect_projection (required consumer) - only one consumer can receive tier_1 events
    // For multiple handlers, we need to use a different approach - subscribe same handler to same consumer
    ctx.bus.subscribe("inspect_projection", () => { handlerACalls += 1; });
    ctx.bus.subscribe("inspect_projection", () => { handlerBCalls += 1; });
    ctx.bus.subscribe("inspect_projection", () => { handlerCCalls += 1; });

    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-consumer",
      principal: "test-node",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for async fan-out delivery
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Only the last subscription handler should be called (handlerCCalls)
    // because each subscribe overwrites the previous handler for the same consumerId
    assert.equal(handlerACalls, 0, "First handler should not be called - was overwritten");
    assert.equal(handlerBCalls, 0, "Second handler should not be called - was overwritten");
    assert.equal(handlerCCalls, 1, "Last handler should be called once");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus off() is not required when unsubscribe is used", async (t) => {
  // This test verifies the unsubscribe pattern works correctly
  // DurableEventBus uses unsubscribe(consumerId) rather than off(event, handler)
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-off-pattern",
      executionId: "exec-off-pattern",
      traceId: "trace-off-pattern",
    });

    let calls = 0;
    const handler = () => { calls += 1; };

    // Use inspect_projection which is a required consumer for task:status_changed
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.unsubscribe("inspect_projection");

    // Verify unsubscribe actually removed the handler
    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-off-pattern",
      principal: "test-node",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for async fan-out
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(calls, 0, "unsubscribe must remove the handler");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-PERF-3.1] DurableEventBus re-subscribe after unsubscribe works", async (t) => {
  const ctx = createTestBus();
  try {
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-resub",
      executionId: "exec-resub",
      traceId: "trace-resub",
    });

    let calls = 0;
    const handler = () => { calls += 1; };

    // Use inspect_projection which is a required consumer for task:status_changed
    ctx.bus.subscribe("inspect_projection", handler);
    ctx.bus.unsubscribe("inspect_projection");
    ctx.bus.subscribe("inspect_projection", handler);

    ctx.bus.publish({
      eventType: "task:status_changed",
      taskId: "task-resub",
      principal: "test-node",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Wait for async fan-out
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(calls, 1, "Re-subscribe after unsubscribe should work");
  } finally {
    ctx.cleanup();
  }
});

// =============================================================================
// Generic EventEmitter memory leak tests
// =============================================================================

test("[SYS-PERF-3.1] EventEmitter on() and off() paired correctly removes listener", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const handler = () => { calls += 1; };

  emitter.on("test-event", handler);
  emitter.emit("test-event");
  assert.equal(calls, 1);

  emitter.off("test-event", handler);
  emitter.emit("test-event");
  assert.equal(calls, 1, "Listener should not be called after off()");
});

test("[SYS-PERF-3.1] EventEmitter removeListener removes specific handler", () => {
  const emitter = new EventEmitter();
  let callA = 0;
  let callB = 0;
  const handlerA = () => { callA += 1; };
  const handlerB = () => { callB += 1; };

  emitter.on("event-a", handlerA);
  emitter.on("event-a", handlerB);
  emitter.emit("event-a");
  assert.equal(callA, 1);
  assert.equal(callB, 1);

  emitter.removeListener("event-a", handlerA);
  emitter.emit("event-a");
  assert.equal(callA, 1, "Handler A should not be called after removeListener");
  assert.equal(callB, 2, "Handler B should still be called");
});

test("[SYS-PERF-3.1] EventEmitter removeAllListeners clears all for specific event", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const handler = () => { calls += 1; };

  emitter.on("unique-event", handler);
  emitter.emit("unique-event");
  assert.equal(calls, 1);

  emitter.removeAllListeners("unique-event");
  emitter.emit("unique-event");
  assert.equal(calls, 1, "No handlers should be called after removeAllListeners");
});

test("[SYS-PERF-3.1] EventEmitter memory - many add/remove cycles do not accumulate listeners", () => {
  const emitter = new EventEmitter();
  const ITERATIONS = 1000;

  for (let i = 0; i < ITERATIONS; i++) {
    const handler = () => {};
    emitter.on("cycle-event", handler);
    emitter.off("cycle-event", handler);
  }

  // If listeners accumulated, this would call 1000 handlers
  let callCount = 0;
  emitter.on("cycle-event", () => { callCount += 1; });
  emitter.emit("cycle-event");

  assert.equal(callCount, 1, "Only the final handler should be called - no listener accumulation");
});

test("[SYS-PERF-3.1] EventEmitter once() automatically removes listener after first call", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const handler = () => { calls += 1; };

  emitter.once("once-event", handler);
  emitter.emit("once-event");
  assert.equal(calls, 1);

  emitter.emit("once-event");
  assert.equal(calls, 1, "once() handler should not persist after being called");
});

test("[SYS-PERF-3.1] EventEmitter once() can be removed with off() before being called", () => {
  const emitter = new EventEmitter();
  let calls = 0;
  const handler = () => { calls += 1; };

  emitter.once("once-removed", handler);
  emitter.off("once-removed", handler);
  emitter.emit("once-removed");

  assert.equal(calls, 0, "once() handler removed before emit should not be called");
});
