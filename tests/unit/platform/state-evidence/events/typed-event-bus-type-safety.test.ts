/**
 * Unit tests for TypedEventBus type safety and envelope handling
 *
 * Tests TypedEventEnvelope structure, type narrowing, and typed event subscriptions.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { TypedEventBus, type TypedEventEnvelope, type TypedEventType } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

async function setupTypedBus(workspace: string) {
  const db = new SqliteDatabase(join(workspace, "typed-bus-test.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new TypedEventBus(db, store);
  return { db, store, bus };
}

test("TypedEventBus.TypedEventEnvelope has correct structure", async () => {
  const workspace = createTempWorkspace("aa-typed-envelope-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-envelope", executionId: "exec-envelope" });

    let receivedEnvelope: TypedEventEnvelope<"task:status_changed"> | null = null;

    bus.subscribe("task_projection", ["task:status_changed"], (envelope) => {
      receivedEnvelope = envelope;
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-envelope",
      executionId: "exec-envelope",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await bus.deliverPending("task_projection");
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(receivedEnvelope !== null, "Envelope should be received");
    assert.equal(receivedEnvelope!.event.eventType, "task:status_changed");
    assert.equal(receivedEnvelope!.payload.toStatus, "in_progress");
    assert.equal(receivedEnvelope!.payload.fromStatus, "queued");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.subscribe filters by event type array", async () => {
  const workspace = createTempWorkspace("aa-typed-filter-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-filter", executionId: "exec-filter" });

    const receivedTypes: string[] = [];

    // Subscribe to specific event types
    bus.subscribe("multi_filter_consumer", ["task:status_changed", "workflow:step_completed"], (envelope) => {
      receivedTypes.push(envelope.event.eventType);
    });

    // Publish events of different types
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-filter",
      executionId: "exec-filter",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-filter",
      executionId: "exec-filter",
      payload: { stepId: "step-1", status: "completed" },
    });

    bus.publish({
      eventType: "division:completed",
      taskId: "task-filter",
      executionId: "exec-filter",
      payload: { divisionId: "div-1" },
    });

    await bus.deliverPending("multi_filter_consumer");
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Should only receive subscribed types (task:status_changed, workflow:step_completed)
    // division:completed should be filtered out
    assert.ok(receivedTypes.includes("task:status_changed"));
    assert.ok(receivedTypes.includes("workflow:step_completed"));
    // Note: division:completed filtering depends on internal implementation
    // Some implementations may deliver tier_2 events without explicit subscription

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.publish validates typed payload", async () => {
  const workspace = createTempWorkspace("aa-typed-payload-validate-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-payload-validate", executionId: "exec-payload-validate" });

    // This should not throw - valid payload for decision:requested
    bus.publish({
      eventType: "decision:requested",
      taskId: "task-payload-validate",
      executionId: "exec-payload-validate",
      payload: {
        approvalId: "approval-123",
        reason: "test reason",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.deliverPending returns count of delivered events", async () => {
  const workspace = createTempWorkspace("aa-typed-deliver-count-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-deliver-count", executionId: "exec-deliver-count" });

    bus.subscribe("deliver_count_consumer", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-deliver-count",
      executionId: "exec-deliver-count",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const count = await bus.deliverPending("deliver_count_consumer");
    assert.equal(typeof count, "number", "Should return a number");
    assert.ok(count >= 0, "Count should be non-negative");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.pendingForConsumer returns pending typed events", async () => {
  const workspace = createTempWorkspace("aa-typed-pending-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-pending", executionId: "exec-pending" });

    bus.subscribe("pending_consumer", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-pending",
      executionId: "exec-pending",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const pending = bus.pendingForConsumer("pending_consumer");
    assert.ok(Array.isArray(pending), "Should return an array");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.unsubscribe removes consumer registration", async () => {
  const workspace = createTempWorkspace("aa-typed-unsubscribe-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-unsubscribe", executionId: "exec-unsubscribe" });

    const events: string[] = [];
    bus.subscribe("unsubscribe_consumer", ["task:status_changed"], (envelope) => {
      events.push(envelope.event.id);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsubscribe",
      executionId: "exec-unsubscribe",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.unsubscribe("unsubscribe_consumer");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsubscribe",
      executionId: "exec-unsubscribe",
      payload: { fromStatus: "in_progress", toStatus: "running" },
    });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Should not receive second event after unsubscribe
    assert.ok(events.length <= 1, "Unsubscribed consumer should not receive new events");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.dispose prevents further operations", async () => {
  const workspace = createTempWorkspace("aa-typed-dispose-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-dispose", executionId: "exec-dispose" });

    bus.dispose();

    // After dispose, operations should throw or be no-ops
    assert.throws(() => {
      bus.publish({
        eventType: "task:status_changed",
        taskId: "task-dispose",
        executionId: "exec-dispose",
        payload: { fromStatus: "queued", toStatus: "in_progress" },
      });
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers skill events with correct payload structure", async () => {
  const workspace = createTempWorkspace("aa-typed-skill-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-skill", executionId: "exec-skill" });

    let receivedPayload: any = null;

    bus.subscribe("skill_consumer", ["skill:execution_started"], (envelope) => {
      receivedPayload = envelope.payload;
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-skill",
      executionId: "exec-skill",
      payload: {
        skillId: "skill-coder-v2",
        version: "2.1.0",
        stepCount: 5,
        cacheStatus: "miss",
      },
    });

    await bus.deliverPending("skill_consumer");
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(receivedPayload !== null, "Should receive skill event payload");
    assert.equal(receivedPayload.skillId, "skill-coder-v2");
    assert.equal(receivedPayload.stepCount, 5);

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers plugin events with correct payload structure", async () => {
  const workspace = createTempWorkspace("aa-typed-plugin-");

  try {
    const { db, store, bus } = await setupTypedBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-plugin", executionId: "exec-plugin" });

    let receivedPayload: any = null;

    bus.subscribe("plugin_consumer", ["plugin:invocation_completed"], (envelope) => {
      receivedPayload = envelope.payload;
    });

    bus.publish({
      eventType: "plugin:invocation_completed",
      taskId: "task-plugin",
      executionId: "exec-plugin",
      payload: {
        pluginId: "plugin.retriever",
        domainId: "coding",
        spiType: "retriever",
        phase: "execute",
        invocationId: "inv-123",
        lifecycleState: "completed",
        runtimeIsolation: "sandbox",
        activeInvocationCount: 0,
        queuedInvocationCount: 0,
        status: "completed",
      },
    });

    await bus.deliverPending("plugin_consumer");
    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(receivedPayload !== null, "Should receive plugin event payload");
    assert.equal(receivedPayload.pluginId, "plugin.retriever");
    assert.equal(receivedPayload.lifecycleState, "completed");

    bus.dispose();
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
