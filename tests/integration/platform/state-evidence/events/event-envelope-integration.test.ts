/**
 * Integration tests for Event Envelope operations
 *
 * Tests the event envelope creation, validation, and delivery flow using
 * typed events that are confirmed to be in the TypedEventType union.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { TypedEventBus } from "../../../../../src/platform/five-plane-state-evidence/events/typed-event-bus.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";

test("TypedEventBus delivers task:status_changed event", async () => {
  const workspace = createTempWorkspace("aa-task-status-int-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { toStatus: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-status-int", executionId: "exec-status-int" });

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      received.push({ toStatus: payload.toStatus });
    });

    bus.publish({
      eventType: "task:status_changed",
      taskId: "task-status-int",
      executionId: "exec-status-int",
      payload: {
        fromStatus: "queued",
        toStatus: "in_progress",
      },
    });

    await bus.deliverPending("task_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].toStatus, "in_progress");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers workflow:step_completed event", async () => {
  const workspace = createTempWorkspace("aa-step-completed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { workflowId: string; stepId: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-step", executionId: "exec-step" });

    bus.subscribe("workflow_projection", ["workflow:step_completed"], ({ payload }) => {
      received.push({ workflowId: payload.workflowId ?? "", stepId: payload.stepId });
    });

    bus.publish({
      eventType: "workflow:step_completed",
      taskId: "task-step",
      executionId: "exec-step",
      payload: {
        workflowId: "wf-step-123",
        stepId: "step-456",
        status: "completed",
      },
    });

    await bus.deliverPending("workflow_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].workflowId, "wf-step-123");
    assert.equal(received[0].stepId, "step-456");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers decision:requested event", async () => {
  const workspace = createTempWorkspace("aa-decision-req-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { approvalId: string; reason: string | null }[] = [];

    bus.subscribe("approval_projection", ["decision:requested"], ({ payload }) => {
      received.push({ approvalId: payload.approvalId, reason: payload.reason });
    });

    bus.publish({
      eventType: "decision:requested",
      payload: {
        approvalId: "approval-decision-123",
        reason: "policy.high_risk",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(received.length, 1);
    assert.equal(received[0].approvalId, "approval-decision-123");
    assert.equal(received[0].reason, "policy.high_risk");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers decision:responded event", async () => {
  const workspace = createTempWorkspace("aa-decision-res-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { approvalId: string; confirmed: true | undefined }[] = [];

    bus.subscribe("approval_projection", ["decision:responded"], ({ payload }) => {
      received.push({ approvalId: payload.approvalId, confirmed: payload.confirmed });
    });

    bus.publish({
      eventType: "decision:responded",
      payload: {
        approvalId: "approval-resp-456",
        decisionType: "confirmed",
        selectedOptionId: "option-1",
        confirmed: true,
        respondedBy: "user-1",
        respondedAt: "2026-04-29T00:00:00.000Z",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(received.length, 1);
    assert.equal(received[0].approvalId, "approval-resp-456");
    assert.equal(received[0].confirmed, true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers division:completed event", async () => {
  const workspace = createTempWorkspace("aa-division-completed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { divisionId: string }[] = [];

    bus.subscribe("division_projection", ["division:completed"], ({ payload }) => {
      received.push({ divisionId: payload.divisionId });
    });

    bus.publish({
      eventType: "division:completed",
      payload: {
        divisionId: "division-123",
        workflowId: "wf-456",
        occurredAt: "2026-04-29T00:00:00.000Z",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(received.length, 1);
    assert.equal(received[0].divisionId, "division-123");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers division:failed event", async () => {
  const workspace = createTempWorkspace("aa-division-failed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { divisionId: string; reasonCode: string | null }[] = [];

    bus.subscribe("division_projection", ["division:failed"], ({ payload }) => {
      received.push({ divisionId: payload.divisionId, reasonCode: payload.reasonCode });
    });

    bus.publish({
      eventType: "division:failed",
      payload: {
        divisionId: "division-failed-789",
        workflowId: null,
        occurredAt: "2026-04-29T00:00:00.000Z",
        reasonCode: "execution_error",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(received.length, 1);
    assert.equal(received[0].divisionId, "division-failed-789");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers subtask:completed event", async () => {
  const workspace = createTempWorkspace("aa-subtask-completed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { subtaskId: string | undefined; status: string | undefined }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-subtask", executionId: "exec-subtask" });

    bus.subscribe("task_projection", ["subtask:completed"], ({ payload }) => {
      received.push({ subtaskId: payload.subtaskId, status: payload.status });
    });

    bus.publish({
      eventType: "subtask:completed",
      taskId: "task-subtask",
      executionId: "exec-subtask",
      payload: {
        subtaskId: "subtask-abc",
        stepId: "step-1",
        roleId: "agent",
        status: "completed",
      },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(received.length, 1);
    assert.equal(received[0].subtaskId, "subtask-abc");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers cost:limit_reached event", async () => {
  const workspace = createTempWorkspace("aa-cost-limit-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { budgetId: string; currentCostUsd: number }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-cost", executionId: "exec-cost" });

    bus.subscribe("budget_projection", ["cost:limit_reached"], ({ payload }) => {
      received.push({ budgetId: payload.budgetId, currentCostUsd: payload.currentCostUsd });
    });

    bus.publish({
      eventType: "cost:limit_reached",
      taskId: "task-cost",
      executionId: "exec-cost",
      payload: {
        budgetId: "budget-monthly",
        currentCostUsd: 150.75,
        limitUsd: 100.0,
        occurredAt: "2026-04-29T00:00:00.000Z",
      },
    });

    await bus.deliverPending("budget_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].budgetId, "budget-monthly");
    assert.equal(received[0].currentCostUsd, 150.75);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers skill:execution_started event", async () => {
  const workspace = createTempWorkspace("aa-skill-exec-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { skillId: string; version: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill", executionId: "exec-skill" });

    bus.subscribe("inspect_projection", ["skill:execution_started"], ({ payload }) => {
      received.push({ skillId: payload.skillId, version: payload.version });
    });

    bus.publish({
      eventType: "skill:execution_started",
      taskId: "task-skill",
      executionId: "exec-skill",
      payload: {
        skillId: "coding-v3",
        version: "3.0.0",
        stepCount: 10,
        cacheStatus: "miss",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].skillId, "coding-v3");
    assert.equal(received[0].version, "3.0.0");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers skill:execution_completed event", async () => {
  const workspace = createTempWorkspace("aa-skill-completed-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { skillId: string; status: string }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill-comp", executionId: "exec-skill-comp" });

    bus.subscribe("inspect_projection", ["skill:execution_completed"], ({ payload }) => {
      received.push({ skillId: payload.skillId, status: payload.status });
    });

    bus.publish({
      eventType: "skill:execution_completed",
      taskId: "task-skill-comp",
      executionId: "exec-skill-comp",
      payload: {
        skillId: "coding-v3",
        status: "completed",
        retryCount: 0,
        cacheStatus: "miss",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].skillId, "coding-v3");
    assert.equal(received[0].status, "completed");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers multiple events in order", async () => {
  const workspace = createTempWorkspace("aa-multi-order-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
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

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus multiple consumers receive same event", async () => {
  const workspace = createTempWorkspace("aa-multi-consumer-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const consumer1Received: string[] = [];
    const consumer2Received: string[] = [];

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      consumer1Received.push(payload.toStatus);
    });

    bus.subscribe("inspect_projection", ["task:status_changed"], ({ payload }) => {
      consumer2Received.push(payload.toStatus);
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    await new Promise((resolve) => setTimeout(resolve, 25));

    assert.equal(consumer1Received.length, 1);
    assert.equal(consumer2Received.length, 1);
    assert.equal(consumer1Received[0], "in_progress");
    assert.equal(consumer2Received[0], "in_progress");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus consumer only receives subscribed events", async () => {
  const workspace = createTempWorkspace("aa-sub-filter-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: string[] = [];

    bus.subscribe("task_projection", ["task:status_changed"], ({ payload }) => {
      received.push(payload.toStatus);
    });

    // Publish different event types
    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    bus.publish({
      eventType: "workflow:step_completed",
      payload: { workflowId: "wf-1", stepId: "step-1", status: "completed" },
    });

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "in_progress", toStatus: "completed" },
    });

    await bus.deliverPending("task_projection");

    // Should only receive task:status_changed events
    assert.deepEqual(received, ["in_progress", "completed"]);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus pendingForConsumer returns pending events", async () => {
  const workspace = createTempWorkspace("aa-pending-return-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);

    bus.subscribe("task_projection", ["task:status_changed"], () => {});

    bus.publish({
      eventType: "task:status_changed",
      payload: { fromStatus: "queued", toStatus: "in_progress" },
    });

    const pending = bus.pendingForConsumer("task_projection");
    assert.equal(pending.length, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers skill:step_succeeded with timing info", async () => {
  const workspace = createTempWorkspace("aa-skill-step-succ-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { skillId: string; toolName: string; durationMs?: number }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill-succ", executionId: "exec-skill-succ" });

    bus.subscribe("inspect_projection", ["skill:step_succeeded"], ({ payload }) => {
      received.push({ skillId: payload.skillId, toolName: payload.toolName, durationMs: payload.durationMs });
    });

    bus.publish({
      eventType: "skill:step_succeeded",
      taskId: "task-skill-succ",
      executionId: "exec-skill-succ",
      payload: {
        skillId: "coding-v3",
        stepId: "step-skill-1",
        toolName: "bash",
        attempt: 1,
        maxAttempts: 3,
        durationMs: 1500,
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].skillId, "coding-v3");
    assert.equal(received[0].durationMs, 1500);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("TypedEventBus delivers skill:retry_scheduled with retry info", async () => {
  const workspace = createTempWorkspace("aa-skill-retry-");

  try {
    const db = new SqliteDatabase(join(workspace, "events.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const bus = new TypedEventBus(db, store);
    const received: { skillId: string; attempt: number; nextAttempt: number }[] = [];

    seedTaskAndExecution(db, store, { taskId: "task-skill-retry", executionId: "exec-skill-retry" });

    bus.subscribe("inspect_projection", ["skill:retry_scheduled"], ({ payload }) => {
      received.push({ skillId: payload.skillId, attempt: payload.attempt, nextAttempt: payload.nextAttempt });
    });

    bus.publish({
      eventType: "skill:retry_scheduled",
      taskId: "task-skill-retry",
      executionId: "exec-skill-retry",
      payload: {
        skillId: "coding-v3",
        stepId: "step-retry-1",
        toolName: "bash",
        attempt: 1,
        nextAttempt: 2,
        errorCode: "E_TIMEOUT",
      },
    });

    await bus.deliverPending("inspect_projection");

    assert.equal(received.length, 1);
    assert.equal(received[0].attempt, 1);
    assert.equal(received[0].nextAttempt, 2);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
