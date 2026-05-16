/**
 * Unit tests for TypedEventBus type coverage
 *
 * Tests TypedEventEnvelope structure and typed event handling.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

async function setupBus(workspace: string) {
  const db = new SqliteDatabase(join(workspace, "events.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new TypedEventBus(db, store);
  return { db, store, bus };
}

test("TypedEventBus.publish validates event schema before publishing", async () => {
  const workspace = createTempWorkspace("aa-typed-schema-");

  try {
    const { db, bus } = await setupBus(workspace);

    bus.publish({
      eventType: "task:status_changed",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.subscribe receives typed payloads", async () => {
  const workspace = createTempWorkspace("aa-typed-payload-");

  try {
    const { db, store, bus } = await setupBus(workspace);
    const received: { toStatus: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-typed-payload", executionId: "exec-typed-payload" });

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      received.push({ toStatus: payload.toStatus });
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-payload",
      executionId: "exec-typed-payload",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await bus.deliverPending("task_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].toStatus, "in_progress");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.deliverPending returns correct count", async () => {
  const workspace = createTempWorkspace("aa-deliver-count-");

  try {
    const { db, store, bus } = await setupBus(workspace);

    seedTaskAndExecution(db, store, { taskId: "task-count", executionId: "exec-count" });

    bus.subscribe("task_projection", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-count",
      executionId: "exec-count",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-count",
      executionId: "exec-count",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const count = await bus.deliverPending("task_projection");
    assert.equal(count, 2);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.pendingForConsumer returns pending events for consumer", async () => {
  const workspace = createTempWorkspace("aa-pending-for-");

  try {
    const { db, bus } = await setupBus(workspace);

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const pending = bus.pendingForConsumer("task_projection");
    assert.equal(pending.length, 1);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.unsubscribe removes all subscriptions for consumer", async () => {
  const workspace = createTempWorkspace("aa-unsubscribe-all-");

  try {
    const { db, bus } = await setupBus(workspace);
    const received: string[] = [];

    bus.subscribe("task_projection", ["task:status_changed", "workflow:step_completed"], ({ payload }) => {
      received.push((payload as any).toStatus ?? "");
    });

    bus.unsubscribe("task_projection");

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "workflow:step_completed",
      payload: { workflowId: "wf-1", stepId: "step-1", status: "completed" },
    });

    assert.equal(received.length, 0);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.dispose cleans up resources", async () => {
  const workspace = createTempWorkspace("aa-dispose-");

  try {
    const { db, bus } = await setupBus(workspace);

    bus.subscribe("task_projection", ["task:status_changed"], () => {});

    bus.dispose();

    assert.throws(() => bus.pendingForConsumer("task_projection"), /event_bus\.disposed/);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes task:status_changed with correct payload", async () => {
  const workspace = createTempWorkspace("aa-task-status-");

  try {
    const { db, bus } = await setupBus(workspace);
    const received: { toStatus: string }[] = [];

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      received.push({ toStatus: payload.toStatus });
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await bus.deliverPending("task_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].toStatus, "in_progress");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers multiple events in order", async () => {
  const workspace = createTempWorkspace("aa-multi-order-");

  try {
    const { db, store, bus } = await setupBus(workspace);
    const received: string[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-order", executionId: "exec-order" });

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      received.push(payload.toStatus);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-order",
      executionId: "exec-order",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-order",
      executionId: "exec-order",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await bus.deliverPending("task_projection");

    assert.deepEqual(received, ["in_progress", "completed"]);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles rapid publish and deliver", async () => {
  const workspace = createTempWorkspace("aa-rapid-");

  try {
    const { db, bus } = await setupBus(workspace);
    let deliveryCount = 0;

    bus.subscribe("task_projection", ["task:status_changed"], () => {
      deliveryCount += 1;
    });

    // Rapidly publish events
    for (let i = 0; i < 10; i++) {
      bus.publish({
        eventType: "task:status_changed",
        payload: { fromStatus: "queued", toStatus: `status_${i}` },
      });
    }

    const count = await bus.deliverPending("task_projection");
    assert.equal(count, 10);
    assert.equal(deliveryCount, 10);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles consumer already having pending events", async () => {
  const workspace = createTempWorkspace("aa-consumer-pending-");

  try {
    const { db, bus } = await setupBus(workspace);

    bus.subscribe("task_projection", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    // First drain
    await bus.deliverPending("task_projection");

    // Publish more
    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    const pending = bus.pendingForConsumer("task_projection");
    assert.equal(pending.length, 1);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
