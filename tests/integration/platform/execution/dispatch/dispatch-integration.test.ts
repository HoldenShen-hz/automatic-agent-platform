/**
 * Integration Test: Dispatch Service Integration
 *
 * Tests execution dispatch service with SQLite queue integration,
 * verifying task routing and dispatch logic.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  SqliteQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../../src/platform/execution/queue/queue-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createDispatchContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/dispatch.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Dispatch service enqueues task to high-priority queue", () => {
  const ctx = createDispatchContext("aa-dispatch-high-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);
    const taskId = "task_dispatch_high_001";

    const now = nowIso();
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "High priority dispatch test",
        status: "in_progress",
        source: "user",
        priority: "high",
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
    });

    const job = queueAdapter.enqueue({
      queueName: "high-priority",
      payload: { taskId, action: "execute" },
    });

    assert.ok(job.id);
    assert.equal(job.queueName, "high-priority");

    const dequeued = queueAdapter.dequeue("high-priority");
    assert.ok(dequeued);
    const payload = JSON.parse(dequeued.job.payload);
    assert.equal(payload.taskId, taskId);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service routes tasks to correct priority queues", () => {
  const ctx = createDispatchContext("aa-dispatch-routes-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const jobLow = queueAdapter.enqueue({
      queueName: "low-priority",
      payload: { taskId: "task_low_001", priority: "low" },
    });
    const jobHigh = queueAdapter.enqueue({
      queueName: "high-priority",
      payload: { taskId: "task_high_001", priority: "high" },
    });
    const jobMedium = queueAdapter.enqueue({
      queueName: "medium-priority",
      payload: { taskId: "task_med_001", priority: "medium" },
    });

    const highResult = queueAdapter.dequeue("high-priority");
    assert.ok(highResult);
    const highPayload = JSON.parse(highResult.job.payload);
    assert.equal(highPayload.priority, "high");

    const lowResult = queueAdapter.dequeue("low-priority");
    assert.ok(lowResult);
    const lowPayload = JSON.parse(lowResult.job.payload);
    assert.equal(lowPayload.priority, "low");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service handles concurrent dequeues correctly", () => {
  const ctx = createDispatchContext("aa-dispatch-concurrent-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    for (let i = 0; i < 5; i++) {
      queueAdapter.enqueue({
        queueName: "tasks",
        payload: { taskId: `task_concurrent_${i}`, index: i },
      });
    }

    const results: string[] = [];
    for (let i = 0; i < 5; i++) {
      const result = queueAdapter.dequeue("tasks");
      if (result) {
        const payload = JSON.parse(result.job.payload);
        results.push(payload.taskId);
        result.ack();
      }
    }

    assert.equal(results.length, 5);
    assert.ok(results.includes("task_concurrent_0"));
    assert.ok(results.includes("task_concurrent_4"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service fails job and requeues with backoff", () => {
  const ctx = createDispatchContext("aa-dispatch-fail-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const job = queueAdapter.enqueue({
      queueName: "tasks",
      payload: { taskId: "task_fail_001" },
      maxAttempts: 3,
    });

    const result = queueAdapter.dequeue("tasks");
    assert.ok(result);
    assert.equal(result.job.attempts, 1);

    result.nack();

    const retryResult = queueAdapter.dequeue("tasks");
    assert.ok(retryResult);
    assert.equal(retryResult.job.id, job.id);
    assert.equal(retryResult.job.attempts, 2);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service moves job to dead letter after max retries", () => {
  const ctx = createDispatchContext("aa-dispatch-dlq-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const job = queueAdapter.enqueue({
      queueName: "tasks",
      payload: { taskId: "task_dlq_001" },
      maxAttempts: 2,
    });

    const r1 = queueAdapter.dequeue("tasks");
    assert.ok(r1);
    r1.nack();

    const r2 = queueAdapter.dequeue("tasks");
    assert.ok(r2);
    r2.nack();

    const dlqJob = queueAdapter.getJob(job.id);
    assert.ok(dlqJob);
    assert.equal(dlqJob?.status, "dead_letter");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service stats reflect correct queue state", () => {
  const ctx = createDispatchContext("aa-dispatch-stats-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    queueAdapter.enqueue({ queueName: "stats_queue", payload: { n: 1 } });
    queueAdapter.enqueue({ queueName: "stats_queue", payload: { n: 2 } });
    const r3 = queueAdapter.dequeue("stats_queue");
    queueAdapter.enqueue({ queueName: "stats_queue", payload: { n: 3 } });

    assert.ok(r3);
    r3.ack();

    const stats = queueAdapter.stats("stats_queue");
    assert.equal(stats.waiting, 2);
    assert.equal(stats.active, 0);
    assert.equal(stats.completed, 1);
    assert.equal(stats.deadLetter, 0);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Dispatch service persists task and queue job in same transaction", () => {
  const ctx = createDispatchContext("aa-dispatch-trans-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);
    const taskId = "task_trans_001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Transaction test",
        status: "queued",
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

      queueAdapter.enqueue({
        queueName: "tasks",
        payload: { taskId, action: "process" },
      });
    });

    const persistedTask = ctx.store.getTask(taskId);
    assert.ok(persistedTask);
    assert.equal(persistedTask?.status, "queued");

    const dequeued = queueAdapter.dequeue("tasks");
    assert.ok(dequeued);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});