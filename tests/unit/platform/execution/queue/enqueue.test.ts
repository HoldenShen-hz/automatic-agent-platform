import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { RawRow } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

function createMockDb(rows: RawRow[] = []): AuthoritativeSqlDatabase {
  let data = [...rows];

  return {
    connection: {
      prepare: (_sql: string) => {
        if (_sql.includes("SELECT * FROM queue_jobs WHERE queue_name = ? AND idempotency_key = ?")) {
          return {
            get: (...args: unknown[]) => {
              return data.find(r => r.queue_name === args[0] && r.idempotency_key === args[1]) ?? null;
            },
          };
        }
        return {
          get: (..._args: unknown[]) => data.find(r => r.id === _args[0]) ?? null,
          all: (..._args: unknown[]) => data,
          run: (..._args: unknown[]) => {
            const id = _args[0] as string;
            const [queue_name, payload, status, priority, attempts, max_attempts, last_error, delay_until, idempotency_key, created_at, updated_at, completed_at] = _args.slice(1, 13);
            if (!data.find(r => r.id === id)) {
              data.push({
                id,
                queue_name,
                payload,
                status,
                priority,
                attempts,
                max_attempts,
                last_error,
                delay_until,
                idempotency_key,
                created_at,
                updated_at,
                completed_at,
              });
            }
          },
        };
      },
      exec: (_sql: string) => {},
    },
  } as unknown as AuthoritativeSqlDatabase;
}

test("enqueue creates job with waiting status", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "tasks", payload: { taskId: "t1" } });
  assert.equal(job.queueName, "tasks");
  assert.equal(job.status, "waiting");
  assert.equal(job.attempts, 0);
  assert.equal(job.priority, 0);
  assert.ok(job.id.startsWith("qjob_"));
});

test("enqueue sets custom priority", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data", priority: 10 });
  assert.equal(job.priority, 10);
});

test("enqueue sets custom maxAttempts", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data", maxAttempts: 5 });
  assert.equal(job.maxAttempts, 5);
});

test("enqueue serializes payload to JSON string", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: { nested: { value: 123 } } });
  assert.equal(job.payload, JSON.stringify({ nested: { value: 123 } }));
});

test("enqueue with delayUntil sets status to delayed", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const futureDate = new Date(Date.now() + 10_000).toISOString();
  const job = adapter.enqueue({ queueName: "q", payload: "data", delayUntil: futureDate });
  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureDate);
});

test("enqueue without delay sets status to waiting", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data" });
  assert.equal(job.status, "waiting");
  assert.equal(job.delayUntil, null);
});

test("enqueue with idempotencyKey returns existing job if duplicate", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job1 = adapter.enqueue({ queueName: "q", payload: "first", idempotencyKey: "key-1" });
  const job2 = adapter.enqueue({ queueName: "q", payload: "duplicate", idempotencyKey: "key-1" });
  assert.equal(job1.id, job2.id);
  assert.equal(job1.queueName, job2.queueName);
});

test("enqueue returns job with all timestamps", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data" });
  assert.ok(job.createdAt);
  assert.ok(job.updatedAt);
  assert.equal(job.completedAt, null);
});

test("enqueue accepts null idempotencyKey", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data", idempotencyKey: null });
  assert.equal(job.idempotencyKey, null);
});

test("enqueue accepts null delayUntil", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data", delayUntil: null });
  assert.equal(job.delayUntil, null);
  assert.equal(job.status, "waiting");
});

test("enqueue stores lastError as null initially", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  const job = adapter.enqueue({ queueName: "q", payload: "data" });
  assert.equal(job.lastError, null);
});