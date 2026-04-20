import assert from "node:assert/strict";
import test from "node:test";

// Re-export test for barrel file
import type {
  QueueBackendKind,
  QueueJobStatus,
  QueueJobRecord,
  EnqueueInput,
  DequeueResult,
  QueueStats,
  RetryPolicy,
} from "../../../../../src/platform/execution/queue/index.js";

test("QueueBackendKind type accepts valid values", () => {
  const kinds: QueueBackendKind[] = ["sqlite", "redis"];
  assert.equal(kinds.length, 2);
});

test("QueueJobStatus type accepts valid values", () => {
  const statuses: QueueJobStatus[] = [
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
    "dead_letter",
  ];
  assert.equal(statuses.length, 6);
});

test("QueueJobRecord structure is correct", () => {
  const record: QueueJobRecord = {
    id: "job_1",
    queueName: "default",
    payload: '{"task":"test"}',
    status: "waiting",
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    delayUntil: null,
    idempotencyKey: null,
    createdAt: "2026-04-14T00:00:00.000Z",
    updatedAt: "2026-04-14T00:00:00.000Z",
    completedAt: null,
  };
  assert.equal(record.id, "job_1");
  assert.equal(record.queueName, "default");
  assert.equal(record.status, "waiting");
  assert.equal(record.priority, 0);
  assert.equal(record.attempts, 0);
  assert.equal(record.maxAttempts, 3);
});

test("EnqueueInput structure is correct", () => {
  const input: EnqueueInput = {
    queueName: "test-queue",
    payload: { taskId: "task_1" },
    priority: 5,
    maxAttempts: 5,
    delayUntil: null,
    idempotencyKey: "key_123",
  };
  assert.equal(input.queueName, "test-queue");
  assert.deepEqual(input.payload, { taskId: "task_1" });
  assert.equal(input.priority, 5);
  assert.equal(input.maxAttempts, 5);
});

test("QueueStats structure is correct", () => {
  const stats: QueueStats = {
    queueName: "test-queue",
    waiting: 10,
    delayed: 5,
    active: 3,
    completed: 100,
    failed: 2,
    deadLetter: 1,
  };
  assert.equal(stats.queueName, "test-queue");
  assert.equal(stats.waiting, 10);
  assert.equal(stats.completed, 100);
});

test("RetryPolicy structure is correct", () => {
  const policy: RetryPolicy = {
    maxAttempts: 5,
    backoffMs: 2000,
    backoffMultiplier: 1.5,
  };
  assert.equal(policy.maxAttempts, 5);
  assert.equal(policy.backoffMs, 2000);
  assert.equal(policy.backoffMultiplier, 1.5);
});
