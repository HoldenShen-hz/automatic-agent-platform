import test from "node:test";
import assert from "node:assert/strict";
import { EventEmitter } from "node:events";

import { DurableEventBus } from "../../../../src/platform/state-evidence/events/durable-event-bus.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";

function createTestBus(): { bus: DurableEventBus; db: SqliteDatabase; store: AuthoritativeTaskStore; workspace: string } {
  const workspace = createTempWorkspace("event-bus-test-");
  const dbPath = `${workspace}/test.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new DurableEventBus(db, store);
  return { bus, db, store, workspace };
}

function cleanupBus(bus: DurableEventBus, db: SqliteDatabase, workspace: string): void {
  bus.dispose();
  db.close();
  cleanupPath(workspace);
}

// =============================================================================
// Event handler memory leak tests — DurableEventBus
// =============================================================================

test("[SYS-PERF-3.1] DurableEventBus subscribe does not leak when called multiple times", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-sub-leak",
      executionId: "exec-sub-leak",
      traceId: "trace-sub-leak",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    // Subscribe multiple times with same consumerId — each call overwrites the handler
    bus.subscribe("consumer-1", handler);
    bus.subscribe("consumer-1", handler);
    bus.subscribe("consumer-1", handler);

    // Publish an event
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-sub-leak",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // Handler should be called exactly once (last subscription wins)
    assert.equal(handlerCallCount, 1, "Handler should be called only once despite multiple subscribes");
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus unsubscribe removes handler", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-unsub-test",
      executionId: "exec-unsub-test",
      traceId: "trace-unsub-test",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    bus.subscribe("consumer-unsub", handler);
    bus.unsubscribe("consumer-unsub");

    // Publish multiple events after unsubscribe
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub-test",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub-test",
      payload: { fromStatus: "in_progress", toStatus: "done" },
    });

    // Handler should not be called after unsubscribe
    assert.equal(handlerCallCount, 0, "Handler should not be called after unsubscribe");
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus dispose clears all subscribers", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-dispose-test",
      executionId: "exec-dispose-test",
      traceId: "trace-dispose-test",
    });

    let handlerCallCount = 0;
    const handler = () => {
      handlerCallCount += 1;
    };

    bus.subscribe("consumer-a", handler);
    bus.subscribe("consumer-b", handler);
    bus.dispose();

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-dispose-test",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    assert.equal(handlerCallCount, 0, "No handlers should be called after dispose");
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus dispose is idempotent", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-dispose-idempotent",
      executionId: "exec-dispose-idempotent",
      traceId: "trace-dispose-idempotent",
    });

    // Should not throw
    bus.dispose();
    bus.dispose();
    bus.dispose();
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus publish after dispose throws", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-publish-after-dispose",
      executionId: "exec-publish-after-dispose",
      traceId: "trace-publish-after-dispose",
    });

    bus.dispose();
    assert.throws(
      () =>
        bus.publish({
          eventType: "task:status_changed",
          taskId: "task-publish-after-dispose",
          payload: {},
        }),
      /disposed/,
    );
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus multiple consumers each get their own handler", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-multi-consumer",
      executionId: "exec-multi-consumer",
      traceId: "trace-multi-consumer",
    });

    let handlerACalls = 0;
    let handlerBCalls = 0;
    let handlerCCalls = 0;

    bus.subscribe("consumer-A", () => { handlerACalls += 1; });
    bus.subscribe("consumer-B", () => { handlerBCalls += 1; });
    bus.subscribe("consumer-C", () => { handlerCCalls += 1; });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi-consumer",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    assert.equal(handlerACalls, 1);
    assert.equal(handlerBCalls, 1);
    assert.equal(handlerCCalls, 1);
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus off() is not required when unsubscribe is used", () => {
  // This test verifies the unsubscribe pattern works correctly
  // DurableEventBus uses unsubscribe(consumerId) rather than off(event, handler)
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-off-pattern",
      executionId: "exec-off-pattern",
      traceId: "trace-off-pattern",
    });

    let calls = 0;
    const handler = () => { calls += 1; };

    bus.subscribe("consumer-off", handler);
    bus.unsubscribe("consumer-off");

    // Verify unsubscribe actually removed the handler
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-off-pattern",
      payload: {},
    });

    assert.equal(calls, 0, "unsubscribe must remove the handler");
  } finally {
    cleanupBus(bus, db, workspace);
  }
});

test("[SYS-PERF-3.1] DurableEventBus re-subscribe after unsubscribe works", () => {
  const { bus, db, store, workspace } = createTestBus();
  try {
    seedTaskAndExecution(db, store, {
      taskId: "task-resub",
      executionId: "exec-resub",
      traceId: "trace-resub",
    });

    let calls = 0;
    const handler = () => { calls += 1; };

    bus.subscribe("consumer-resub", handler);
    bus.unsubscribe("consumer-resub");
    bus.subscribe("consumer-resub", handler);

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-resub",
      payload: {},
    });

    assert.equal(calls, 1, "Re-subscribe after unsubscribe should work");
  } finally {
    cleanupBus(bus, db, workspace);
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
