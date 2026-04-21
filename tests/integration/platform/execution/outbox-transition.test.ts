/**
 * @fileoverview [SYS-REL-2.6] Outbox transition integration tests
 *
 * These tests verify the current transition path: state transitions emit tier-1
 * events and persist matching outbox records in the same database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { TransitionService } from "../../../../src/platform/execution/state-transition/transition-service.js";
import { createIntegrationContext, type IntegrationContext } from "../../../helpers/integration-context.js";

function queryTaskOutboxEntries(ctx: IntegrationContext, taskId: string): Array<Record<string, unknown>> {
  return ctx.db.connection
    .prepare(`SELECT * FROM outbox WHERE aggregate_type = 'task' AND aggregate_id = ? ORDER BY created_at`)
    .all(taskId) as Array<Record<string, unknown>>;
}

function seedTask(
  ctx: IntegrationContext,
  input: {
    taskId: string;
    executionId?: string;
    taskStatus: "queued" | "pending" | "in_progress";
  },
): void {
  const now = new Date().toISOString();
  ctx.db.transaction(() => {
    ctx.store.insertTask({
      id: input.taskId,
      parentId: null,
      rootId: input.taskId,
      divisionId: "general_ops",
      tenantId: null,
      title: "Outbox integration test task",
      status: input.taskStatus,
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
    });

    if (input.executionId != null) {
      ctx.store.insertExecution({
        id: input.executionId,
        taskId: input.taskId,
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-test",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: `trace-${input.executionId}`,
        attempt: 1,
        timeoutMs: 60_000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    }
  });
}

test("[SYS-REL-2.6] task state transition writes outbox entry", () => {
  const ctx = createIntegrationContext("sys-rel-2-6-");
  try {
    const transitionService = new TransitionService(ctx.db, ctx.store);
    const taskId = "task-outbox-test-001";
    const executionId = "exec-outbox-test-001";
    const now = new Date().toISOString();

    seedTask(ctx, { taskId, executionId, taskStatus: "pending" });
    assert.equal(queryTaskOutboxEntries(ctx, taskId).length, 0, "Should have no outbox entries before transition");

    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId,
      actorType: "system",
      actorId: "test-runner",
      idempotencyKey: "",
      reasonCode: "",
      reasonDetail: "",
      metadataJson: "{}",
      traceId: `trace-${executionId}`,
      correlationId: taskId,
      occurredAt: now,
    });

    const outboxEntries = queryTaskOutboxEntries(ctx, taskId);
    assert.ok(outboxEntries.length > 0, "Task transition must create an outbox entry");
    assert.equal(outboxEntries[0]?.event_type, "task:status_changed");
    assert.equal(outboxEntries[0]?.aggregate_id, taskId);

    const payload = JSON.parse(String(outboxEntries[0]?.payload_json ?? "{}")) as {
      payload?: { fromStatus?: string; toStatus?: string; entityId?: string };
    };
    assert.equal(payload.payload?.entityId, taskId);
    assert.equal(payload.payload?.fromStatus, "pending");
    assert.equal(payload.payload?.toStatus, "in_progress");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] task terminal transition writes outbox entry", () => {
  const ctx = createIntegrationContext("sys-rel-2-6-terminal-");
  try {
    const transitionService = new TransitionService(ctx.db, ctx.store);
    const taskId = "task-terminal-outbox-001";
    const executionId = "exec-terminal-outbox-001";
    const now = new Date().toISOString();

    seedTask(ctx, { taskId, executionId, taskStatus: "in_progress" });

    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "in_progress",
      toStatus: "done",
      executionId,
      actorType: "system",
      actorId: "test-runner",
      idempotencyKey: "",
      reasonCode: "",
      reasonDetail: "",
      metadataJson: "{}",
      traceId: `trace-${executionId}`,
      correlationId: taskId,
      occurredAt: now,
    });

    const outboxEntries = queryTaskOutboxEntries(ctx, taskId);
    assert.ok(outboxEntries.length > 0, "Terminal transition must create an outbox entry");

    const latestPayload = JSON.parse(String(outboxEntries.at(-1)?.payload_json ?? "{}")) as {
      payload?: { toStatus?: string };
    };
    assert.equal(latestPayload.payload?.toStatus, "done");
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] outbox table must exist and have correct schema", () => {
  const ctx = createIntegrationContext("sys-rel-2-6-schema-");
  try {
    const tableInfo = ctx.db.connection
      .prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name='outbox'`)
      .get() as { name: string } | undefined;

    assert.ok(tableInfo, "outbox table must exist");

    const columns = ctx.db.connection
      .prepare(`PRAGMA table_info(outbox)`)
      .all() as Array<{ name: string }>;
    const columnNames = columns.map((column) => column.name);

    assert.ok(columnNames.includes("id"));
    assert.ok(columnNames.includes("aggregate_type"));
    assert.ok(columnNames.includes("aggregate_id"));
    assert.ok(columnNames.includes("event_type"));
    assert.ok(columnNames.includes("payload_json"));
    assert.ok(columnNames.includes("trace_id"));
    assert.ok(columnNames.includes("created_at"));
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] multiple rapid transitions create multiple outbox entries", () => {
  const ctx = createIntegrationContext("sys-rel-2-6-rapid-");
  try {
    const transitionService = new TransitionService(ctx.db, ctx.store);
    const taskId = "task-rapid-transition-001";
    const now = new Date().toISOString();

    seedTask(ctx, { taskId, taskStatus: "queued" });

    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "queued",
      toStatus: "pending",
      executionId: null,
      actorType: "system",
      actorId: "test-runner",
      idempotencyKey: "",
      reasonCode: "",
      reasonDetail: "",
      metadataJson: "{}",
      traceId: "trace-queued-pending",
      correlationId: taskId,
      occurredAt: now,
    });
    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId: null,
      actorType: "system",
      actorId: "test-runner",
      idempotencyKey: "",
      reasonCode: "",
      reasonDetail: "",
      metadataJson: "{}",
      traceId: "trace-pending-progress",
      correlationId: taskId,
      occurredAt: now,
    });

    const outboxEntries = queryTaskOutboxEntries(ctx, taskId);
    assert.equal(outboxEntries.length, 2, "Should have one outbox entry per transition");
    assert.ok(outboxEntries.every((entry) => entry.event_type === "task:status_changed"));
  } finally {
    ctx.cleanup();
  }
});

test("[SYS-REL-2.6] transition without outbox entry causes event loss", () => {
  const ctx = createIntegrationContext("sys-rel-2-6-event-loss-");
  try {
    const transitionService = new TransitionService(ctx.db, ctx.store);
    const taskId = "task-event-loss-001";
    const now = new Date().toISOString();

    seedTask(ctx, { taskId, taskStatus: "pending" });

    const before = ctx.db.connection
      .prepare(`SELECT COUNT(*) as cnt FROM outbox WHERE aggregate_type = 'task' AND aggregate_id = ?`)
      .get(taskId) as { cnt: number };

    transitionService.transitionTaskStatus({
      entityKind: "task",
      entityId: taskId,
      fromStatus: "pending",
      toStatus: "in_progress",
      executionId: null,
      actorType: "system",
      actorId: "test-runner",
      idempotencyKey: "",
      reasonCode: "",
      reasonDetail: "",
      metadataJson: "{}",
      traceId: `trace-${taskId}`,
      correlationId: taskId,
      occurredAt: now,
    });

    const after = ctx.db.connection
      .prepare(`SELECT COUNT(*) as cnt FROM outbox WHERE aggregate_type = 'task' AND aggregate_id = ?`)
      .get(taskId) as { cnt: number };

    assert.ok(after.cnt > before.cnt, "Transition must create an outbox entry");
  } finally {
    ctx.cleanup();
  }
});
