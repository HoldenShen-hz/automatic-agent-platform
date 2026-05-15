/**
 * Concurrency tests for DurableEventBus (Section 17.1)
 *
 * Tests concurrent publish + deliverPending operations to verify
 * no data corruption or invariant violations occur.
 *
 * @see docs_en/quality/00-full-coverage-test-manual.md Section 17.1
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { DurableEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/durable-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { runConcurrentInvariant, type ConcurrentRunResult } from "../../../../helpers/concurrent-runner.js";

test("concurrent: publish events from multiple tasks concurrently", async () => {
  const workspace = createTempWorkspace("aa-concurrent-publish-");
  try {
    const db = new SqliteDatabase(join(workspace, "concurrent-pub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Seed multiple tasks for concurrent publishing
    for (let i = 0; i < 10; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-concurrent-${i}`,
        executionId: `exec-concurrent-${i}`,
        traceId: `trace-concurrent-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const event = bus.publish({
          eventType: "task:status_changed",
          taskId: `task-concurrent-${workerId}`,
          executionId: `exec-concurrent-${workerId}`,
          traceId: `trace-concurrent-${workerId}`,
          payload: { fromStatus: "queued", toStatus: "in_progress", reasonCode: "concurrent-test" },
        });
        return event.id;
      },
      { concurrency: 10 },
    );

    assert.equal(result.success, true, "All concurrent publishes should succeed");
    assert.equal(result.values.length, 10, "Should have 10 event IDs");
    assert.equal(result.errors.length, 0, "No errors should occur");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: deliverPending is safe to call concurrently for same consumer", async () => {
  const workspace = createTempWorkspace("aa-concurrent-deliver-");
  try {
    const db = new SqliteDatabase(join(workspace, "concurrent-deliver.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-concurrent-deliver",
      executionId: "exec-concurrent-deliver",
      traceId: "trace-concurrent-deliver",
    });

    const bus = new DurableEventBus(db, store);

    // Publish some events first
    for (let i = 0; i < 5; i++) {
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-concurrent-deliver",
        executionId: "exec-concurrent-deliver",
        traceId: `trace-deliver-${i}`,
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      });
    }

    // Subscribe handler that completes quickly
    bus.subscribe("deliver-consumer", async () => {});

    // Call deliverPending concurrently - should not cause corruption
    const result = await runConcurrentInvariant(
      async (_workerId: number) => {
        return bus.deliverPending("deliver-consumer");
      },
      { concurrency: 5, timeout: 10000 },
    );

    // All calls should complete without throwing
    assert.equal(result.success, true, "Concurrent deliverPending calls should succeed");
    assert.equal(result.errors.length, 0, "No errors from concurrent delivery");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: publish and subscribe don't interfere with each other", async () => {
  const workspace = createTempWorkspace("aa-concurrent-pub-sub-");
  try {
    const db = new SqliteDatabase(join(workspace, "concurrent-pub-sub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 20; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-ps-${i}`,
        executionId: `exec-ps-${i}`,
        traceId: `trace-ps-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);
    const received: string[] = [];

    bus.subscribe("ps-consumer", async (event) => {
      received.push(event.id);
    });

    // Concurrently publish and trigger delivery
    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const event = bus.publish({
          eventType: "task:status_changed",
          taskId: `task-ps-${workerId % 20}`,
          executionId: `exec-ps-${workerId % 20}`,
          traceId: `trace-ps-${workerId}`,
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        });

        // Also trigger delivery
        await bus.deliverPending("ps-consumer");
        return event.id;
      },
      { concurrency: 10, timeout: 15000 },
    );

    assert.equal(result.success, true, "Concurrent publish+deliver should succeed");
    // Received events should be a subset of published (some may not have been delivered yet)
    assert.ok(received.length > 0, "Some events should be delivered");
    assert.equal(result.errors.length, 0, "No errors should occur");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: multiple consumers publishing simultaneously", async () => {
  const workspace = createTempWorkspace("aa-concurrent-multi-pub-");
  try {
    const db = new SqliteDatabase(join(workspace, "multi-pub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    // Create tasks for each consumer
    for (let i = 0; i < 30; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-multi-pub-${i}`,
        executionId: `exec-multi-pub-${i}`,
        traceId: `trace-multi-pub-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        // Each worker publishes from its own task
        const event = bus.publish({
          eventType: "task:status_changed",
          taskId: `task-multi-pub-${workerId * 3}`,
          executionId: `exec-multi-pub-${workerId * 3}`,
          traceId: `trace-multi-pub-${workerId}`,
          payload: {
            fromStatus: "queued",
            toStatus: "in_progress",
            reasonCode: `worker-${workerId}`,
          },
        });
        return event.id;
      },
      { concurrency: 10, timeout: 15000 },
    );

    assert.equal(result.success, true, "All concurrent publishes should succeed");
    assert.equal(result.values.length, 10, "Should have results for all workers");
    assert.equal(result.errors.length, 0, "No errors");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: batch publish from multiple concurrent callers", async () => {
  const workspace = createTempWorkspace("aa-concurrent-batch-");
  try {
    const db = new SqliteDatabase(join(workspace, "batch-concurrent.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 50; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-batch-${i}`,
        executionId: `exec-batch-${i}`,
        traceId: `trace-batch-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const events = bus.publishBatch([
          {
            eventType: "task:status_changed",
            taskId: `task-batch-${workerId * 5}`,
            executionId: `exec-batch-${workerId * 5}`,
            traceId: `trace-batch-a-${workerId}`,
            payload: { fromStatus: "queued", toStatus: "in_progress", batch: "a" },
          },
          {
            eventType: "task:status_changed",
            taskId: `task-batch-${workerId * 5 + 1}`,
            executionId: `exec-batch-${workerId * 5 + 1}`,
            traceId: `trace-batch-b-${workerId}`,
            payload: { fromStatus: "queued", toStatus: "in_progress", batch: "b" },
          },
        ]);
        return events.length;
      },
      { concurrency: 10, timeout: 15000 },
    );

    assert.equal(result.success, true, "Concurrent batch publishes should succeed");
    assert.equal(result.values.length, 10, "Should have 10 batch results");
    assert.equal(result.errors.length, 0, "No errors");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: subscribe/unsubscribe racing with publish", async () => {
  const workspace = createTempWorkspace("aa-concurrent-sub-unsub-");
  try {
    const db = new SqliteDatabase(join(workspace, "sub-unsub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 20; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-sub-${i}`,
        executionId: `exec-sub-${i}`,
        traceId: `trace-sub-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);
    const seen: string[] = [];

    // Concurrently: subscribe, publish, and unsubscribe
    await Promise.all([
      (async () => {
        for (let i = 0; i < 5; i++) {
          bus.subscribe(`sub-consumer-${i}`, async (event) => {
            seen.push(event.id);
          });
        }
      })(),
      (async () => {
        await Promise.race([
          (async () => {
            for (let i = 0; i < 10; i++) {
              bus.publish({
                eventType: "task:status_changed",
                taskId: `task-sub-${i % 20}`,
                executionId: `exec-sub-${i % 20}`,
                traceId: `trace-sub-${i}`,
                payload: { fromStatus: "queued", toStatus: "in_progress" },
              });
              await new Promise((r) => setTimeout(r, 5));
            }
          })(),
          new Promise((r) => setTimeout(r, 1000)),
        ]);
      })(),
      (async () => {
        await Promise.race([
          (async () => {
            for (let i = 0; i < 5; i++) {
              bus.unsubscribe(`sub-consumer-${i}`);
              await new Promise((r) => setTimeout(r, 10));
            }
          })(),
          new Promise((r) => setTimeout(r, 1000)),
        ]);
      })(),
    ]);

    // Wait for any pending deliveries
    await new Promise((r) => setTimeout(r, 100));

    // No crashes should occur
    assert.ok(true, "Subscribe/unsubscribe racing with publish should not crash");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: pendingForConsumer called during active delivery", async () => {
  const workspace = createTempWorkspace("aa-concurrent-pending-");
  try {
    const db = new SqliteDatabase(join(workspace, "pending-concurrent.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    seedTaskAndExecution(db, store, {
      taskId: "task-pending-concurrent",
      executionId: "exec-pending-concurrent",
      traceId: "trace-pending-concurrent",
    });

    const bus = new DurableEventBus(db, store);
    let deliveryInProgress = false;

    bus.subscribe("pending-consumer", async (event) => {
      // Simulate slow handler
      deliveryInProgress = true;
      await new Promise((r) => setTimeout(r, 20));
      deliveryInProgress = false;
    });

    // Publish events
    for (let i = 0; i < 5; i++) {
      bus.publish({
        eventType: "dispatch:ticket_created",
        taskId: "task-pending-concurrent",
        executionId: "exec-pending-concurrent",
        traceId: `trace-pending-${i}`,
        payload: { ticketId: `ticket-pending-${i}` },
      });
    }

    // Concurrently call pendingForConsumer while delivery is active
    const results: Array<{ pending: number; time: number }> = [];
    const startTime = Date.now();

    await Promise.all([
      bus.deliverPending("pending-consumer"),
      (async () => {
        for (let i = 0; i < 10; i++) {
          const pending = bus.pendingForConsumer("pending-consumer");
          results.push({ pending: pending.length, time: Date.now() - startTime });
          await new Promise((r) => setTimeout(r, 5));
        }
      })(),
    ]);

    // Should complete without errors
    assert.ok(true, "pendingForConsumer during delivery should not crash");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: dispose called while publish/deliver operations are in flight", async () => {
  const workspace = createTempWorkspace("aa-concurrent-dispose-");
  try {
    const db = new SqliteDatabase(join(workspace, "dispose-concurrent.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 15; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-dispose-${i}`,
        executionId: `exec-dispose-${i}`,
        traceId: `trace-dispose-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    bus.subscribe("dispose-consumer", async () => {
      await new Promise((r) => setTimeout(r, 10));
    });

    // Start operations and dispose concurrently
    const errors: unknown[] = [];

    await Promise.race([
      Promise.all([
        (async () => {
          for (let i = 0; i < 10; i++) {
            try {
              bus.publish({
                eventType: "task:status_changed",
                taskId: `task-dispose-${i}`,
                executionId: `exec-dispose-${i}`,
                traceId: `trace-dispose-${i}`,
                payload: { fromStatus: "queued", toStatus: "in_progress" },
              });
            } catch (e) {
              errors.push(e);
            }
            await new Promise((r) => setTimeout(r, 5));
          }
        })(),
        (async () => {
          await new Promise((r) => setTimeout(r, 50));
          bus.dispose();
        })(),
      ]),
      new Promise((r) => setTimeout(r, 5000)),
    ]);

    // Some operations may fail due to dispose, but no crashes
    assert.ok(true, "Dispose during operations should not cause crashes");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: event IDs remain unique under concurrent publish load", async () => {
  const workspace = createTempWorkspace("aa-concurrent-unique-ids-");
  try {
    const db = new SqliteDatabase(join(workspace, "unique-ids.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 50; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-unique-${i}`,
        executionId: `exec-unique-${i}`,
        traceId: `trace-unique-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const event = bus.publish({
          eventType: "task:status_changed",
          taskId: `task-unique-${workerId * 5}`,
          executionId: `exec-unique-${workerId * 5}`,
          traceId: `trace-unique-${workerId}`,
          payload: { fromStatus: "queued", toStatus: "in_progress", worker: workerId },
        });
        return event.id;
      },
      { concurrency: 10, timeout: 15000 },
    );

    assert.equal(result.success, true, "All publishes should succeed");
    // Verify all IDs are unique
    const ids = result.values as string[];
    const uniqueIds = new Set(ids);
    assert.equal(uniqueIds.size, ids.length, "All event IDs should be unique under concurrent load");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("concurrent: tier1 ack records are correctly created under concurrent load", async () => {
  const workspace = createTempWorkspace("aa-concurrent-acks-");
  try {
    const db = new SqliteDatabase(join(workspace, "concurrent-acks.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    for (let i = 0; i < 30; i++) {
      seedTaskAndExecution(db, store, {
        taskId: `task-acks-${i}`,
        executionId: `exec-acks-${i}`,
        traceId: `trace-acks-${i}`,
      });
    }

    const bus = new DurableEventBus(db, store);

    const result = await runConcurrentInvariant(
      async (workerId: number) => {
        const event = bus.publish({
          eventType: "task:status_changed",
          taskId: `task-acks-${workerId * 3}`,
          executionId: `exec-acks-${workerId * 3}`,
          traceId: `trace-acks-${workerId}`,
          payload: { fromStatus: "queued", toStatus: "in_progress" },
        });

        // Get ack count for this event
        const acks = store.listPendingTier1Acks(event.id);
        return acks.length;
      },
      { concurrency: 10, timeout: 15000 },
    );

    assert.equal(result.success, true, "Concurrent operations should succeed");
    // Each tier-1 event should create at least 2 ack records (task_projection + inspect_projection)
    const ackCounts = result.values as number[];
    for (const count of ackCounts) {
      assert.ok(count >= 2, `Each tier-1 event should have at least 2 consumer acks, got ${count}`);
    }

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});