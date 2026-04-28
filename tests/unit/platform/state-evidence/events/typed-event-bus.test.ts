import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";

import { getEventSchema } from "../../../../../src/platform/state-evidence/events/event-registry.js";
import { TypedEventBus } from "../../../../../src/platform/state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("event registry exposes typed schema metadata for registered events", () => {
  const schema = getEventSchema("skill:execution_started");

  assert.equal(schema.payloadSchemaRef, "event://skill/execution_started/v1");
  assert.equal(schema.compatibilityPolicy, "backward_compatible_additive");
  assert.equal(schema.producer, "skill_execution_service");
});

test("event registry exposes plugin isolation event metadata", () => {
  const schema = getEventSchema("plugin:error_isolated");

  assert.equal(schema.payloadSchemaRef, "event://plugin/error_isolated/v1");
  assert.equal(schema.producer, "plugin_spi_registry");
});

test("event registry exposes plugin invocation event metadata", () => {
  const schema = getEventSchema("plugin:invocation_completed");

  assert.equal(schema.payloadSchemaRef, "event://plugin/invocation_completed/v1");
  assert.equal(schema.producer, "plugin_spi_registry");
});

test("typed event bus publishes and filters typed tier1 events", async () => {
  const workspace = createTempWorkspace("aa-typed-event-bus-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: string[] = [];
    seedTaskAndExecution(db, store, { taskId: "task-typed", executionId: "exec-typed", traceId: "trace-typed" });

    bus.subscribe("inspect_projection", ["decision:requested"], async ({ event, payload }) => {
      seen.push(`${event.eventType}:${String(payload.reason ?? "missing")}`);
    });

    bus.publish({
      eventType: "decision:responded",
      taskId: "task-typed",
      executionId: "exec-typed",
      traceId: "trace-typed",
      payload: {
        approvalId: "approval-typed",
        decisionType: "confirmed",
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: "2026-04-14T00:00:00.000Z",
      },
    });
    bus.publish({
      eventType: "decision:requested",
      taskId: "task-typed",
      executionId: "exec-typed",
      traceId: "trace-typed",
      payload: {
        approvalId: "approval-typed",
        reason: "policy.high_risk",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.deepEqual(seen, ["decision:requested:policy.high_risk"]);
    assert.equal(bus.pendingForConsumer("inspect_projection").length, 0);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus publishes plugin isolation events", async () => {
  const workspace = createTempWorkspace("aa-plugin-event-bus-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "plugin:error_isolated",
      payload: {
        pluginId: "plugin.coding.retriever",
        domainId: "coding",
        spiType: "retriever",
        lifecycleState: "degraded",
        occurredAt: "2026-04-16T00:00:00.000Z",
        reasonCode: "timeout",
        errorMessage: "timed out",
      },
    });

    const events = store.event.listEventsByType("plugin:error_isolated", 5);
    assert.equal(events.length, 1);
    assert.match(events[0]?.payloadJson ?? "", /plugin\.coding\.retriever/);
    assert.match(events[0]?.payloadJson ?? "", /timeout/);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus publishes plugin invocation audit events", async () => {
  const workspace = createTempWorkspace("aa-plugin-invocation-event-bus-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.publish({
      eventType: "plugin:invocation_completed",
      payload: {
        pluginId: "plugin.coding.presenter",
        domainId: "coding",
        spiType: "presenter",
        phase: "present",
        invocationId: "plugin_invocation_1",
        lifecycleState: "active",
        runtimeIsolation: "serialized_in_process",
        activeInvocationCount: 0,
        queuedInvocationCount: 0,
        occurredAt: "2026-04-16T00:00:00.000Z",
        status: "completed",
        durationMs: 12,
      },
    });

    const events = store.event.listEventsByType("plugin:invocation_completed", 5);
    assert.equal(events.length, 1);
    assert.match(events[0]?.payloadJson ?? "", /plugin_invocation_1/);
    assert.match(events[0]?.payloadJson ?? "", /serialized_in_process/);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers subscribed tier2 events without ack replay", async () => {
  const workspace = createTempWorkspace("aa-tier2-direct-delivery-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: string[] = [];

    bus.subscribe("feedback_projection", ["plugin:error_isolated"], async ({ payload }) => {
      seen.push(`${payload.pluginId}:${payload.lifecycleState}`);
    });

    bus.publish({
      eventType: "plugin:error_isolated",
      payload: {
        pluginId: "plugin.coding.retriever",
        domainId: "coding",
        spiType: "retriever",
        lifecycleState: "degraded",
        occurredAt: "2026-04-16T00:00:00.000Z",
        reasonCode: "timeout",
        errorMessage: "timed out",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.deepEqual(seen, ["plugin.coding.retriever:degraded"]);
    assert.equal(bus.pendingForConsumer("feedback_projection").length, 0);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers skill:execution_started with typed payload mapping", async () => {
  const workspace = createTempWorkspace("aa-skill-execution-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { skillId: string; version: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill", executionId: "exec-skill", traceId: "trace-skill" });

    bus.subscribe("inspect_projection", ["skill:execution_started"], async ({ payload }) => {
      seen.push({ skillId: payload.skillId, version: payload.version });
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-skill",
      executionId: "exec-skill",
      traceId: "trace-skill",
      payload: {
        skillId: "coding-v2",
        version: "2.1.0",
        stepCount: 5,
        cacheStatus: "miss",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(seen.length, 1);
    assert.equal(seen[0].skillId, "coding-v2");
    assert.equal(seen[0].version, "2.1.0");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers skill:step_failed with retry info payload mapping", async () => {
  const workspace = createTempWorkspace("aa-skill-step-failed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { skillId: string; willRetry: boolean }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill-fail", executionId: "exec-skill-fail", traceId: "trace-skill-fail" });

    bus.subscribe("inspect_projection", ["skill:step_failed"], async ({ payload }) => {
      seen.push({ skillId: payload.skillId, willRetry: payload.willRetry ?? false });
    });

    bus.publish({
      eventType: "skill:step_failed",
      taskId: "task-skill-fail",
      executionId: "exec-skill-fail",
      traceId: "trace-skill-fail",
      payload: {
        skillId: "coding-v2",
        stepId: "step-123",
        toolName: "bash",
        attempt: 2,
        maxAttempts: 3,
        errorCode: "E_TIMEOUT",
        willRetry: true,
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(seen.length, 1);
    assert.equal(seen[0].willRetry, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers cost:limit_reached with typed payload mapping", async () => {
  const workspace = createTempWorkspace("aa-cost-limit-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { budgetId: string; currentCostUsd: number }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-cost", executionId: "exec-cost", traceId: "trace-cost" });

    bus.subscribe("inspect_projection", ["cost:limit_reached"], async ({ payload }) => {
      seen.push({ budgetId: payload.budgetId, currentCostUsd: payload.currentCostUsd });
    });

    bus.publish({
      eventType: "cost:limit_reached",
      taskId: "task-cost",
      executionId: "exec-cost",
      traceId: "trace-cost",
      payload: {
        budgetId: "budget-monthly",
        currentCostUsd: 150.75,
        limitUsd: 100.0,
        occurredAt: "2026-04-28T00:00:00.000Z",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(seen.length, 1);
    assert.equal(seen[0].budgetId, "budget-monthly");
    assert.equal(seen[0].currentCostUsd, 150.75);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers domain:registered with typed payload mapping", async () => {
  const workspace = createTempWorkspace("aa-domain-reg-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { domainId: string; status: string }[] = [];

    bus.subscribe("feedback_projection", ["domain:registered"], async ({ payload }) => {
      seen.push({ domainId: payload.domainId, status: payload.status });
    });

    bus.publish({
      eventType: "domain:registered",
      payload: {
        domainId: "domain-coding",
        status: "registered",
        capabilityCount: 8,
        pluginCount: 12,
        occurredAt: "2026-04-28T00:00:00.000Z",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(seen.length, 1);
    assert.equal(seen[0].domainId, "domain-coding");
    assert.equal(seen[0].status, "registered");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers knowledge:chunk_indexed with typed payload mapping", async () => {
  const workspace = createTempWorkspace("aa-knowledge-chunk-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { namespace: string; trustLevel: string }[] = [];

    bus.subscribe("feedback_projection", ["knowledge:chunk_indexed"], async ({ payload }) => {
      seen.push({ namespace: payload.namespace, trustLevel: payload.trustLevel });
    });

    bus.publish({
      eventType: "knowledge:chunk_indexed",
      payload: {
        namespace: "coding",
        documentId: "doc-123",
        chunkId: "chunk-456",
        trustLevel: "high",
        keywordCount: 50,
        relationCount: 10,
        occurredAt: "2026-04-28T00:00:00.000Z",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(seen.length, 1);
    assert.equal(seen[0].namespace, "coding");
    assert.equal(seen[0].trustLevel, "high");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus delivers learning:knowledge_promoted with typed payload mapping", async () => {
  const workspace = createTempWorkspace("aa-knowledge-promoted-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { learningType: string; promotedCount: number }[] = [];

    bus.subscribe("inspect_projection", ["learning:knowledge_promoted"], async ({ payload }) => {
      seen.push({ learningType: payload.learningType, promotedCount: payload.promotedCount });
    });

    bus.publish({
      eventType: "learning:knowledge_promoted",
      payload: {
        learningObjectId: "lo-123",
        learningType: "snippet",
        documentId: "doc-456",
        namespace: "coding",
        trustLevel: "high",
        promotedCount: 5,
        occurredAt: "2026-04-28T00:00:00.000Z",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(seen.length, 1);
    assert.equal(seen[0].learningType, "snippet");
    assert.equal(seen[0].promotedCount, 5);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus publishes plugin:invocation_started and delivers with typed payload", async () => {
  const workspace = createTempWorkspace("aa-plugin-inv-start-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: { invocationId: string; status: string }[] = [];

    bus.subscribe("inspect_projection", ["plugin:invocation_started"], async ({ payload }) => {
      seen.push({ invocationId: payload.invocationId, status: payload.status ?? "unknown" });
    });

    bus.publish({
      eventType: "plugin:invocation_started",
      payload: {
        pluginId: "plugin.coding.presenter",
        domainId: "coding",
        spiType: "presenter",
        phase: "prepare",
        invocationId: "inv-789",
        lifecycleState: "preparing",
        runtimeIsolation: "isolated",
        activeInvocationCount: 1,
        queuedInvocationCount: 0,
        occurredAt: "2026-04-28T00:00:00.000Z",
        status: "started",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(seen.length, 1);
    assert.equal(seen[0].invocationId, "inv-789");
    assert.equal(seen[0].status, "started");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus allows multiple consumers for same event type", async () => {
  const workspace = createTempWorkspace("aa-multi-consumer-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const consumer1Seen: string[] = [];
    const consumer2Seen: string[] = [];

    bus.subscribe("inspect_projection", ["decision:requested"], async ({ payload }) => {
      consumer1Seen.push(payload.approvalId);
    });

    bus.subscribe("audit_projection", ["decision:requested"], async ({ payload }) => {
      consumer2Seen.push(payload.approvalId);
    });

    bus.publish({
      eventType: "decision:requested",
      payload: {
        approvalId: "approval-multi",
        reason: "multi-consumer-test",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.deepEqual(consumer1Seen, ["approval-multi"]);
    assert.deepEqual(consumer2Seen, ["approval-multi"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus unsubscribe removes consumer", async () => {
  const workspace = createTempWorkspace("aa-unsubscribe-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: string[] = [];

    bus.subscribe("inspect_projection", ["decision:requested"], async ({ payload }) => {
      seen.push(payload.approvalId);
    });

    bus.unsubscribe("inspect_projection");

    bus.publish({
      eventType: "decision:requested",
      payload: {
        approvalId: "approval-after-unsubscribe",
        reason: "unsubscribe-test",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.deepEqual(seen, []);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus pendingForConsumer returns events for subscribed consumer", async () => {
  const workspace = createTempWorkspace("aa-pending-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.subscribe("inspect_projection", ["decision:requested"], () => {});

    bus.publish({
      eventType: "decision:requested",
      payload: {
        approvalId: "approval-pending",
        reason: "pending-test",
      },
    });

    const pending = bus.pendingForConsumer("inspect_projection");
    assert.equal(pending.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("typed event bus filters events for consumer based on subscription", async () => {
  const workspace = createTempWorkspace("aa-filter-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const seen: string[] = [];

    bus.subscribe("inspect_projection", ["decision:requested", "decision:responded"], async ({ event, payload }) => {
      seen.push(event.eventType);
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "decision:requested",
      payload: { approvalId: "approval-filter" },
    });

    bus.publish({
      eventType: "decision:responded",
      payload: { approvalId: "approval-responded" },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.deepEqual(seen, ["decision:requested", "decision:responded"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
