import assert from "node:assert/strict";
import test from "node:test";

import { SqliteQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter.js";
import type { AuthoritativeSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";
import type { RawRow } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

function createMockDb(rows: RawRow[] = []): AuthoritativeSqlDatabase {
  let data = [...rows];
  let updateCalls: unknown[][] = [];

  return {
    connection: {
      prepare: (_sql: string) => {
        // Handle the SELECT for waiting jobs
        if (_sql.includes("SELECT * FROM queue_jobs WHERE queue_name = ? AND status = 'waiting'")) {
          return {
            get: (...args: unknown[]) => {
              const waiting = data.filter(r => r.queue_name === args[0] && r.status === "waiting");
              if (waiting.length === 0) return null;
              // Sort by priority DESC, created_at ASC
              waiting.sort((a, b) => {
                const pa = Number((a as any).priority) || 0;
                const pb = Number((b as any).priority) || 0;
                if (pb !== pa) return pb - pa;
                return new Date((a as any).created_at).getTime() - new Date((b as any).created_at).getTime();
              });
              return waiting[0];
            },
          };
        }
        // Handle UPDATE for delayed jobs (activation to waiting)
        if (_sql.includes("UPDATE queue_jobs SET status = 'waiting'") && _sql.includes("status = 'delayed'")) {
          return {
            run: (...args: unknown[]) => {
              updateCalls.push(args);
              data = data.map(r => {
                const row = r as any;
                if (row.queue_name === args[1] && row.status === "delayed" && row.delay_until <= args[2]) {
                  return { ...r, status: "waiting", updated_at: args[0] };
                }
                return r;
              });
            },
          };
        }
        // Handle UPDATE for active (dequeue activation)
        if (_sql.includes("UPDATE queue_jobs SET status = 'active'")) {
          return {
            run: (...args: unknown[]) => {
              data = data.map(r => {
                if (r.id === args[1]) {
                  return { ...r, status: "active", attempts: (Number(r.attempts) || 0) + 1, updated_at: args[0] };
                }
                return r;
              });
            },
          };
        }
        // Handle SELECT attempts, max_attempts for nack
        if (_sql.includes("SELECT attempts, max_attempts FROM queue_jobs WHERE id = ?")) {
          return {
            get: (...args: unknown[]) => {
              return data.find(r => r.id === args[0]) ?? null;
            },
          };
        }
        // Handle UPDATE for completed (ack)
        if (_sql.includes("UPDATE queue_jobs SET status = 'completed'")) {
          return {
            run: (...args: unknown[]) => {
              data = data.map(r => {
                if (r.id === args[2]) {
                  return { ...r, status: "completed", completed_at: args[0], updated_at: args[1] };
                }
                return r;
              });
            },
          };
        }
        // Handle UPDATE for dead_letter (nack with max attempts exceeded)
        if (_sql.includes("UPDATE queue_jobs SET status = 'dead_letter'")) {
          return {
            run: (...args: unknown[]) => {
              data = data.map(r => {
                if (r.id === args[2]) {
                  return { ...r, status: "dead_letter", last_error: args[0], updated_at: args[1] };
                }
                return r;
              });
            },
          };
        }
        // Handle UPDATE for waiting (nack with retries remaining) - nack does NOT reset attempts
        if (_sql.includes("UPDATE queue_jobs SET status = 'waiting'") && _sql.includes("last_error")) {
          return {
            run: (...args: unknown[]) => {
              data = data.map(r => {
                if (r.id === args[2]) {
                  return { ...r, status: "waiting", last_error: args[0], updated_at: args[1] };
                }
                return r;
              });
            },
          };
        }
        // Default: SELECT by id (getJob)
        return {
          get: (..._args: unknown[]) => data.find(r => r.id === _args[0]) ?? null,
          all: (..._args: unknown[]) => data,
          run: () => {},
        };
      },
      exec: () => {},
    },
  } as unknown as AuthoritativeSqlDatabase;
}

test("dequeue returns null for empty queue [dequeue]", () => {
  const db = createMockDb();
  const adapter = new SqliteQueueAdapter(db);
  assert.equal(adapter.dequeue("nonexistent"), null);
});

test("dequeue returns job with ack and nack functions [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "tasks",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("tasks");
  assert.ok(result);
  assert.equal(result.job.queueName, "tasks");
  assert.equal(result.job.status, "active");
  assert.equal(typeof result.ack, "function");
  assert.equal(typeof result.nack, "function");
});

test("dequeue selects job by priority descending [dequeue]", () => {
  const db = createMockDb([
    { id: "qjob_1", queue_name: "q", payload: JSON.stringify("low"), status: "waiting", priority: 1, attempts: 0, max_attempts: 3, last_error: null, delay_until: null, idempotency_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null },
    { id: "qjob_2", queue_name: "q", payload: JSON.stringify("high"), status: "waiting", priority: 10, attempts: 0, max_attempts: 3, last_error: null, delay_until: null, idempotency_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null },
    { id: "qjob_3", queue_name: "q", payload: JSON.stringify("medium"), status: "waiting", priority: 5, attempts: 0, max_attempts: 3, last_error: null, delay_until: null, idempotency_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null },
  ]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result);
  assert.equal(JSON.parse(result.job.payload), "high");
});

test("dequeue activates delayed jobs past their delayUntil [dequeue]", () => {
  const now = new Date();
  const past = new Date(now.getTime() - 1000).toISOString();
  const future = new Date(now.getTime() + 60000).toISOString();

  const db = createMockDb([
    { id: "qjob_1", queue_name: "q", payload: JSON.stringify("future_delayed"), status: "delayed", priority: 0, attempts: 0, max_attempts: 3, last_error: null, delay_until: future, idempotency_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null },
    { id: "qjob_2", queue_name: "q", payload: JSON.stringify("ready"), status: "delayed", priority: 0, attempts: 0, max_attempts: 3, last_error: null, delay_until: past, idempotency_key: null, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), completed_at: null },
  ]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result);
  assert.equal(JSON.parse(result.job.payload), "ready");
});

test("dequeue increments job attempts [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.equal(result!.job.attempts, 1);
});

test("ack marks job as completed [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  result.ack();
  const job = adapter.getJob("qjob_1");
  assert.equal(job?.status, "completed");
  assert.ok(job?.completedAt);
});

test("nack without error retries job when under maxAttempts [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  result.nack();
  const job = adapter.getJob("qjob_1");
  assert.equal(job?.status, "waiting");
  // After nack, attempts stays at 1 (nack does not reset attempts)
  // dequeue again to verify job is back in rotation
  const result2 = adapter.dequeue("q");
  assert.ok(result2);
  assert.equal(result2.job.attempts, 2);
});

test("nack with error retries job with lastError set [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  result.nack("transient_error");
  const job = adapter.getJob("qjob_1");
  assert.equal(job?.status, "waiting");
  assert.equal(job?.lastError, "transient_error");
});

test("nack moves job to dead letter when maxAttempts exceeded [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  result.nack("still_failing");
  // First nack: attempts=1 (< max_attempts=3), back to waiting
  const job1 = adapter.getJob("qjob_1");
  assert.equal(job1?.status, "waiting");
  // Second dequeue + nack
  const result2 = adapter.dequeue("q");
  assert.ok(result2);
  result2.nack("still_failing");
  // Third dequeue + nack -> attempts=3 == max_attempts=3 -> dead_letter
  const result3 = adapter.dequeue("q");
  assert.ok(result3);
  result3.nack("final_failure");
  const job = adapter.getJob("qjob_1");
  assert.equal(job?.status, "dead_letter");
  assert.equal(job?.lastError, "final_failure");
});

test("dequeue returns null when all jobs are delayed [dequeue]", () => {
  const now = new Date();
  const future = new Date(now.getTime() + 60000).toISOString();

  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "delayed",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: future,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.equal(result, null);
});

test("ack returns void (no error thrown) [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  assert.doesNotThrow(() => result.ack());
});

test("nack with default error uses max_attempts_exceeded [dequeue]", () => {
  const db = createMockDb([{
    id: "qjob_1",
    queue_name: "q",
    payload: JSON.stringify({ taskId: "t1" }),
    status: "waiting",
    priority: 0,
    attempts: 0,
    max_attempts: 3,
    last_error: null,
    delay_until: null,
    idempotency_key: null,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    completed_at: null,
  }]);
  const adapter = new SqliteQueueAdapter(db);
  const result = adapter.dequeue("q");
  assert.ok(result, "dequeue should return a job");
  result.nack("still_failing");
  // Now retry and nack two more times to hit dead letter
  const result2 = adapter.dequeue("q");
  assert.ok(result2);
  result2.nack();
  const result3 = adapter.dequeue("q");
  assert.ok(result3);
  result3.nack();
  const job = adapter.getJob("qjob_1");
  assert.equal(job?.status, "dead_letter");
  assert.equal(job?.lastError, "max_attempts_exceeded");
});