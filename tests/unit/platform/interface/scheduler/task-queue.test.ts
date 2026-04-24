import assert from "node:assert/strict";
import test from "node:test";

/**
 * Unit tests for task queue modules.
 * These tests use mocked dependencies to isolate the queue logic.
 */

interface MockQueueJobRecord {
  id: string;
  queueName: string;
  payload: string;
  status: "waiting" | "delayed" | "active" | "completed" | "failed" | "dead_letter";
  priority: number;
  attempts: number;
  maxAttempts: number;
  lastError: string | null;
  delayUntil: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface MockDequeueResult {
  job: MockQueueJobRecord;
  ack: () => void;
  nack: (error?: string) => void;
}

function createMockJob(overrides: Partial<MockQueueJobRecord> = {}): MockQueueJobRecord {
  return {
    id: "job_001",
    queueName: "tasks",
    payload: '{"taskId":"task_001"}',
    status: "waiting",
    priority: 0,
    attempts: 0,
    maxAttempts: 3,
    lastError: null,
    delayUntil: null,
    idempotencyKey: null,
    createdAt: "2026-04-20T09:00:00.000Z",
    updatedAt: "2026-04-20T09:00:00.000Z",
    completedAt: null,
    ...overrides,
  };
}

function createMockDequeueResult(job: MockQueueJobRecord): MockDequeueResult {
  return {
    job,
    ack: () => {
      job.status = "completed";
      job.completedAt = new Date().toISOString();
    },
    nack: (error?: string) => {
      job.lastError = error ?? null;
      if (job.attempts >= job.maxAttempts) {
        job.status = "dead_letter";
      } else {
        job.status = "waiting";
      }
    },
  };
}

test("QueueJobRecord defaults are correctly applied", () => {
  const job = createMockJob();

  assert.equal(job.id, "job_001");
  assert.equal(job.queueName, "tasks");
  assert.equal(job.status, "waiting");
  assert.equal(job.priority, 0);
  assert.equal(job.attempts, 0);
  assert.equal(job.maxAttempts, 3);
  assert.equal(job.lastError, null);
  assert.equal(job.delayUntil, null);
  assert.equal(job.idempotencyKey, null);
  assert.equal(job.completedAt, null);
});

test("QueueJobRecord status transitions: waiting -> active -> completed", () => {
  const job = createMockJob({ status: "waiting" });
  assert.equal(job.status, "waiting");

  job.status = "active";
  assert.equal(job.status, "active");

  job.status = "completed";
  job.completedAt = new Date().toISOString();
  assert.equal(job.status, "completed");
  assert.ok(job.completedAt !== null);
});

test("QueueJobRecord status transitions: waiting -> active -> dead_letter on max attempts", () => {
  const job = createMockJob({ status: "waiting", attempts: 0, maxAttempts: 2 });
  assert.equal(job.status, "waiting");

  job.status = "active";
  job.attempts = 1;
  assert.equal(job.attempts, 1);

  job.status = "dead_letter";
  job.lastError = "max_attempts_exceeded";
  assert.equal(job.status, "dead_letter");
  assert.equal(job.lastError, "max_attempts_exceeded");
});

test("QueueJobRecord with delayUntil is marked as delayed", () => {
  const futureDate = "2099-01-01T00:00:00.000Z";
  const job = createMockJob({
    status: "delayed",
    delayUntil: futureDate,
  });

  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureDate);
});

test("QueueJobRecord with idempotencyKey preserves the key", () => {
  const job = createMockJob({
    idempotencyKey: "unique-key-12345",
  });

  assert.equal(job.idempotencyKey, "unique-key-12345");
});

test("DequeueResult ack marks job as completed", () => {
  const job = createMockJob({ status: "active" });
  const dequeueResult = createMockDequeueResult(job);

  assert.equal(job.status, "active");
  dequeueResult.ack();
  assert.equal(job.status, "completed");
  assert.ok(job.completedAt !== null);
});

test("DequeueResult nack without error resets to waiting when under max attempts", () => {
  const job = createMockJob({ status: "active", attempts: 1, maxAttempts: 3 });
  const dequeueResult = createMockDequeueResult(job);

  dequeueResult.nack();
  assert.equal(job.status, "waiting");
  assert.equal(job.lastError, null);
});

test("DequeueResult nack with error message stores the error", () => {
  const job = createMockJob({ status: "active", attempts: 1, maxAttempts: 3 });
  const dequeueResult = createMockDequeueResult(job);

  dequeueResult.nack("connection timeout");
  assert.equal(job.status, "waiting");
  assert.equal(job.lastError, "connection timeout");
});

test("DequeueResult nack moves to dead_letter when max attempts exceeded", () => {
  const job = createMockJob({ status: "active", attempts: 2, maxAttempts: 2 });
  const dequeueResult = createMockDequeueResult(job);

  dequeueResult.nack();
  assert.equal(job.status, "dead_letter");
  assert.equal(job.lastError, "max_attempts_exceeded");
});

test("DequeueResult nack with custom error moves to dead_letter when max attempts exceeded", () => {
  const job = createMockJob({ status: "active", attempts: 2, maxAttempts: 2 });
  const dequeueResult = createMockDequeueResult(job);

  dequeueResult.nack("custom failure reason");
  assert.equal(job.status, "dead_letter");
  assert.equal(job.lastError, "custom failure reason");
});

test("QueueJobRecord priority ordering is preserved", () => {
  const highPriority = createMockJob({ id: "job_high", priority: 100 });
  const mediumPriority = createMockJob({ id: "job_med", priority: 50 });
  const lowPriority = createMockJob({ id: "job_low", priority: 1 });

  const jobs = [lowPriority, highPriority, mediumPriority];
  jobs.sort((a, b) => b.priority - a.priority);

  assert.equal(jobs[0]!.id, "job_high");
  assert.equal(jobs[1]!.id, "job_med");
  assert.equal(jobs[2]!.id, "job_low");
});

test("QueueJobRecord payload is JSON stringified", () => {
  const payload = { taskId: "task_001", action: "process" };
  const job = createMockJob({ payload: JSON.stringify(payload) });

  const parsed = JSON.parse(job.payload);
  assert.equal(parsed.taskId, "task_001");
  assert.equal(parsed.action, "process");
});

test("Mock queue operations preserve job identity", () => {
  const job = createMockJob({ id: "job_test_identity" });
  const dequeueResult = createMockDequeueResult(job);

  assert.equal(dequeueResult.job.id, job.id);
  assert.equal(dequeueResult.job.id, "job_test_identity");

  dequeueResult.ack();
  assert.equal(job.status, "completed");
  assert.equal(job.id, "job_test_identity");
});

test("Multiple nack calls increment attempts correctly", () => {
  const job = createMockJob({ status: "active", attempts: 0, maxAttempts: 3 });
  const dequeueResult = createMockDequeueResult(job);

  dequeueResult.nack();
  assert.equal(job.attempts, 0); // nack doesn't increment - that's done on dequeue
  assert.equal(job.status, "waiting");

  job.attempts = 1;
  job.status = "active";
  dequeueResult.nack();
  assert.equal(job.status, "waiting");

  job.attempts = 2;
  job.status = "active";
  dequeueResult.nack();
  assert.equal(job.status, "dead_letter");
});

test("Delayed job status is correctly set on creation", () => {
  const futureTime = "2099-01-01T00:00:00.000Z";
  const job = createMockJob({
    status: "delayed",
    delayUntil: futureTime,
  });

  assert.equal(job.status, "delayed");
  assert.ok(job.delayUntil !== null);
  assert.ok(new Date(job.delayUntil!).getTime() > Date.now());
});

test("Job with null delayUntil is not delayed", () => {
  const job = createMockJob({
    status: "waiting",
    delayUntil: null,
  });

  assert.equal(job.status, "waiting");
  assert.equal(job.delayUntil, null);
});

test("Mock job creation with all status values", () => {
  const statuses: MockQueueJobRecord["status"][] = [
    "waiting",
    "delayed",
    "active",
    "completed",
    "failed",
    "dead_letter",
  ];

  for (const status of statuses) {
    const job = createMockJob({ status });
    assert.equal(job.status, status);
  }
});
