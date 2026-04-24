/**
 * Unit tests for TypedEventBus - type-safe event publishing and subscribing.
 *
 * Uses real SQLite database and AuthoritativeTaskStore for integration testing.
 * Follows the same pattern as other event tests in this directory.
 */

import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { TypedEventBus } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

function createTypedEventBus(workspace: string): { bus: TypedEventBus; db: SqliteDatabase; store: AuthoritativeTaskStore } {
  const db = new SqliteDatabase(join(workspace, "typed-events.db"));
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const bus = new TypedEventBus(db, store);
  return { bus, db, store };
}

test("TypedEventBus.publish dispatches type-safe event to underlying bus", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-pub-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-1", executionId: "exec-1", traceId: "trace-1" });

    const result = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-1",
      executionId: "exec-1",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "scheduler.dispatch",
        occurredAt: new Date().toISOString(),
      },
    });

    assert.equal(result.eventType, "task:status_changed");
    assert.equal(result.taskId, "task-1");
    assert.equal(result.executionId, "exec-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.publish includes trace context in payload", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-trace-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-trace", executionId: "exec-trace", traceId: "trace-abc" });

    const result = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-trace",
      traceContext: {
        traceId: "trace-abc",
        spanId: "span-1",
        parentSpanId: null,
        correlationId: "corr-1",
      },
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        occurredAt: new Date().toISOString(),
      },
    });

    const payload = JSON.parse(result.payloadJson);
    assert.equal(payload.traceContext?.traceId, "trace-abc");
    assert.equal(payload.traceContext?.spanId, "span-1");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.subscribe filters events by type using deliverPending", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-filter-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-filter", executionId: "exec-filter", traceId: "trace-filter" });
    const seen: string[] = [];

    bus.subscribe("inspect_projection", ["decision:requested"], async (event) => {
      seen.push(event.event.eventType);
    });

    // Publish a non-matching event
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-filter",
      executionId: "exec-filter",
      payload: { fromStatus: "queued", toStatus: "in_progress", occurredAt: new Date().toISOString() },
    });

    // Publish a matching event
    bus.publish({
      eventType: "decision:requested",
      taskId: "task-filter",
      executionId: "exec-filter",
      payload: {
        approvalId: "approval-match",
        reason: "test",
        requestedAt: new Date().toISOString(),
      },
    });

    // Use deliverPending to process tier_1 events
    await bus.deliverPending("inspect_projection");

    assert.equal(seen.length, 1, "Should have received exactly one decision:requested event");
    assert.equal(seen[0], "decision:requested");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.subscribe handles multiple event types", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-multi-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-multi", executionId: "exec-multi", traceId: "trace-multi" });
    const seen: string[] = [];

    bus.subscribe("inspect_projection", ["task:status_changed", "workflow:step_completed"], async (event) => {
      seen.push(event.event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-multi",
      executionId: "exec-multi",
      payload: { fromStatus: "a", toStatus: "b", occurredAt: new Date().toISOString() },
    });
    bus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-multi",
      executionId: "exec-multi",
      payload: { stepId: "step-1", occurredAt: new Date().toISOString() },
    });
    bus.publish({
      eventType: "division:completed",
      taskId: "task-multi",
      executionId: "exec-multi",
      payload: { divisionId: "div-1", occurredAt: new Date().toISOString(), workflowId: null },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(seen.length, 2);
    assert.ok(seen.includes("task:status_changed"));
    assert.ok(seen.includes("workflow:step_completed"));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.unsubscribe removes consumer", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-unsub-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-unsub", executionId: "exec-unsub", traceId: "trace-unsub" });
    const seen: string[] = [];

    // Use task_projection which is a required consumer for tier_1 events
    bus.subscribe("task_projection", ["task:status_changed"], async (event) => {
      seen.push(event.event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      payload: { fromStatus: "a", toStatus: "b", occurredAt: new Date().toISOString() },
    });

    await bus.deliverPending("task_projection");
    assert.equal(seen.length, 1);

    bus.unsubscribe("task_projection");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-unsub",
      executionId: "exec-unsub",
      payload: { fromStatus: "b", toStatus: "c", occurredAt: new Date().toISOString() },
    });

    await bus.deliverPending("task_projection");
    // After unsubscribe, should not receive new events (but may still see old pending)
    assert.equal(seen.length, 1, "Should not receive events after unsubscribe");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus.pendingForConsumer returns pending events from bus", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-pending-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-pending", executionId: "exec-pending", traceId: "trace-pending" });

    bus.subscribe("pending_consumer", ["task:status_changed"], async () => {});

    const pending = bus.pendingForConsumer("pending_consumer");
    assert.ok(Array.isArray(pending));

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers typed payload to handler", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-payload-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-payload", executionId: "exec-payload", traceId: "trace-payload" });
    const received: any[] = [];

    bus.subscribe("budget_projection", ["cost:limit_reached"], async (envelope) => {
      received.push(envelope.payload);
    });

    bus.publish({
      eventType: "cost:limit_reached",
      taskId: "task-payload",
      executionId: "exec-payload",
      payload: {
        budgetId: "budget-xyz",
        currentCostUsd: 150.50,
        limitUsd: 100.00,
        occurredAt: new Date().toISOString(),
      },
    });

    await bus.deliverPending("budget_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].budgetId, "budget-xyz");
    assert.equal(received[0].currentCostUsd, 150.50);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles skill events with correct structure", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-skill-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-skill", executionId: "exec-skill", traceId: "trace-skill" });
    const received: any[] = [];

    bus.subscribe("inspect_projection", ["skill:execution_started"], async (envelope) => {
      received.push(envelope.payload);
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-skill",
      executionId: "exec-skill",
      payload: {
        skillId: "skill-coder",
        version: "1.0.0",
        stepCount: 5,
        cacheStatus: "miss",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].skillId, "skill-coder");
    assert.equal(received[0].cacheStatus, "miss");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivery count returns from bus", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-deliver-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-deliver", executionId: "exec-deliver", traceId: "trace-deliver" });

    bus.subscribe("task_projection", ["task:status_changed"], async () => {});

    const count = await bus.deliverPending("task_projection");
    assert.equal(typeof count, "number");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus event envelope contains correct structure", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-envelope-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-envelope", executionId: "exec-envelope", traceId: "trace-envelope" });
    let capturedEnvelope: any = null;

    bus.subscribe("task_projection", ["task:status_changed"], async (envelope) => {
      capturedEnvelope = envelope;
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-envelope",
      executionId: "exec-envelope",
      payload: {
        fromStatus: "queued",
        toStatus: "running",
        occurredAt: new Date().toISOString(),
      },
    });

    await bus.deliverPending("task_projection");

    assert.ok(capturedEnvelope !== null);
    assert.equal(capturedEnvelope.event.eventType, "task:status_changed");
    assert.equal(capturedEnvelope.event.taskId, "task-envelope");
    assert.equal(capturedEnvelope.payload.fromStatus, "queued");
    assert.equal(capturedEnvelope.payload.toStatus, "running");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles worker lifecycle events", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-worker-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-worker", executionId: "exec-worker", traceId: "trace-worker" });

    const event = bus.publish({
      eventType: "worker:claim_accepted",
      taskId: "task-worker",
      executionId: "exec-worker",
      payload: {
        workerId: "worker-1",
        executionId: "exec-worker",
        occurredAt: new Date().toISOString(),
      },
    });

    assert.equal(event.eventType, "worker:claim_accepted");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles domain lifecycle events", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-domain-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-domain", executionId: "exec-domain", traceId: "trace-domain" });

    const event = bus.publish({
      eventType: "domain:registered",
      taskId: "task-domain",
      executionId: "exec-domain",
      payload: {
        domainId: "domain-test",
        status: "active",
        capabilityCount: 3,
        pluginCount: 2,
        occurredAt: new Date().toISOString(),
      },
    });

    assert.equal(event.eventType, "domain:registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus plugin events carry correct structure", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-plugin-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-plugin", executionId: "exec-plugin", traceId: "trace-plugin" });
    let receivedPayload: any = null;

    bus.subscribe("inspect_projection", ["plugin:invocation_completed"], async (envelope) => {
      receivedPayload = envelope.payload;
    });

    bus.publish({
      eventType: "plugin:invocation_completed",
      taskId: "task-plugin",
      executionId: "exec-plugin",
      payload: {
        pluginId: "plugin.test",
        domainId: "domain-1",
        spiType: "test_spi",
        phase: "execute",
        invocationId: "inv-123",
        lifecycleState: "completed",
        runtimeIsolation: "sandbox",
        activeInvocationCount: 0,
        queuedInvocationCount: 1,
        occurredAt: new Date().toISOString(),
        status: "completed",
        durationMs: 50,
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(receivedPayload?.pluginId, "plugin.test");
    assert.equal(receivedPayload?.status, "completed");
    assert.equal(receivedPayload?.durationMs, 50);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus rejects unknown event types", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-unknown-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-unknown", executionId: "exec-unknown", traceId: "trace-unknown" });

    assert.throws(() => {
      bus.publish({
        eventType: "nonexistent:event_type" as never,
        taskId: "task-unknown",
        executionId: "exec-unknown",
        payload: { data: "test" } as never,
      });
    }, (error: any) => {
      return error?.code === "event.schema_missing";
    });

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus publishes and delivers plugin error isolation events", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-error-iso-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-error-iso", executionId: "exec-error-iso", traceId: "trace-error-iso" });
    const received: any[] = [];

    bus.subscribe("feedback_projection", ["plugin:error_isolated"], async (envelope) => {
      received.push(envelope.payload);
    });

    bus.publish({
      eventType: "plugin:error_isolated",
      taskId: "task-error-iso",
      executionId: "exec-error-iso",
      payload: {
        pluginId: "plugin.coding.retriever",
        domainId: "coding",
        spiType: "retriever",
        lifecycleState: "degraded",
        occurredAt: new Date().toISOString(),
        reasonCode: "timeout",
        errorMessage: "timed out",
      },
    });

    await bus.deliverPending("feedback_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].pluginId, "plugin.coding.retriever");
    assert.equal(received[0].lifecycleState, "degraded");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles subtask completed events", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-subtask-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-subtask", executionId: "exec-subtask", traceId: "trace-subtask" });

    const event = bus.publish({
      eventType: "subtask:completed",
      taskId: "task-subtask",
      executionId: "exec-subtask",
      payload: {
        subtaskId: "subtask-123",
        stepId: "step-456",
        roleId: "agent",
        status: "completed",
        occurredAt: new Date().toISOString(),
      },
    });

    assert.equal(event.eventType, "subtask:completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus handles knowledge chunk indexed events", async () => {
  const workspace = createTempWorkspace("aa-typed-bus-knowledge-");
  try {
    const { bus, db, store } = createTypedEventBus(workspace);
    seedTaskAndExecution(db, store, { taskId: "task-knowledge", executionId: "exec-knowledge", traceId: "trace-knowledge" });
    const received: any[] = [];

    bus.subscribe("inspect_projection", ["knowledge:chunk_indexed"], async (envelope) => {
      received.push(envelope.payload);
    });

    bus.publish({
      eventType: "knowledge:chunk_indexed",
      taskId: "task-knowledge",
      executionId: "exec-knowledge",
      payload: {
        namespace: "docs",
        documentId: "doc-abc",
        chunkId: "chunk-xyz",
        trustLevel: "high",
        keywordCount: 42,
        relationCount: 5,
        occurredAt: new Date().toISOString(),
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].namespace, "docs");
    assert.equal(received[0].documentId, "doc-abc");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
