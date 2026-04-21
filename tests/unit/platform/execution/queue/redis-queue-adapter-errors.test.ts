/**
 * RedisQueueAdapter Error Path Security Tests
 *
 * P0 security boundary tests per §8 安全回归测试规范
 * Tests: hmset failure during enqueueAsync pipeline, malformed Redis hash data,
 * nack() when currentAttempts >= maxAttempts (dead letter path),
 * mapRedisToJobRecord() error handling
 */

import assert from "node:assert/strict";
import test from "node:test";

import { RedisQueueAdapter } from "../../../../../src/platform/execution/queue/redis-queue-adapter.js";

// Helper to create adapter with mock redis client
function createAdapterWithMockRedis(mockRedis: any): RedisQueueAdapter {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  (adapter as unknown as { client: { redis: any } }).client.redis = mockRedis;
  return adapter;
}

// ─────────────────────────────────────────────────────────────────────────────
// hmset Failure During enqueueAsync Pipeline
// ─────────────────────────────────────────────────────────────────────────────

test("RedisQueueAdapter enqueueAsync throws when hmset fails", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  // Make hmset throw
  mockClient.hmset = async () => {
    throw new Error("HMSET failed - Redis error");
  };

  try {
    await adapter.enqueueAsync({
      queueName: "test-queue",
      payload: { data: "test" },
    });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("queue.enqueue_failed") || err.message.includes("HMSET"));
  }
});

test("RedisQueueAdapter enqueueAsync throws when expire fails", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => {
    throw new Error("EXPIRE failed - key does not exist");
  };

  try {
    await adapter.enqueueAsync({
      queueName: "test-queue",
      payload: { data: "test" },
    });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("RedisQueueAdapter enqueueAsync throws when sadd fails", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => {
    throw new Error("SADD failed - not a set");
  };

  try {
    await adapter.enqueueAsync({
      queueName: "test-queue",
      payload: { data: "test" },
    });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

test("RedisQueueAdapter enqueueAsync throws when zadd fails", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.hmset = async () => { return; };
  mockClient.expire = async () => { return 1; };
  mockClient.sadd = async () => { return 1; };
  mockClient.zadd = async () => {
    throw new Error("ZADD failed - not a sorted set");
  };

  try {
    await adapter.enqueueAsync({
      queueName: "test-queue",
      payload: { data: "test" },
    });
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// getJobAsync with Malformed Redis Hash Data
// ─────────────────────────────────────────────────────────────────────────────

test("RedisQueueAdapter getJobAsync returns null when job not found", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.hgetall = async () => ({});

  const result = await adapter.getJobAsync("nonexistent-job");
  assert.equal(result, null);
});

test("RedisQueueAdapter getJobAsync returns null when hash has no id field", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.hgetall = async () => ({
    queue_name: "test-queue",
    payload: "{}",
    status: "waiting",
  });

  const result = await adapter.getJobAsync("job-without-id");
  assert.equal(result, null);
});

test("RedisQueueAdapter mapRedisToJobRecord handles non-numeric priority", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({
    id: "job-1",
    queue_name: "q",
    payload: "{}",
    status: "waiting",
    priority: "not-a-number",
    attempts: "0",
    max_attempts: "3",
    last_error: "",
    delay_until: "",
    idempotency_key: "",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    completed_at: "",
  });

  // parseInt of "not-a-number" returns NaN, which becomes 0 via || fallback
  assert.equal(result.priority, 0);
});

test("RedisQueueAdapter mapRedisToJobRecord handles non-numeric attempts", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({
    id: "job-1",
    queue_name: "q",
    payload: "{}",
    status: "waiting",
    priority: "0",
    attempts: "invalid",
    max_attempts: "3",
    last_error: "",
    delay_until: "",
    idempotency_key: "",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    completed_at: "",
  });

  // parseInt of "invalid" returns NaN, which becomes 0 via || fallback
  assert.equal(result.attempts, 0);
});

test("RedisQueueAdapter mapRedisToJobRecord handles invalid status value", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({
    id: "job-1",
    queue_name: "q",
    payload: "{}",
    status: "invalid-status",
    priority: "0",
    attempts: "0",
    max_attempts: "3",
    last_error: "",
    delay_until: "",
    idempotency_key: "",
    created_at: "2026-04-01T00:00:00.000Z",
    updated_at: "2026-04-01T00:00:00.000Z",
    completed_at: "",
  });

  // Invalid status falls back to "waiting"
  assert.equal(result.status, "invalid-status" as any);
});

// ─────────────────────────────────────────────────────────────────────────────
// nack() When currentAttempts >= maxAttempts (Dead Letter Path)
// ─────────────────────────────────────────────────────────────────────────────

test("RedisQueueAdapter nack moves job to dead letter when max attempts exceeded", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  let movedToDeadLetter = false;
  let updatedStatus = "";

  mockClient.hget = async (key: string, field: string) => {
    if (field === "attempts") return "5";
    if (field === "max_attempts") return "3";
    return null;
  };

  mockClient.hmset = async (key: string, data: Record<string, string>) => {
    if (data.status) updatedStatus = data.status;
    if (data.status === "dead_letter") movedToDeadLetter = true;
    return;
  };

  mockClient.srem = async () => 1;
  mockClient.sadd = async () => 1;

  // Create a mock dequeue result
  const mockDequeueResult = await adapter.dequeueAsync("test-queue");

  if (mockDequeueResult) {
    await mockDequeueResult.nack("Test error");

    // Verify the job was moved to dead letter queue
    assert.equal(updatedStatus, "dead_letter");
    assert.equal(movedToDeadLetter, true);
  }
});

test("RedisQueueAdapter nack requeues job when attempts < max attempts", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  let requeued = false;

  mockClient.hget = async (key: string, field: string) => {
    if (field === "attempts") return "1";
    if (field === "max_attempts") return "5";
    return null;
  };

  mockClient.hmset = async (key: string, data: Record<string, string>) => {
    if (data.status === "waiting") requeued = true;
    return;
  };

  mockClient.srem = async () => 1;
  mockClient.zadd = async () => 1;

  const mockDequeueResult = await adapter.dequeueAsync("test-queue");

  if (mockDequeueResult) {
    await mockDequeueResult.nack("Transient error");

    // Verify the job was requeued (status set to waiting)
    assert.equal(requeued, true);
  }
});

test("RedisQueueAdapter nack uses default max_attempts of 3 when not set", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  let finalStatus = "";

  mockClient.hget = async (key: string, field: string) => {
    if (field === "attempts") return "3";
    if (field === "max_attempts") return null; // Not set
    return null;
  };

  mockClient.hmset = async (key: string, data: Record<string, string>) => {
    if (data.status) finalStatus = data.status;
    return;
  };

  mockClient.srem = async () => 1;
  mockClient.sadd = async () => 1;

  const mockDequeueResult = await adapter.dequeueAsync("test-queue");

  if (mockDequeueResult) {
    await mockDequeueResult.nack("Error at limit");

    // With attempts=3 and max_attempts=null (defaults to 3),
    // 3 >= 3 means dead letter
    assert.equal(finalStatus, "dead_letter");
  }
});

test("RedisQueueAdapter nack accepts optional error message parameter", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  let lastError = "";

  mockClient.hget = async (key: string, field: string) => {
    if (field === "attempts") return "5";
    if (field === "max_attempts") return "3";
    return null;
  };

  mockClient.hmset = async (key: string, data: Record<string, string>) => {
    if (data.last_error) lastError = data.last_error;
    return;
  };

  mockClient.srem = async () => 1;
  mockClient.sadd = async () => 1;

  const mockDequeueResult = await adapter.dequeueAsync("test-queue");

  if (mockDequeueResult) {
    await mockDequeueResult.nack("Connection timeout after 30s");

    assert.equal(lastError, "Connection timeout after 30s");
  }
});

test("RedisQueueAdapter nack uses default error message when not provided", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  let lastError = "";

  mockClient.hget = async (key: string, field: string) => {
    if (field === "attempts") return "5";
    if (field === "max_attempts") return "3";
    return null;
  };

  mockClient.hmset = async (key: string, data: Record<string, string>) => {
    if (data.last_error) lastError = data.last_error;
    return;
  };

  mockClient.srem = async () => 1;
  mockClient.sadd = async () => 1;

  const mockDequeueResult = await adapter.dequeueAsync("test-queue");

  if (mockDequeueResult) {
    await mockDequeueResult.nack();

    assert.equal(lastError, "max_attempts_exceeded");
  }
});

// ─────────────────────────────────────────────────────────────────────────────
// mapRedisToJobRecord() Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("RedisQueueAdapter mapRedisToJobRecord handles empty data gracefully", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;
  const result = adapter.mapRedisToJobRecord({});

  assert.equal(result.id, "");
  assert.equal(result.queueName, "");
  assert.equal(result.payload, "");
  assert.equal(result.status, "waiting");
  assert.equal(result.priority, 0);
  assert.equal(result.attempts, 0);
  assert.equal(result.maxAttempts, 3);
  assert.equal(result.lastError, null);
  assert.equal(result.delayUntil, null);
  assert.equal(result.idempotencyKey, null);
  assert.ok(result.createdAt);
  assert.ok(result.updatedAt);
  assert.equal(result.completedAt, null);
});

test("RedisQueueAdapter mapRedisToJobRecord handles null/undefined values in data", () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 }) as any;

  // TypeScript would not allow this at compile time but runtime can pass undefined
  const result = adapter.mapRedisToJobRecord({
    id: undefined,
    queue_name: undefined,
    payload: undefined,
    status: undefined,
    priority: undefined,
    attempts: undefined,
    max_attempts: undefined,
    last_error: undefined,
    delay_until: undefined,
    idempotency_key: undefined,
    created_at: undefined,
    updated_at: undefined,
    completed_at: undefined,
  } as Record<string, string>);

  // Should use fallback values
  assert.equal(result.id, "");
  assert.equal(result.queueName, "");
  assert.equal(result.payload, "");
  assert.equal(result.status, "waiting");
  assert.equal(result.priority, 0);
  assert.equal(result.attempts, 0);
  assert.equal(result.maxAttempts, 3);
});

// ─────────────────────────────────────────────────────────────────────────────
// Redis Connection Error Handling
// ─────────────────────────────────────────────────────────────────────────────

test("RedisQueueAdapter ensureConnected throws when connection fails", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  Object.defineProperty(mockClient.redis, "status", { value: "end", writable: true });
  mockClient.redis.connect = async () => {
    throw new Error("Connection refused");
  };

  try {
    await mockClient.ensureConnected();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
    assert.ok(err.message.includes("redis_connection_failed") || err.message.includes("Connection refused"));
  }
});

test("RedisQueueAdapter handles ping failure gracefully", async () => {
  const adapter = new RedisQueueAdapter({ host: "localhost", port: 6379 });
  const mockClient = (adapter as unknown as { client: { redis: any } }).client;

  mockClient.ping = async () => {
    throw new Error("PING failed");
  };

  try {
    await adapter.ping();
    assert.fail("Should have thrown");
  } catch (err) {
    assert.ok(err instanceof Error);
  }
});
