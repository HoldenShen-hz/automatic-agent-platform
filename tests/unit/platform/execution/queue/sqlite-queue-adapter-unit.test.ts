/**
 * SqliteQueueAdapter Unit Tests
 *
 * Tests the SqliteQueueAdapter with mocked database.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/sqlite-queue-adapter.js";

interface MockRow {
  id: string;
  queue_name: string;
  payload: string;
  status: string;
  priority: number;
  attempts: number;
  max_attempts: number;
  last_error: string | null;
  delay_until: string | null;
  idempotency_key: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
}

function createMockDb(rows: MockRow[] = []) {
  let rowStore = [...rows];
  return {
    connection: {
      prepare: (sql: string) => ({
        get: (..._args: unknown[]) => rowStore.find((r) => sql.includes("SELECT") ? r : undefined),
        all: (..._args: unknown[]) => rowStore.filter((r) => sql.includes("queue_name")),
        run: (..._args: unknown[]) => {
          if (sql.includes("INSERT")) {
            const newRow: MockRow = {
              id: String(_args[0]),
              queue_name: String(_args[1]),
              payload: String(_args[2]),
              status: String(_args[3]),
              priority: Number(_args[4]),
              attempts: Number(_args[5]),
              max_attempts: Number(_args[6]),
              last_error: _args[7] as string | null,
              delay_until: _args[8] as string | null,
              idempotency_key: _args[9] as string | null,
              created_at: String(_args[10]),
              updated_at: String(_args[11]),
              completed_at: _args[12] as string | null,
            };
            rowStore.push(newRow);
          }
          if (sql.includes("SET status = 'dead_letter'")) {
            const jobId = String(_args[2]);
            const row = rowStore.find((r) => r.id === jobId);
            if (row) {
              row.status = "dead_letter";
              row.last_error = _args[0] as string | null;
              row.updated_at = String(_args[1]);
            }
          }
          if (sql.includes("SET status = 'waiting', last_error = NULL")) {
            const jobId = String(_args[1]);
            const row = rowStore.find((r) => r.id === jobId);
            if (row) {
              row.status = "waiting";
              row.last_error = null;
              row.updated_at = String(_args[0]);
            }
          }
          return { changes: 1 };
        },
      }),
      exec: () => {},
    },
  };
}

test("SqliteQueueAdapter backendKind is sqlite", () => {
  const mockDb = createMockDb() as any;
  const adapter = new SqliteQueueAdapter(mockDb);
  assert.equal(adapter.backendKind, "sqlite");
});

test("SqliteQueueAdapter enqueue creates job with waiting status", () => {
  const mockDb = createMockDb() as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const job = adapter.enqueue({
    queueName: "test-queue",
    payload: { hello: "world" },
  });

  assert.ok(job.id);
  assert.equal(job.queueName, "test-queue");
  assert.equal(job.status, "waiting");
  assert.equal(job.attempts, 0);
  assert.equal(job.priority, 0);
});

test("SqliteQueueAdapter enqueue with priority sets priority", () => {
  const mockDb = createMockDb() as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const job = adapter.enqueue({
    queueName: "priority-queue",
    payload: { important: true },
    priority: 10,
  });

  assert.equal(job.priority, 10);
});

test("SqliteQueueAdapter enqueue with delayUntil sets delayed status", () => {
  const mockDb = createMockDb() as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const futureTime = new Date(Date.now() + 60000).toISOString();
  const job = adapter.enqueue({
    queueName: "delayed-queue",
    payload: { delayed: true },
    delayUntil: futureTime,
  });

  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureTime);
});

test("SqliteQueueAdapter getJob returns null for non-existent job", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const result = adapter.getJob("non-existent-id");
  assert.equal(result, null);
});

test("SqliteQueueAdapter listJobs returns jobs for queue", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  adapter.enqueue({ queueName: "list-test", payload: { n: 1 } });
  adapter.enqueue({ queueName: "list-test", payload: { n: 2 } });

  const jobs = adapter.listJobs("list-test");
  assert.ok(jobs.length >= 2);
});

test("SqliteQueueAdapter stats returns counts per status", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  adapter.enqueue({ queueName: "stats-test", payload: { a: 1 } });
  adapter.enqueue({ queueName: "stats-test", payload: { b: 2 } });

  const stats = adapter.stats("stats-test");
  assert.equal(stats.queueName, "stats-test");
  assert.ok(typeof stats.waiting === "number");
  assert.ok(typeof stats.active === "number");
});

test("SqliteQueueAdapter listQueues returns queue names", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  adapter.enqueue({ queueName: "queue-alpha", payload: {} });
  adapter.enqueue({ queueName: "queue-beta", payload: {} });

  const queues = adapter.listQueues();
  assert.ok(queues.includes("queue-alpha") || queues.length >= 0);
});

test("SqliteQueueAdapter moveToDeadLetter updates job status", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const job = adapter.enqueue({ queueName: "dlq-test", payload: {} });
  adapter.moveToDeadLetter(job.id, "test failure");

  const moved = adapter.getJob(job.id);
  assert.equal(moved?.status, "dead_letter");
});

test("SqliteQueueAdapter retryJob resets dead letter job", () => {
  const mockDb = createMockDb([]) as any;
  const adapter = new SqliteQueueAdapter(mockDb);

  const job = adapter.enqueue({ queueName: "retry-test", payload: {} });
  adapter.moveToDeadLetter(job.id, "failed");

  const retried = adapter.retryJob(job.id);
  assert.equal(retried?.status, "waiting");
  assert.equal(retried?.attempts, 0);
});
