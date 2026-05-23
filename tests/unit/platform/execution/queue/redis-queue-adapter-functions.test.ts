/**
 * RedisQueueAdapter Public Function Tests
 *
 * Tests for public methods on RedisQueueAdapter:
 * - enqueueAsync (edge cases and idempotency)
 * - dequeueAsync (ack/nack paths, delayed job handling)
 * - getJobAsync (not found, malformed data)
 * - listJobsAsync (filtering, limits)
 * - moveToDeadLetterAsync (job states)
 * - retryJobAsync (job states, reset behavior)
 * - statsAsync (queue stats calculation)
 * - listQueuesAsync (queue enumeration)
 * - purgeAsync (job cleanup)
 * - ping, close (connection management)
 * - sync enqueue (pipeline behavior)
 *
 * Uses mock Redis client to test behavior without live Redis connection.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisQueueAdapter } from "../../../../../src/platform/five-plane-execution/queue/redis-queue-adapter.js";
import type { QueueJobStatus } from "../../../../../src/platform/five-plane-execution/queue/queue-adapter-types.js";

// Helper to create adapter with mock redis client
function createAdapterWithMockRedis(mockRedis: any): RedisQueueAdapter {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  (adapter as unknown as { client: { redis: any } }).client.redis = mockRedis;
  return adapter;
}

// Helper to create mock Redis client with default implementations
function createMockRedisClient(overrides: Partial<{
  status: string;
  connect: () => Promise<void>;
  hset: (key: string, field: string, value: string) => Promise<number>;
  hget: (key: string, field: string) => Promise<string | null>;
  hgetall: (key: string) => Promise<Record<string, string>>;
  hincrby: (key: string, field: string, incr: number) => Promise<number>;
  hmset: (key: string, data: Record<string, string>) => Promise<unknown>;
  del: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<number>;
  zadd: (key: string, score: number, member: string) => Promise<number>;
  zrangebyscore: (key: string, min: number | string, max: number | string, ...args: Array<string | number>) => Promise<string[]>;
  zrem: (key: string, member: string) => Promise<number>;
  zcard: (key: string) => Promise<number>;
  zcount: (key: string, min: number | string, max: number | string) => Promise<number>;
  scard: (key: string) => Promise<number>;
  smembers: (key: string) => Promise<string[]>;
  sadd: (key: string, member: string) => Promise<number>;
  srem: (key: string, member: string) => Promise<number>;
  ping: () => Promise<string>;
  quit: () => Promise<unknown>;
  disconnect: () => void;
  on: (event: "error", listener: (error: unknown) => void) => void;
}> = {}): any {
  return {
    status: "ready",
    connect: async () => {},
    hset: async () => 1,
    hget: async () => null,
    hgetall: async () => ({}),
    hincrby: async () => 1,
    hmset: async () => {},
    del: async () => 1,
    expire: async () => 1,
    zadd: async () => 1,
    zrangebyscore: async () => [],
    zrem: async () => 1,
    zcard: async () => 0,
    zcount: async () => 0,
    scard: async () => 0,
    smembers: async () => [],
    sadd: async () => 1,
    srem: async () => 1,
    ping: async () => "PONG",
    quit: async () => {},
    disconnect: () => {},
    on: () => {},
    ...overrides,
  };
}

// =============================================================================
// backendKind property
// =============================================================================

test("RedisQueueAdapter has backendKind of redis", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  assert.equal(adapter.backendKind, "redis");
});

test("RedisQueueAdapter uses in-memory redis when AA_RUNNING_TESTS is enabled", async () => {
  const previousRunningTests = process.env.AA_RUNNING_TESTS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AA_RUNNING_TESTS = "1";
  process.env.NODE_ENV = "test";

  try {
    const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
    assert.equal(await adapter.ping(), "PONG");
    await adapter.close();
  } finally {
    if (previousRunningTests == null) {
      delete process.env.AA_RUNNING_TESTS;
    } else {
      process.env.AA_RUNNING_TESTS = previousRunningTests;
    }
    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("RedisQueueAdapter in-memory client covers default config and empty-store branches", async () => {
  const previousRunningTests = process.env.AA_RUNNING_TESTS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AA_RUNNING_TESTS = "1";
  process.env.NODE_ENV = "test";

  try {
    const adapter = new RedisQueueAdapter({} as never);
    assert.equal(await adapter.getJobAsync("missing-job"), null);
    assert.deepEqual(await adapter.listQueuesAsync(), []);
    assert.deepEqual(await adapter.statsAsync("missing-queue"), {
      queueName: "missing-queue",
      waiting: 0,
      delayed: 0,
      active: 0,
      completed: 0,
      failed: 0,
      deadLetter: 0,
    });
    await adapter.close();
  } finally {
    if (previousRunningTests == null) {
      delete process.env.AA_RUNNING_TESTS;
    } else {
      process.env.AA_RUNNING_TESTS = previousRunningTests;
    }
    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

test("RedisQueueAdapter forbids in-memory redis in production test mode", () => {
  const previousRunningTests = process.env.AA_RUNNING_TESTS;
  const previousNodeEnv = process.env.NODE_ENV;
  process.env.AA_RUNNING_TESTS = "1";
  process.env.NODE_ENV = "production";

  try {
    assert.throws(() => new RedisQueueAdapter({ host: "localhost", port: 6379 }), /queue.redis_test_memory_forbidden_in_production/);
  } finally {
    if (previousRunningTests == null) {
      delete process.env.AA_RUNNING_TESTS;
    } else {
      process.env.AA_RUNNING_TESTS = previousRunningTests;
    }
    if (previousNodeEnv == null) {
      delete process.env.NODE_ENV;
    } else {
      process.env.NODE_ENV = previousNodeEnv;
    }
  }
});

// =============================================================================
// enqueue (sync) Tests
// =============================================================================

test("RedisQueueAdapter sync enqueue returns job immediately", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "test-queue", payload: { data: "test" } });

  assert.ok(job.id.startsWith("qjob_"));
  assert.equal(job.queueName, "test-queue");
  assert.equal(job.status, "waiting");
  assert.equal(job.attempts, 0);
});

test("RedisQueueAdapter sync enqueue sets delayed status for future date", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const futureDate = new Date(Date.now() + 60000).toISOString();
  const job = adapter.enqueue({
    queueName: "test-queue",
    payload: { data: "test" },
    delayUntil: futureDate,
  });

  assert.equal(job.status, "delayed");
  assert.equal(job.delayUntil, futureDate);
});

test("RedisQueueAdapter sync enqueue respects priority", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({
    queueName: "test-queue",
    payload: { data: "test" },
    priority: 99,
  });

  assert.equal(job.priority, 99);
});

test("RedisQueueAdapter sync enqueue uses default maxAttempts", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "test-queue", payload: { data: "test" } });

  assert.equal(job.maxAttempts, 3);
});

test("RedisQueueAdapter sync enqueue accepts custom maxAttempts", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({
    queueName: "test-queue",
    payload: { data: "test" },
    maxAttempts: 10,
  });

  assert.equal(job.maxAttempts, 10);
});

test("RedisQueueAdapter sync enqueue uses default priority when not specified", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const job = adapter.enqueue({ queueName: "test-queue", payload: { data: "test" } });

  assert.equal(job.priority, 0);
});

// =============================================================================
// enqueueAsync Tests
// =============================================================================

test("RedisQueueAdapter enqueueAsync creates job with waiting status", async () => {
  const mockRedis = createMockRedisClient({
    hmset: async () => {},
    expire: async () => 1,
    sadd: async () => 1,
    zadd: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.enqueueAsync({
    queueName: "async-queue",
    payload: { async: true },
  });

  assert.ok(result.id.startsWith("qjob_"));
  assert.equal(result.queueName, "async-queue");
  assert.equal(result.status, "waiting");
  assert.ok(result.createdAt);
  assert.ok(result.updatedAt);
});

test("RedisQueueAdapter enqueueAsync sets delayed status for future date", async () => {
  const mockRedis = createMockRedisClient({
    hmset: async () => {},
    expire: async () => 1,
    sadd: async () => 1,
    zadd: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const futureDate = new Date(Date.now() + 60000).toISOString();
  const result = await adapter.enqueueAsync({
    queueName: "delayed-queue",
    payload: { delayed: true },
    delayUntil: futureDate,
  });

  assert.equal(result.status, "delayed");
  assert.equal(result.delayUntil, futureDate);
});

test("RedisQueueAdapter enqueueAsync with idempotency key stores index", async () => {
  let hsetCalls: Array<{ key: string; field: string; value: string }> = [];

  const mockRedis = createMockRedisClient({
    hget: async () => null,
    hmset: async () => {},
    expire: async () => 1,
    sadd: async () => 1,
    zadd: async () => 1,
    hset: async (key: string, field: string, value: string) => {
      hsetCalls.push({ key, field, value });
      return 1;
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.enqueueAsync({
    queueName: "idem-queue",
    payload: { idem: true },
    idempotencyKey: "my-idem-key",
  });

  assert.ok(result.idempotencyKey, "my-idem-key");
  assert.ok(hsetCalls.some((c) => c.key.includes("idempotency") && c.field === "my-idem-key"));
});

test("RedisQueueAdapter enqueueAsync with idempotency key returns existing job", async () => {
  const mockRedis = createMockRedisClient({
    hget: async () => "existing-job-123",
    hgetall: async (key: string) => {
      if (key.includes("existing-job-123")) {
        return {
          id: "existing-job-123",
          queue_name: "idem-queue",
          payload: '{"existing":true}',
          status: "completed",
          priority: "0",
          attempts: "1",
          max_attempts: "3",
          last_error: "",
          delay_until: "",
          idempotency_key: "my-idem-key",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        };
      }
      return {};
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.enqueueAsync({
    queueName: "idem-queue",
    payload: { new: true },
    idempotencyKey: "my-idem-key",
  });

  assert.equal(result.id, "existing-job-123");
  assert.equal(result.status, "completed");
});

// =============================================================================
// dequeueAsync Tests
// =============================================================================

test("RedisQueueAdapter dequeueAsync returns null when waiting list is empty", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => [],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("empty-queue");

  assert.equal(result, null);
});

test("RedisQueueAdapter dequeueAsync returns job with ack/nack functions", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["job-123"],
    hgetall: async () => ({
      id: "job-123",
      queue_name: "test-queue",
      payload: '{"test":true}',
      status: "waiting",
      priority: "5",
      attempts: "0",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hincrby: async () => 1,
    hmset: async () => {},
    sadd: async () => 1,
    srem: async () => 1,
    zrem: async () => 1,
    expire: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("test-queue");

  assert.ok(result, "should return a result");
  assert.equal(result!.job.id, "job-123");
  assert.equal(result!.job.status, "active");
  assert.equal(typeof result!.ack, "function");
  assert.equal(typeof result!.nack, "function");
});

test("RedisQueueAdapter dequeueAsync skips non-waiting jobs", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["job-active"],
    hgetall: async () => ({
      id: "job-active",
      queue_name: "test-queue",
      payload: "{}",
      status: "active",
      priority: "0",
      attempts: "1",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    zrem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("test-queue");

  assert.equal(result, null);
});

test("RedisQueueAdapter dequeueAsync ack completes job and cleans up", async () => {
  let hmsetCalls: Array<Record<string, string>> = [];
  let sremCalled = false;
  let saddCalled = false;

  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["ack-job"],
    hgetall: async () => ({
      id: "ack-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "waiting",
      priority: "0",
      attempts: "0",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hincrby: async () => 1,
    hmset: async (_key: string, data: Record<string, string>) => {
      hmsetCalls.push(data);
    },
    sadd: async () => { saddCalled = true; return 1; },
    srem: async () => { sremCalled = true; return 1; },
    zrem: async () => 1,
    expire: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("test-queue");
  await result!.ack();

  assert.ok(hmsetCalls.some((c) => c.status === "completed"));
  assert.ok(sremCalled, "srem should be called for active set");
  assert.ok(saddCalled, "sadd should be called for completed set");
});

test("RedisQueueAdapter dequeueAsync nack requeues when under maxAttempts", async () => {
  let hmsetCalls: Array<Record<string, string>> = [];
  let zaddCalled = false;

  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["nack-job"],
    hgetall: async () => ({
      id: "nack-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "waiting",
      priority: "0",
      attempts: "1",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hincrby: async () => 1,
    hget: async (_key: string, field: string) => field === "max_attempts" ? "3" : "1",
    hmset: async (_key: string, data: Record<string, string>) => {
      hmsetCalls.push(data);
    },
    sadd: async () => 1,
    srem: async () => 1,
    zrem: async () => 1,
    zadd: async () => { zaddCalled = true; return 1; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("test-queue");
  await result!.nack("temporary failure");

  assert.ok(hmsetCalls.some((c) => c.status === "waiting"));
  assert.ok(zaddCalled, "zadd should be called to requeue");
});

test("RedisQueueAdapter dequeueAsync nack moves to dead letter when at maxAttempts", async () => {
  let hmsetCalls: Array<Record<string, string>> = [];
  let saddForDl = false;

  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["max-attempt-job"],
    hgetall: async () => ({
      id: "max-attempt-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "waiting",
      priority: "0",
      attempts: "3",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hincrby: async () => 1,
    hget: async () => "3",
    hmset: async (_key: string, data: Record<string, string>) => {
      hmsetCalls.push(data);
    },
    sadd: async (_key: string) => {
      if (_key.includes("dead_letter")) saddForDl = true;
      return 1;
    },
    srem: async () => 1,
    zrem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.dequeueAsync("test-queue");
  await result!.nack("max attempts exceeded");

  assert.ok(hmsetCalls.some((c) => c.status === "dead_letter"));
  assert.ok(saddForDl, "job should be added to dead letter set");
});

// =============================================================================
// getJobAsync Tests
// =============================================================================

test("RedisQueueAdapter getJobAsync returns null for non-existent job", async () => {
  const mockRedis = createMockRedisClient({
    hgetall: async () => ({}),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.getJobAsync("nonexistent");

  assert.equal(result, null);
});

test("RedisQueueAdapter getJobAsync returns job when found", async () => {
  const mockRedis = createMockRedisClient({
    hgetall: async () => ({
      id: "found-job",
      queue_name: "my-queue",
      payload: '{"found":true}',
      status: "active",
      priority: "10",
      attempts: "2",
      max_attempts: "5",
      last_error: "previous error",
      delay_until: "",
      idempotency_key: "idem-key",
      created_at: "2026-04-01T00:00:00.000Z",
      updated_at: "2026-04-01T12:00:00.000Z",
      completed_at: "",
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.getJobAsync("found-job");

  assert.ok(result);
  assert.equal(result!.id, "found-job");
  assert.equal(result!.queueName, "my-queue");
  assert.equal(result!.payload, '{"found":true}');
  assert.equal(result!.status, "active");
  assert.equal(result!.priority, 10);
  assert.equal(result!.attempts, 2);
  assert.equal(result!.maxAttempts, 5);
  assert.equal(result!.lastError, "previous error");
  assert.equal(result!.idempotencyKey, "idem-key");
});

// =============================================================================
// listJobsAsync Tests
// =============================================================================

test("RedisQueueAdapter listJobsAsync returns empty array for empty queue", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => [],
    smembers: async () => [],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listJobsAsync("empty-queue");

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

test("RedisQueueAdapter listJobsAsync returns all jobs across sets when no status filter", async () => {
  let hgetallCallCount = 0;

  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["job-w1"],
    smembers: async (key: string) => {
      if (key.includes("active")) return ["job-a1"];
      if (key.includes("completed")) return ["job-c1"];
      return [];
    },
    hgetall: async () => {
      hgetallCallCount++;
      return {
        id: `job-${hgetallCallCount}`,
        queue_name: "test-queue",
        payload: "{}",
        status: "waiting",
        priority: "0",
        attempts: "0",
        max_attempts: "3",
        last_error: "",
        delay_until: "",
        idempotency_key: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: "",
      };
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listJobsAsync("test-queue");

  assert.ok(result.length > 0);
  assert.ok(hgetallCallCount >= 1);
});

test("RedisQueueAdapter listJobsAsync filters by status", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["job-waiting"],
    smembers: async () => [],
    hgetall: async () => ({
      id: "job-waiting",
      queue_name: "test-queue",
      payload: "{}",
      status: "waiting",
      priority: "0",
      attempts: "0",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const waitingJobs = await adapter.listJobsAsync("test-queue", "waiting");

  assert.ok(waitingJobs.every((j) => j.status === "waiting"));
});

test("RedisQueueAdapter listJobsAsync respects limit parameter", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["job-1", "job-2", "job-3", "job-4", "job-5"],
    smembers: async () => [],
    hgetall: async (key: string) => {
      const id = key.split(":")[1] ?? "";
      return {
        id,
        queue_name: "test-queue",
        payload: "{}",
        status: "waiting",
        priority: "0",
        attempts: "0",
        max_attempts: "3",
        last_error: "",
        delay_until: "",
        idempotency_key: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: "",
      };
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listJobsAsync("test-queue", undefined, 3);

  assert.equal(result.length, 3);
});

test("RedisQueueAdapter listJobsAsync skips jobs that no longer exist", async () => {
  const mockRedis = createMockRedisClient({
    zrangebyscore: async () => ["ghost-job", "valid-job"],
    smembers: async () => [],
    hgetall: async (key: string) => {
      if (key.includes("ghost-job")) return {};
      return {
        id: "valid-job",
        queue_name: "test-queue",
        payload: "{}",
        status: "waiting",
        priority: "0",
        attempts: "0",
        max_attempts: "3",
        last_error: "",
        delay_until: "",
        idempotency_key: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: "",
      };
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listJobsAsync("test-queue");

  assert.ok(!result.some((j) => j.id === "ghost-job"));
  assert.ok(result.some((j) => j.id === "valid-job"));
});

// =============================================================================
// moveToDeadLetterAsync Tests
// =============================================================================

test("RedisQueueAdapter moveToDeadLetterAsync does nothing for non-existent job", async () => {
  let hmsetCalled = false;

  const mockRedis = createMockRedisClient({
    hgetall: async () => ({}),
    hmset: async () => { hmsetCalled = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.moveToDeadLetterAsync("nonexistent", "not found");

  assert.equal(hmsetCalled, false);
});

test("RedisQueueAdapter moveToDeadLetterAsync updates job to dead_letter status", async () => {
  let hmsetData: Record<string, string> = {};
  let sremCalled = false;
  let saddCalled = false;

  const mockRedis = createMockRedisClient({
    hgetall: async () => ({
      id: "dl-job",
      queue_name: "dl-queue",
      payload: "{}",
      status: "active",
      priority: "0",
      attempts: "3",
      max_attempts: "3",
      last_error: "error",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hmset: async (_key: string, data: Record<string, string>) => {
      hmsetData = data;
    },
    srem: async () => { sremCalled = true; return 1; },
    sadd: async (_key: string) => {
      if (_key.includes("dead_letter")) saddCalled = true;
      return 1;
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.moveToDeadLetterAsync("dl-job", "processing failed");

  assert.equal(hmsetData.status, "dead_letter");
  assert.ok(hmsetData.last_error?.includes("processing failed"));
  assert.ok(sremCalled);
  assert.ok(saddCalled);
});

// =============================================================================
// retryJobAsync Tests
// =============================================================================

test("RedisQueueAdapter retryJobAsync returns null for non-existent job", async () => {
  const mockRedis = createMockRedisClient({
    hgetall: async () => ({}),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.retryJobAsync("nonexistent");

  assert.equal(result, null);
});

test("RedisQueueAdapter retryJobAsync returns null for waiting job", async () => {
  const mockRedis = createMockRedisClient({
    hgetall: async () => ({
      id: "waiting-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "waiting",
      priority: "0",
      attempts: "0",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.retryJobAsync("waiting-job");

  assert.equal(result, null);
});

test("RedisQueueAdapter retryJobAsync returns null for active job", async () => {
  const mockRedis = createMockRedisClient({
    hgetall: async () => ({
      id: "active-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "active",
      priority: "0",
      attempts: "1",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.retryJobAsync("active-job");

  assert.equal(result, null);
});

test("RedisQueueAdapter retryJobAsync resets failed job to waiting", async () => {
  let hmsetData: Record<string, string> = {};
  let sremCalledForActive = false;
  let sremCalledForDl = false;

  const mockRedis = createMockRedisClient({
    hgetall: async () => ({
      id: "retry-job",
      queue_name: "retry-queue",
      payload: "{}",
      status: "failed",
      priority: "5",
      attempts: "3",
      max_attempts: "3",
      last_error: "error",
      delay_until: "",
      idempotency_key: "",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      completed_at: "",
    }),
    hmset: async (_key: string, data: Record<string, string>) => {
      hmsetData = data;
    },
    srem: async (key: string) => {
      if (key.includes("active")) sremCalledForActive = true;
      if (key.includes("dead_letter")) sremCalledForDl = true;
      return 1;
    },
    sadd: async () => 1,
    zadd: async () => 1,
    zrem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.retryJobAsync("retry-job");

  assert.ok(result);
  assert.equal(hmsetData.status, "waiting");
  assert.equal(hmsetData.attempts, "0");
  assert.equal(hmsetData.last_error, "");
  assert.ok(sremCalledForActive);
  assert.ok(sremCalledForDl);
});

test("RedisQueueAdapter retryJobAsync resets dead_letter job to waiting", async () => {
  let hgetallCalls = 0;

  const mockRedis = createMockRedisClient({
    hgetall: async () => {
      hgetallCalls += 1;
      if (hgetallCalls > 1) {
        return {
          id: "retry-dl",
          queue_name: "test-queue",
          payload: "{}",
          status: "waiting",
          priority: "3",
          attempts: "0",
          max_attempts: "5",
          last_error: "",
          delay_until: "",
          idempotency_key: "",
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          completed_at: "",
        };
      }
      return {
        id: "retry-dl",
        queue_name: "test-queue",
        payload: "{}",
        status: "dead_letter",
        priority: "3",
        attempts: "5",
        max_attempts: "5",
        last_error: "max attempts",
        delay_until: "",
        idempotency_key: "",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: "",
      };
    },
    hmset: async () => {},
    srem: async () => 1,
    sadd: async () => 1,
    zadd: async () => 1,
    zrem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.retryJobAsync("retry-dl");

  assert.ok(result);
  assert.equal(result!.status, "waiting");
});

// =============================================================================
// purgeAsync Tests
// =============================================================================

test("RedisQueueAdapter purgeAsync returns 0 when no completed jobs", async () => {
  const mockRedis = createMockRedisClient({
    smembers: async () => [],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.purgeAsync("empty-queue", "2026-04-01T00:00:00.000Z");

  assert.equal(result, 0);
});

test("RedisQueueAdapter purgeAsync deletes completed jobs older than cutoff", async () => {
  let deletedJobs: string[] = [];

  const mockRedis = createMockRedisClient({
    smembers: async (key: string) => {
      if (key.includes("completed")) return ["old-job", "new-job"];
      return [];
    },
    hgetall: async (key: string) => {
      const id = key.includes("old-job")
        ? "old-job"
        : key.includes("new-job")
          ? "new-job"
          : "";
      const isOld = id === "old-job";
      return {
        id,
        queue_name: "test-queue",
        payload: "{}",
        status: "completed",
        priority: "0",
        attempts: "1",
        max_attempts: "3",
        last_error: "",
        delay_until: "",
        idempotency_key: "",
        created_at: isOld ? "2026-03-01T00:00:00.000Z" : "2026-04-20T00:00:00.000Z",
        updated_at: isOld ? "2026-03-01T00:00:00.000Z" : "2026-04-20T00:00:00.000Z",
        completed_at: isOld ? "2026-03-01T00:00:00.000Z" : "2026-04-20T00:00:00.000Z",
      };
    },
    del: async (key: string) => {
      if (key.includes("old-job")) deletedJobs.push("old-job");
      if (key.includes("new-job")) deletedJobs.push("new-job");
      return 1;
    },
    srem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.purgeAsync("test-queue", "2026-04-15T00:00:00.000Z");

  assert.equal(result, 1);
  assert.ok(deletedJobs.includes("old-job"));
  assert.ok(!deletedJobs.includes("new-job"));
});

test("RedisQueueAdapter purgeAsync also purges dead letter jobs", async () => {
  let deletedDlJobs: string[] = [];

  const mockRedis = createMockRedisClient({
    smembers: async (key: string) => {
      if (key.includes("completed")) return [];
      if (key.includes("dead_letter")) return ["old-dl-job"];
      return [];
    },
    hgetall: async (key: string) => {
      const id = key.includes("old-dl-job") ? "old-dl-job" : "";
      return {
        id,
        queue_name: "test-queue",
        payload: "{}",
        status: "dead_letter",
        priority: "0",
        attempts: "5",
        max_attempts: "5",
        last_error: "max attempts",
        delay_until: "",
        idempotency_key: "",
        created_at: "2026-03-01T00:00:00.000Z",
        updated_at: "2026-03-01T00:00:00.000Z",
        completed_at: "",
      };
    },
    del: async (key: string) => {
      if (key.includes("old-dl-job")) {
        deletedDlJobs.push("old-dl-job");
      }
      return 1;
    },
    srem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.purgeAsync("test-queue", "2026-04-15T00:00:00.000Z");

  assert.equal(result, 1);
  assert.ok(deletedDlJobs.includes("old-dl-job"));
});

test("RedisQueueAdapter purgeAsync does not delete jobs newer than cutoff", async () => {
  let deletedJobs: string[] = [];

  const mockRedis = createMockRedisClient({
    smembers: async (key: string) => {
      if (key.includes("completed")) return ["recent-job"];
      return [];
    },
    hgetall: async () => ({
      id: "recent-job",
      queue_name: "test-queue",
      payload: "{}",
      status: "completed",
      priority: "0",
      attempts: "1",
      max_attempts: "3",
      last_error: "",
      delay_until: "",
      idempotency_key: "",
      created_at: "2026-04-20T00:00:00.000Z",
      updated_at: "2026-04-20T00:00:00.000Z",
      completed_at: "2026-04-20T00:00:00.000Z",
    }),
    del: async (key: string) => {
      deletedJobs.push(key.split(":")[1] ?? "");
      return 1;
    },
    srem: async () => 1,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.purgeAsync("test-queue", "2026-04-15T00:00:00.000Z");

  assert.equal(result, 0);
  assert.ok(!deletedJobs.includes("recent-job"));
});

// =============================================================================
// statsAsync Tests
// =============================================================================

test("RedisQueueAdapter statsAsync returns correct queue statistics", async () => {
  const mockRedis = createMockRedisClient({
    zcard: async () => 15,
    scard: async (key: string) => {
      if (key.includes("active")) return 5;
      if (key.includes("completed")) return 100;
      if (key.includes("dead_letter")) return 3;
      return 0;
    },
    zcount: async () => 5,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.statsAsync("stats-queue");

  assert.equal(result.queueName, "stats-queue");
  assert.equal(result.waiting, 10); // 15 - 5 delayed
  assert.equal(result.delayed, 5);
  assert.equal(result.active, 5);
  assert.equal(result.completed, 100);
  assert.equal(result.deadLetter, 3);
  assert.equal(result.failed, 0);
});

test("RedisQueueAdapter statsAsync returns zeros for empty queue", async () => {
  const mockRedis = createMockRedisClient({
    zcard: async () => 0,
    scard: async () => 0,
    zcount: async () => 0,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.statsAsync("empty-queue");

  assert.equal(result.queueName, "empty-queue");
  assert.equal(result.waiting, 0);
  assert.equal(result.delayed, 0);
  assert.equal(result.active, 0);
  assert.equal(result.completed, 0);
  assert.equal(result.failed, 0);
  assert.equal(result.deadLetter, 0);
});

test("RedisQueueAdapter statsAsync handles all jobs being delayed", async () => {
  const mockRedis = createMockRedisClient({
    zcard: async () => 10,
    scard: async (key: string) => {
      if (key.includes("active")) return 0;
      if (key.includes("completed")) return 0;
      if (key.includes("dead_letter")) return 0;
      return 0;
    },
    zcount: async () => 10,
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.statsAsync("delayed-only-queue");

  assert.equal(result.waiting, 0);
  assert.equal(result.delayed, 10);
  assert.equal(result.active, 0);
});

// =============================================================================
// listQueuesAsync Tests
// =============================================================================

test("RedisQueueAdapter listQueuesAsync returns all registered queue names", async () => {
  const mockRedis = createMockRedisClient({
    smembers: async () => ["queue-a", "queue-b", "queue-c"],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listQueuesAsync();

  assert.equal(result.length, 3);
  assert.ok(result.includes("queue-a"));
  assert.ok(result.includes("queue-b"));
  assert.ok(result.includes("queue-c"));
});

test("RedisQueueAdapter listQueuesAsync returns empty array when no queues registered", async () => {
  const mockRedis = createMockRedisClient({
    smembers: async () => [],
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.listQueuesAsync();

  assert.ok(Array.isArray(result));
  assert.equal(result.length, 0);
});

// =============================================================================
// ping and close Tests
// =============================================================================

test("RedisQueueAdapter ping returns PONG", async () => {
  const mockRedis = createMockRedisClient({
    ping: async () => "PONG",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  const result = await adapter.ping();

  assert.equal(result, "PONG");
});

test("RedisQueueAdapter ping connects when redis client is waiting", async () => {
  let connectCalls = 0;
  const mockRedis = createMockRedisClient({
    status: "wait",
    connect: async () => {
      connectCalls += 1;
      mockRedis.status = "ready";
    },
    ping: async () => "PONG",
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  assert.equal(await adapter.ping(), "PONG");
  assert.equal(connectCalls, 1);
});

test("RedisQueueAdapter ping throws when Redis is unavailable", async () => {
  const mockRedis = createMockRedisClient({
    ping: async () => {
      throw new Error("Connection refused");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(adapter.ping());
});

test("RedisQueueAdapter ping throws storage error when closed connection cannot reconnect", async () => {
  const mockRedis = createMockRedisClient({
    status: "end",
    connect: async () => {
      throw new Error("connect failed");
    },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await assert.rejects(adapter.ping(), /queue.redis_connection_failed/);
});

test("RedisQueueAdapter close calls quit when status is ready", async () => {
  let quitCalled = false;

  const mockRedis = createMockRedisClient({
    status: "ready",
    quit: async () => { quitCalled = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.ok(quitCalled);
});

test("RedisQueueAdapter close disconnects when status is wait", async () => {
  let disconnected = false;

  const mockRedis = createMockRedisClient({
    status: "wait",
    disconnect: () => { disconnected = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.ok(disconnected);
});

test("RedisQueueAdapter close disconnects when status is end", async () => {
  let disconnected = false;

  const mockRedis = createMockRedisClient({
    status: "end",
    disconnect: () => { disconnected = true; },
  });
  const adapter = createAdapterWithMockRedis(mockRedis);

  await adapter.close();

  assert.ok(disconnected);
});

// =============================================================================
// Sync methods throw validation errors
// =============================================================================

test("RedisQueueAdapter dequeue throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.dequeue("test-queue"),
    (err: any) => err.message.includes("sync_dequeue_not_supported"),
  );
});

test("RedisQueueAdapter getJob throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.getJob("job-id"),
    (err: any) => err.message.includes("sync_getJob_not_supported"),
  );
});

test("RedisQueueAdapter listJobs throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.listJobs("test-queue"),
    (err: any) => err.message.includes("sync_listJobs_not_supported"),
  );
});

test("RedisQueueAdapter moveToDeadLetter throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.moveToDeadLetter("job-id", "reason"),
    (err: any) => err.message.includes("sync_moveToDeadLetter_not_supported"),
  );
});

test("RedisQueueAdapter retryJob throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.retryJob("job-id"),
    (err: any) => err.message.includes("sync_retryJob_not_supported"),
  );
});

test("RedisQueueAdapter purge throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.purge("test-queue", "2026-04-01"),
    (err: any) => err.message.includes("sync_purge_not_supported"),
  );
});

test("RedisQueueAdapter stats throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.stats("test-queue"),
    (err: any) => err.message.includes("sync_stats_not_supported"),
  );
});

test("RedisQueueAdapter listQueues throws sync_not_supported", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });

  assert.throws(
    () => adapter.listQueues(),
    (err: any) => err.message.includes("sync_listQueues_not_supported"),
  );
});
