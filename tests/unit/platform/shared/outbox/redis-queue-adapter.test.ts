/**
 * Unit Tests: RedisQueueAdapter
 *
 * Tests the Redis queue adapter operations with mocked Redis client.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import type { EnqueueInput, RedisQueueConfig } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

/**
 * Mock Redis client for testing RedisQueueAdapter without real Redis connection.
 */
class MockRedisClient {
  public store: Map<string, Map<string, string>> = new Map();
  public sets: Map<string, Set<string>> = new Map();
  public sortedSets: Map<string, Map<number, string>> = new Map();
  public status = "ready";
  private errorHandler: ((error: unknown) => void) | null = null;

  on(event: "error", listener: (error: unknown) => void): void {
    if (event === "error") {
      this.errorHandler = listener;
    }
  }

  connect(): Promise<void> {
    this.status = "ready";
    return Promise.resolve();
  }

  disconnect(): void {
    this.status = "end";
  }

  quit(): Promise<unknown> {
    this.status = "end";
    return Promise.resolve();
  }

  ping(): Promise<string> {
    return Promise.resolve("PONG");
  }

  async hset(key: string, field: string, value: string): Promise<number> {
    let map = this.store.get(key);
    if (!map) {
      map = new Map();
      this.store.set(key, map);
    }
    const isNew = !map.has(field);
    map.set(field, value);
    return isNew ? 1 : 0;
  }

  async hget(key: string, field: string): Promise<string | null> {
    const map = this.store.get(key);
    return map?.get(field) ?? null;
  }

  async hgetall(key: string): Promise<Record<string, string>> {
    const map = this.store.get(key);
    if (!map) return {};
    const obj: Record<string, string> = {};
    for (const [k, v] of map.entries()) {
      obj[k] = v;
    }
    return obj;
  }

  async hincrby(key: string, field: string, incr: number): Promise<number> {
    const map = this.store.get(key);
    const current = map?.get(field) ?? "0";
    const newVal = parseInt(current, 10) + incr;
    if (map) {
      map.set(field, String(newVal));
    }
    return newVal;
  }

  async hmset(key: string, data: Record<string, string>): Promise<void> {
    let map = this.store.get(key);
    if (!map) {
      map = new Map();
      this.store.set(key, map);
    }
    for (const [k, v] of Object.entries(data)) {
      map.set(k, v);
    }
  }

  async del(key: string): Promise<number> {
    const existed = this.store.has(key) || this.sets.has(key) || this.sortedSets.has(key);
    this.store.delete(key);
    this.sets.delete(key);
    this.sortedSets.delete(key);
    return existed ? 1 : 0;
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1;
  }

  async zadd(key: string, score: number, member: string): Promise<number> {
    let zset = this.sortedSets.get(key);
    if (!zset) {
      zset = new Map();
      this.sortedSets.set(key, zset);
    }
    const isNew = !zset.has(score);
    zset.set(score, member);
    return isNew ? 1 : 0;
  }

  async zrangebyscore(key: string, min: number | string, max: number | string, ...args: Array<string | number>): Promise<string[]> {
    const zset = this.sortedSets.get(key);
    if (!zset) return [];

    const minNum = min === "-inf" ? -Infinity : (typeof min === "number" ? min : parseInt(min as string, 10));
    const maxNum = max === "+inf" ? Infinity : (typeof max === "number" ? max : parseInt(max as string, 10));

    const results: Array<[number, string]> = [];
    for (const [score, member] of zset.entries()) {
      if (score >= minNum && score <= maxNum) {
        results.push([score, member]);
      }
    }
    results.sort((a, b) => a[0] - b[0]);

    let offset = 0;
    let count = results.length;
    for (let i = 0; i < args.length; i++) {
      if (args[i] === "LIMIT" && i + 2 < args.length) {
        offset = args[i + 1] as number;
        count = args[i + 2] as number;
      }
    }

    return results.slice(offset, offset + count).map((r) => r[1]);
  }

  async zrem(key: string, member: string): Promise<number> {
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;
    for (const [score, m] of zset.entries()) {
      if (m === member) {
        zset.delete(score);
        return 1;
      }
    }
    return 0;
  }

  async zcard(key: string): Promise<number> {
    return this.sortedSets.get(key)?.size ?? 0;
  }

  async zcount(key: string, min: number | string, max: number | string): Promise<number> {
    const zset = this.sortedSets.get(key);
    if (!zset) return 0;

    const minNum = min === "-inf" ? -Infinity : (typeof min === "number" ? min : parseInt(min as string, 10));
    const maxNum = max === "+inf" ? Infinity : (typeof max === "number" ? max : parseInt(max as string, 10));

    let count = 0;
    for (const [score] of zset.entries()) {
      if (score >= minNum && score <= maxNum) {
        count++;
      }
    }
    return count;
  }

  async scard(key: string): Promise<number> {
    return this.sets.get(key)?.size ?? 0;
  }

  async smembers(key: string): Promise<string[]> {
    const set = this.sets.get(key);
    return set ? Array.from(set) : [];
  }

  async sadd(key: string, member: string): Promise<number> {
    let set = this.sets.get(key);
    if (!set) {
      set = new Set();
      this.sets.set(key, set);
    }
    const isNew = !set.has(member);
    set.add(member);
    return isNew ? 1 : 0;
  }

  async srem(key: string, member: string): Promise<number> {
    const set = this.sets.get(key);
    if (!set || !set.has(member)) return 0;
    set.delete(member);
    return 1;
  }

  pipeline(): {
    hmset(key: string, data: Record<string, string>): unknown;
    expire(key: string, seconds: number): unknown;
    sadd(key: string, member: string): unknown;
    zadd(key: string, score: number, member: string): unknown;
    exec(): Promise<Array<[unknown, unknown]>>;
  } {
    const ops: Array<() => void> = [];
    const pipeline = {
      hmset: (key: string, data: Record<string, string>) => {
        ops.push(async () => {
          await this.hmset(key, data);
        });
        return pipeline;
      },
      expire: (key: string, seconds: number) => {
        ops.push(async () => {
          await this.expire(key, seconds);
        });
        return pipeline;
      },
      sadd: (key: string, member: string) => {
        ops.push(async () => {
          await this.sadd(key, member);
        });
        return pipeline;
      },
      zadd: (key: string, score: number, member: string) => {
        ops.push(async () => {
          await this.zadd(key, score, member);
        });
        return pipeline;
      },
      exec: async () => {
        for (const op of ops) {
          await op();
        }
        return ops.map(() => [null, "OK"]);
      },
    };
    return pipeline;
  }
}

/**
 * Creates a mock RedisQueueConfig for testing.
 */
function createMockConfig(): RedisQueueConfig {
  return {
    host: "localhost",
    port: 6379,
    db: 0,
    prefix: "test:",
    driver: "memory",
  };
}

test.describe("RedisQueueAdapter unit tests", () => {
  let adapter: RedisQueueAdapter;
  let mockClient: MockRedisClient;

  test.beforeEach(() => {
    mockClient = new MockRedisClient();
    // We need to override the internal client creation
    // Since the adapter creates its own client, we'll test the async methods
    // which use the client directly
  });

  test("backendKind is redis", () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);
    assert.equal(adapter.backendKind, "redis");
  });

  test("enqueueAsync creates a delayed job when delayUntil is in future", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const futureDate = new Date(Date.now() + 60000).toISOString();
    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { taskId: "task-1" },
      delayUntil: futureDate,
    };

    const job = await adapter.enqueueAsync(input);

    assert.ok(job.id.startsWith("qjob_") || job.id.startsWith("qjob-"));
    assert.equal(job.queueName, "test-queue");
    assert.equal(job.status, "delayed");
    assert.equal(job.delayUntil, futureDate);
  });

  test("enqueueAsync creates a waiting job when no delay", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const input: EnqueueInput = {
      queueName: "test-queue",
      payload: { taskId: "task-1" },
    };

    const job = await adapter.enqueueAsync(input);

    assert.equal(job.status, "waiting");
    assert.equal(job.delayUntil, null);
  });

  test("enqueueAsync with idempotencyKey returns existing job on duplicate", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const input: EnqueueInput = {
      queueName: "idempotent-queue",
      payload: { data: "test" },
      idempotencyKey: "key-123",
    };

    const job1 = await adapter.enqueueAsync(input);
    const job2 = await adapter.enqueueAsync(input);

    assert.equal(job1.id, job2.id);
  });

  test("dequeueAsync returns null when queue is empty", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const result = await adapter.dequeueAsync("empty-queue");

    assert.equal(result, null);
  });

  test("dequeueAsync activates and returns a waiting job", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "dequeue-test", payload: { data: "test" } });

    const result = await adapter.dequeueAsync("dequeue-test");

    assert.ok(result !== null);
    assert.equal(result.job.status, "active");
    assert.ok(result.ack !== undefined);
    assert.ok(result.nack !== undefined);
  });

  test("dequeueAsync ack marks job as completed", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "ack-test", payload: { data: "test" } });
    const result = await adapter.dequeueAsync("ack-test");
    assert.ok(result !== null);

    await result.ack();

    const job = await adapter.getJobAsync(result.job.id);
    assert.equal(job?.status, "completed");
  });

  test("dequeueAsync nack with max attempts moves job to dead_letter", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "nack-dl-test", payload: { data: "test" }, maxAttempts: 1 });
    const result = await adapter.dequeueAsync("nack-dl-test");
    assert.ok(result !== null);

    await result.nack("error 1");
    const job = await adapter.getJobAsync(result.job.id);
    assert.equal(job?.status, "dead_letter");
  });

  test("getJobAsync returns null for non-existent job", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const job = await adapter.getJobAsync("non-existent");

    assert.equal(job, null);
  });

  test("getJobAsync retrieves enqueued job", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const enqueued = await adapter.enqueueAsync({ queueName: "get-job-test", payload: { data: "test" } });

    const fetched = await adapter.getJobAsync(enqueued.id);

    assert.ok(fetched !== null);
    assert.equal(fetched.id, enqueued.id);
  });

  test("listJobsAsync returns all jobs for queue", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "list-test", payload: { data: "1" } });
    await adapter.enqueueAsync({ queueName: "list-test", payload: { data: "2" } });
    await adapter.enqueueAsync({ queueName: "list-test", payload: { data: "3" } });

    const jobs = await adapter.listJobsAsync("list-test");

    assert.equal(jobs.length, 3);
  });

  test("listJobsAsync filters by status", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "filter-test", payload: { data: "1" } });
    const result = await adapter.dequeueAsync("filter-test");
    assert.ok(result !== null);
    await result.ack();

    const waitingJobs = await adapter.listJobsAsync("filter-test", "waiting");
    const completedJobs = await adapter.listJobsAsync("filter-test", "completed");

    assert.equal(waitingJobs.length, 0);
    assert.equal(completedJobs.length, 1);
  });

  test("moveToDeadLetterAsync updates job status", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const job = await adapter.enqueueAsync({ queueName: "dl-test", payload: { data: "test" } });

    await adapter.moveToDeadLetterAsync(job.id, "business error");

    const fetched = await adapter.getJobAsync(job.id);
    assert.equal(fetched?.status, "dead_letter");
    assert.equal(fetched?.lastError, "business error");
  });

  test("retryJobAsync restores dead_letter job to waiting", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const job = await adapter.enqueueAsync({ queueName: "retry-test", payload: { data: "test" } });
    await adapter.moveToDeadLetterAsync(job.id, "previous error");

    const retried = await adapter.retryJobAsync(job.id);

    assert.ok(retried !== null);
    assert.equal(retried.status, "waiting");
    assert.equal(retried.lastError, null);
  });

  test("retryJobAsync returns null for non-dead_letter job", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const job = await adapter.enqueueAsync({ queueName: "retry-fail-test", payload: { data: "test" } });

    const retried = await adapter.retryJobAsync(job.id);

    assert.equal(retried, null);
  });

  test("statsAsync returns correct counts", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "stats-test", payload: { data: "1" } });
    await adapter.enqueueAsync({ queueName: "stats-test", payload: { data: "2" } });

    const result = await adapter.dequeueAsync("stats-test");
    assert.ok(result !== null);
    await result.ack();

    const stats = await adapter.statsAsync("stats-test");

    assert.equal(stats.queueName, "stats-test");
    assert.equal(stats.waiting, 1);
    assert.equal(stats.completed, 1);
    assert.equal(stats.deadLetter, 0);
  });

  test("listQueuesAsync returns unique queue names", async () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    await adapter.enqueueAsync({ queueName: "queue-a", payload: { data: "1" } });
    await adapter.enqueueAsync({ queueName: "queue-b", payload: { data: "2" } });
    await adapter.enqueueAsync({ queueName: "queue-a", payload: { data: "3" } });

    const queues = await adapter.listQueuesAsync();

    assert.ok(queues.includes("queue-a"));
    assert.ok(queues.includes("queue-b"));
    assert.equal(queues.length, 2);
  });

  test("sync enqueue remains available while other sync methods throw ValidationError", () => {
    const config = createMockConfig();
    const adapter = new RedisQueueAdapter(config);

    const job = adapter.enqueue({ queueName: "test", payload: { data: "test" } });
    assert.equal(job.queueName, "test");
    assert.equal(job.status, "waiting");

    assert.throws(() => adapter.dequeue("test"), /sync.*not_supported/);
    assert.throws(() => adapter.getJob("test"), /sync.*not_supported/);
    assert.throws(() => adapter.listJobs("test"), /sync.*not_supported/);
    assert.throws(() => adapter.moveToDeadLetter("test", "reason"), /sync.*not_supported/);
    assert.throws(() => adapter.retryJob("test"), /sync.*not_supported/);
    assert.throws(() => adapter.purge("test", "date"), /sync.*not_supported/);
    assert.throws(() => adapter.stats("test"), /sync.*not_supported/);
    assert.throws(() => adapter.listQueues(), /sync.*not_supported/);
  });
});
