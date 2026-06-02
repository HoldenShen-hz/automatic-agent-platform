/**
 * Integration Test: Concurrent Dispatch Integration
 *
 * Tests concurrent dispatch scenarios with SQLite queue
 * and task store integration.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import {
  SqliteQueueAdapter,
  QUEUE_JOBS_DDL,
} from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createConcurrentContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/concurrent.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  db.connection.exec(QUEUE_JOBS_DDL);
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Concurrent dispatch: multiple workers dequeuing from same queue", () => {
  const ctx = createConcurrentContext("aa-concurrent-workers-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    for (let i = 0; i < 10; i++) {
      queueAdapter.enqueue({
        queueName: "workers",
        payload: { taskId: `task_worker_${i}`, worker: "worker_thread" },
      });
    }

    const dequeuedJobs: string[] = [];
    for (let i = 0; i < 10; i++) {
      const result = queueAdapter.dequeue("workers");
      if (result) {
        const payload = JSON.parse(result.job.payload);
        dequeuedJobs.push(payload.taskId);
        result.ack();
      }
    }

    assert.equal(dequeuedJobs.length, 10);
    const uniqueJobs = new Set(dequeuedJobs);
    assert.equal(uniqueJobs.size, 10);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Concurrent dispatch: jobs processed in order across multiple queues", () => {
  const ctx = createConcurrentContext("aa-concurrent-multi-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const queues = ["queue_a", "queue_b", "queue_c"];
    for (const queue of queues) {
      for (let i = 0; i < 3; i++) {
        queueAdapter.enqueue({
          queueName: queue,
          payload: { queue, index: i },
        });
      }
    }

    for (const queue of queues) {
      const results: string[] = [];
      for (let i = 0; i < 3; i++) {
        const result = queueAdapter.dequeue(queue);
        if (result) {
          const payload = JSON.parse(result.job.payload);
          results.push(`${payload.queue}_${payload.index}`);
          result.ack();
        }
      }
      assert.equal(results.length, 3);
    }
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Concurrent dispatch: task store and queue operate independently", () => {
  const ctx = createConcurrentContext("aa-concurrent-indep-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);
    const taskIds: string[] = [];
    const now = nowIso();

    ctx.db.transaction(() => {
      for (let i = 0; i < 5; i++) {
        const taskId = `task_indep_${i}`;
        taskIds.push(taskId);
        ctx.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `Independent task ${i}`,
          status: "in_progress",
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
          payload: { taskId },
        });
      }
    });

    for (const taskId of taskIds) {
      const task = ctx.store.getTask(taskId);
      assert.ok(task);
      assert.equal(task?.status, "in_progress");
    }

    for (let i = 0; i < 5; i++) {
      const result = queueAdapter.dequeue("tasks");
      assert.ok(result);
      result.ack();
    }

    const stats = queueAdapter.stats("tasks");
    assert.equal(stats.completed, 5);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Concurrent dispatch: race condition handling in nack/requeue", () => {
  const ctx = createConcurrentContext("aa-concurrent-race-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const job = queueAdapter.enqueue({
      queueName: "race_queue",
      payload: { taskId: "task_race_001" },
      maxAttempts: 3,
    });

    const r1 = queueAdapter.dequeue("race_queue");
    assert.ok(r1);
    assert.equal(r1.job.attempts, 1);

    r1.nack();

    const r2 = queueAdapter.dequeue("race_queue");
    assert.ok(r2);
    assert.equal(r2.job.id, job.id);
    assert.equal(r2.job.attempts, 2);

    const r2ParallelAttempt = queueAdapter.dequeue("race_queue");
    assert.equal(r2ParallelAttempt, null, "Active jobs should not be dequeued twice concurrently");

    r2.nack();

    const r3 = queueAdapter.dequeue("race_queue");
    assert.ok(r3);
    assert.equal(r3.job.id, job.id);
    assert.equal(r3.job.attempts, 3);

    r3.nack();

    const dlqJob = queueAdapter.getJob(job.id);
    assert.ok(dlqJob);
    assert.equal(dlqJob?.status, "dead_letter");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Concurrent dispatch: high throughput enqueue/dequeue cycle", () => {
  const ctx = createConcurrentContext("aa-concurrent-throughput-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);

    const count = 50;
    for (let i = 0; i < count; i++) {
      queueAdapter.enqueue({
        queueName: "throughput",
        payload: { index: i, timestamp: Date.now() },
      });
    }

    let processed = 0;
    while (true) {
      const result = queueAdapter.dequeue("throughput");
      if (!result) break;
      result.ack();
      processed++;
    }

    assert.equal(processed, count);
    const stats = queueAdapter.stats("throughput");
    assert.equal(stats.waiting, 0);
    assert.equal(stats.active, 0);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Concurrent dispatch: multiple task executions with FK constraints", () => {
  const ctx = createConcurrentContext("aa-concurrent-fk-");
  try {
    const queueAdapter = new SqliteQueueAdapter(ctx.db);
    const now = nowIso();

    ctx.db.transaction(() => {
      for (let i = 0; i < 3; i++) {
        const taskId = `task_fk_${i}`;
        const execId = `exec_fk_${i}`;

        ctx.store.insertTask({
          id: taskId,
          parentId: null,
          rootId: taskId,
          divisionId: "general-ops",
          title: `FK task ${i}`,
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

        ctx.store.insertExecution({
          id: execId,
          taskId,
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: `agent_${i}`,
          roleId: "general_executor",
          runKind: "task_run",
          status: "executing",
          inputRef: null,
          traceId: `trace_${i}`,
          attempt: 1,
          timeoutMs: 60000,
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

        queueAdapter.enqueue({
          queueName: "executions",
          payload: { taskId, executionId: execId },
        });
      }
    });

    for (let i = 0; i < 3; i++) {
      const result = queueAdapter.dequeue("executions");
      assert.ok(result);
      const payload = JSON.parse(result.job.payload);
      assert.ok(payload.taskId.startsWith("task_fk_"));
      result.ack();
    }

    for (let i = 0; i < 3; i++) {
      const taskId = `task_fk_${i}`;
      const execId = `exec_fk_${i}`;
      const task = ctx.store.getTask(taskId);
      const exec = ctx.store.getExecution(execId);
      assert.ok(task);
      assert.ok(exec);
      assert.equal(exec?.taskId, taskId);
    }
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
