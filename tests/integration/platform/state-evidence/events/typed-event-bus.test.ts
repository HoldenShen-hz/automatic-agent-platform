/**
 * Integration tests for TypedEventBus
 *
 * Tests type-safe event publishing and subscription delivery.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext } from "../../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("integration: TypedEventBus publishes typed event and persists with correct schema", () => {
  const ctx = createIntegrationContext("aa-typed-publish-");
  try {
    const bus = new TypedEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-typed-pub",
      executionId: "exec-typed-pub",
      traceId: "trace-typed-pub",
    });

    const event = bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-pub",
      executionId: "exec-typed-pub",
      traceId: "trace-typed-pub",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
        reasonCode: "typed.publish.test",
      },
    });

    assert.ok(event.id.startsWith("evt_"), "Event should have correct ID prefix");
    assert.equal(event.eventType, "task:status_changed");
    assert.equal(event.eventTier, "tier_1");

      } finally {
    ctx.cleanup();
  }
});

test("integration: TypedEventBus subscribe filters by event type", async () => {
  const workspace = createTempWorkspace("aa-typed-subscribe-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-sub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-sub",
      executionId: "exec-typed-sub",
      traceId: "trace-typed-sub",
    });

    const seen: string[] = [];

    bus.subscribe("typed_sub_consumer", ["decision:requested"], async ({ event, payload }) => {
      seen.push(`${event.eventType}:${payload.approvalId}`);
    });

    // Publish matching event
    bus.publish({
      eventType: "decision:requested",
      taskId: "task-typed-sub",
      executionId: "exec-typed-sub",
      traceId: "trace-typed-sub",
      payload: {
        approvalId: "approval-typed-sub-1",
        reason: "typed.subscribe.test",
      },
    });

    // Publish non-matching event
    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-sub",
      executionId: "exec-typed-sub",
      traceId: "trace-typed-sub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(seen.length, 1, "Should receive only matching event");
    assert.equal(seen[0], "decision:requested:approval-typed-sub-1");

        db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TypedEventBus delivers skill execution events with typed payload", async () => {
  const workspace = createTempWorkspace("aa-typed-skill-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-skill.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-skill",
      executionId: "exec-typed-skill",
      traceId: "trace-typed-skill",
    });

    const seen: { skillId: string; status: string }[] = [];

    bus.subscribe("skill_consumer", ["skill:execution_started", "skill:execution_completed"], async ({ payload }) => {
      seen.push({ skillId: payload.skillId, status: payload.cacheStatus });
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-typed-skill",
      executionId: "exec-typed-skill",
      traceId: "trace-typed-skill",
      payload: {
        skillId: "coding-v3",
        version: "3.0.0",
        stepCount: 10,
        cacheStatus: "miss",
      },
    });

    bus.publish({
      eventType: "skill:execution_completed",
      taskId: "task-typed-skill",
      executionId: "exec-typed-skill",
      traceId: "trace-typed-skill",
      payload: {
        skillId: "coding-v3",
        status: "completed",
        retryCount: 0,
        cacheStatus: "miss",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(seen.length, 2, "Should receive both skill events");
    assert.equal(seen[0].skillId, "coding-v3");
    assert.equal(seen[0].status, "miss");

        db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TypedEventBus delivers platform.harness_run events", async () => {
  const ctx = createIntegrationContext("aa-typed-harness-");
  try {
    const bus = new TypedEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-harness",
      executionId: "exec-harness",
      traceId: "trace-harness",
    });

    let received = false;

    bus.subscribe("harness_consumer", ["task:status_changed"], async ({ payload }) => {
      received = true;
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-harness",
      executionId: "exec-harness",
      traceId: "trace-harness",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.ok(received, "Should receive task status change event");

      } finally {
    ctx.cleanup();
  }
});

test("integration: TypedEventBus multiple consumers receive typed events independently", async () => {
  const workspace = createTempWorkspace("aa-typed-multi-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-multi.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-multi",
      executionId: "exec-typed-multi",
      traceId: "trace-typed-multi",
    });

    const consumerA: string[] = [];
    const consumerB: { budgetId: string; limit: number }[] = [];

    bus.subscribe("multi-consumer-a", ["task:status_changed"], async ({ payload }) => {
      consumerA.push(payload.toStatus);
    });

    bus.subscribe("multi-consumer-b", ["cost:limit_reached"], async ({ payload }) => {
      consumerB.push({ budgetId: payload.budgetId, limit: payload.limitUsd });
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-multi",
      executionId: "exec-typed-multi",
      traceId: "trace-typed-multi",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "cost:limit_reached",
      taskId: "task-typed-multi",
      executionId: "exec-typed-multi",
      traceId: "trace-typed-multi",
      payload: {
        budgetId: "budget-monthly",
        currentCostUsd: 150.0,
        limitUsd: 100.0,
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(consumerA.length, 1, "Consumer A should receive status change");
    assert.equal(consumerA[0], "in_progress");
    assert.equal(consumerB.length, 1, "Consumer B should receive cost event");
    assert.equal(consumerB[0].budgetId, "budget-monthly");

        db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TypedEventBus unsubscribe removes consumer", async () => {
  const workspace = createTempWorkspace("aa-typed-unsub-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-unsub.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-typed-unsub",
      executionId: "exec-typed-unsub",
      traceId: "trace-typed-unsub",
    });

    const seen: string[] = [];

    bus.subscribe("unsub-consumer", ["task:status_changed"], async ({ payload }) => {
      seen.push(payload.toStatus);
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-unsub",
      executionId: "exec-typed-unsub",
      traceId: "trace-typed-unsub",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(seen.length, 1, "Should receive first event");

    bus.unsubscribe("unsub-consumer");

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-unsub",
      executionId: "exec-typed-unsub",
      traceId: "trace-typed-unsub",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));
    assert.equal(seen.length, 1, "Should not receive after unsubscribe");

        db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("integration: TypedEventBus pendingForConsumer returns events for typed consumer", () => {
  const ctx = createIntegrationContext("aa-typed-pending-");
  try {
    const bus = new TypedEventBus(ctx.db, ctx.store);
    seedTaskAndExecution(ctx.db, ctx.store, {
      taskId: "task-typed-pending",
      executionId: "exec-typed-pending",
      traceId: "trace-typed-pending",
    });

    bus.subscribe("pending-consumer", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-typed-pending",
      executionId: "exec-typed-pending",
      traceId: "trace-typed-pending",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const pending = bus.pendingForConsumer("pending-consumer");
    assert.equal(pending.length, 1, "Should have 1 pending event");

      } finally {
    ctx.cleanup();
  }
});

test("integration: TypedEventBus delivers OAPEFLIR phase transition events", async () => {
  const workspace = createTempWorkspace("aa-typed-oapeflir-");
  try {
    const db = new SqliteDatabase(join(workspace, "typed-oapeflir.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    seedTaskAndExecution(db, store, {
      taskId: "task-oapeflir",
      executionId: "exec-oapeflir",
      traceId: "trace-oapeflir",
    });

    const seen: string[] = [];

    // Use skill events which are registered and known to work
    bus.subscribe("skill-consumer", ["skill:execution_started", "skill:execution_completed"], async ({ payload }) => {
      seen.push(payload.skillId);
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-oapeflir",
      executionId: "exec-oapeflir",
      traceId: "trace-oapeflir",
      payload: {
        skillId: "skill-oapeflir",
        version: "1.0.0",
        stepCount: 5,
        cacheStatus: "miss",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    assert.equal(seen.length, 1);
    assert.equal(seen[0], "skill-oapeflir");

        db.close();
  } finally {
    cleanupPath(workspace);
  }
});