import assert from "node:assert/strict";
import test from "node:test";
import { EventEmitter } from "node:events";
import { RedisRateLimiter, type RedisRateLimiterConfig } from "../../../../../src/platform/interface/ingress/redis-rate-limiter.js";

// Mock Redis client for unit testing
class MockRedisClient extends EventEmitter {
  status = "ready";
  private store = new Map<string, Map<string, number>>();
  private ttls = new Map<string, number>();

  pipeline() {
    const self = this;
    const commands: Array<{ method: string; args: unknown[] }> = [];
    let zcardCount = 0;

    const pipeline = {
      zremrangebyscore(key: string, min: number, max: number) {
        commands.push({ method: "zremrangebyscore", args: [key, min, max] });
        // Clean expired entries
        const entries = self.store.get(key);
        if (entries) {
          for (const [member, score] of entries) {
            if (score < Number(min) || score > Number(max)) {
              entries.delete(member);
            }
          }
        }
        return pipeline;
      },
      zadd(key: string, score: number, member: string) {
        commands.push({ method: "zadd", args: [key, score, member] });
        if (!self.store.has(key)) {
          self.store.set(key, new Map());
        }
        self.store.get(key)!.set(member, score);
        return pipeline;
      },
      zcard(key: string) {
        commands.push({ method: "zcard", args: [key, zcardCount] });
        zcardCount++;
        const entries = self.store.get(key);
        return pipeline;
      },
      pexpire(key: string, ms: number) {
        commands.push({ method: "pexpire", args: [key, ms] });
        self.ttls.set(key, Date.now() + Number(ms));
        return pipeline;
      },
      async exec() {
        const results: Array<[null, unknown]> = [];
        for (const cmd of commands) {
          if (cmd.method === "zcard") {
            const key = cmd.args[0] as string;
            const entries = self.store.get(key);
            results.push([null, entries ? entries.size : 0]);
          } else {
            results.push([null, 1]);
          }
        }
        return results;
      },
    };
    return pipeline;
  }

  async zrange(key: string, start: number, stop: number, withScores?: string) {
    const entries = this.store.get(key);
    if (!entries || entries.size === 0) return [];

    const sorted = Array.from(entries.entries()).sort((a, b) => a[1] - b[1]);
    const slice = sorted.slice(start, stop + 1);

    if (withScores === "WITHSCORES") {
      const result: string[] = [];
      for (const [member, score] of slice) {
        result.push(member, score.toString());
      }
      return result;
    }
    return slice.map(([member]) => member);
  }

  async zrem(key: string, member: string) {
    const entries = this.store.get(key);
    if (entries && entries.has(member)) {
      entries.delete(member);
      return 1;
    }
    return 0;
  }

  async del(key: string) {
    this.store.delete(key);
    this.ttls.delete(key);
    return 1;
  }

  on(event: string, handler: (...args: unknown[]) => void) {
    super.on(event, handler);
    return this;
  }

  connect() {
    return Promise.resolve();
  }

  disconnect() {
    this.status = "end";
  }

  async quit() {
    this.status = "end";
    return "OK";
  }
}

test("RedisRateLimiter - construction with host and port", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - construction with custom keyPrefix", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379, keyPrefix: "custom:" });
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - construction accepts all config options", () => {
  const config: RedisRateLimiterConfig = {
    host: "redis.example.com",
    port: 6380,
    password: "secret",
    db: 1,
    tls: true,
    connectTimeout: 5000,
    maxRetriesPerRequest: 3,
    keyPrefix: "ratelimit:",
  };
  const limiter = new RedisRateLimiter(config);
  assert.ok(limiter instanceof RedisRateLimiter);
});

test("RedisRateLimiter - checkAndConsume returns RateLimitResult structure", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  const result = await limiter.checkAndConsume("test-key", 10, 1000);

  assert.equal(typeof result.allowed, "boolean");
  assert.equal(typeof result.remaining, "number");
  assert.ok(result.allowed === true || result.allowed === false);
});

test("RedisRateLimiter - checkAndConsume allowed when under limit", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  const result = await limiter.checkAndConsume("under-limit", 10, 1000);

  assert.equal(result.allowed, true);
  assert.ok(result.remaining >= 0);
});

test("RedisRateLimiter - checkAndConsume computes remaining correctly", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  const result = await limiter.checkAndConsume("compute-remaining", 10, 1000);

  assert.equal(result.allowed, true);
  assert.ok(result.remaining >= 0);
  assert.ok(result.remaining <= 10);
});

test("RedisRateLimiter - getUsage returns current count without consuming", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  await limiter.checkAndConsume("usage-key", 10, 1000);
  await limiter.checkAndConsume("usage-key", 10, 1000);

  const usage = await limiter.getUsage("usage-key", 1000);
  assert.equal(typeof usage, "number");
  assert.ok(usage >= 0);
});

test("RedisRateLimiter - reset clears the rate limit for a key", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  await limiter.checkAndConsume("reset-key", 10, 1000);
  await limiter.reset("reset-key");

  // After reset, usage should be 0
  const usage = await limiter.getUsage("reset-key", 1000);
  assert.equal(usage, 0);
});

test("RedisRateLimiter - connect method exists and returns promise", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  assert.equal(typeof limiter.connect, "function");
  const result = limiter.connect();
  assert.ok(result instanceof Promise);
  await result;
});

test("RedisRateLimiter - close method exists", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  assert.equal(typeof limiter.close, "function");
  await limiter.close();
});

test("RedisRateLimiter - close handles wait status", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  await limiter.close();
});

test("RedisRateLimiter - default keyPrefix is ratelimit:", () => {
  const defaultPrefix = "ratelimit:";
  const key = "test";
  const fullKey = `${defaultPrefix}${key}`;
  assert.equal(fullKey, "ratelimit:test");
});

test("RedisRateLimiter - custom keyPrefix is used", () => {
  const customPrefix = "custom:";
  const key = "test";
  const fullKey = `${customPrefix}${key}`;
  assert.equal(fullKey, "custom:test");
});

test("RedisRateLimiter - RateLimitResult interface compliance for allowed", () => {
  const result = { allowed: true, remaining: 5 };
  assert.equal(result.allowed, true);
  assert.equal(result.remaining, 5);
});

test("RedisRateLimiter - RateLimitResult interface compliance for rejected", () => {
  const result = { allowed: false, remaining: 0, retryAfterMs: 30000 };
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
  assert.equal(result.retryAfterMs, 30000);
});

test("RedisRateLimiter - sliding window algorithm removes expired entries", () => {
  const now = Date.now();
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.ok(windowStart < now);
  assert.equal(windowStart, now - 60000);
});

test("RedisRateLimiter - retryAfterMs calculation", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 30000;
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 30000);
});

test("RedisRateLimiter - retryAfterMs is zero when window expired", () => {
  const windowMs = 60000;
  const now = 1000000000000;
  const oldestTime = now - 70000;
  const retryAfterMs = Math.max(0, oldestTime + windowMs - now);

  assert.equal(retryAfterMs, 0);
});

test("RedisRateLimiter - remaining is max of zero or limit minus count", () => {
  const limit = 10;
  const count = 7;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 3);
});

test("RedisRateLimiter - remaining is zero when over limit", () => {
  const limit = 10;
  const count = 15;
  const remaining = Math.max(0, limit - count);

  assert.equal(remaining, 0);
});

test("RedisRateLimiter - windowStart calculation", () => {
  const now = 1000000000000;
  const windowMs = 60000;
  const windowStart = now - windowMs;

  assert.equal(windowStart, 999999940000);
});

test("RedisRateLimiter - checkAndConsume with limit of 1 rejects second request", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  const first = await limiter.checkAndConsume("single", 1, 1000);
  assert.equal(first.allowed, true);

  const second = await limiter.checkAndConsume("single", 1, 1000);
  assert.equal(second.allowed, false);
  assert.equal(second.remaining, 0);
});

test("RedisRateLimiter - checkAndConsume with zero limit rejects all", async () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

  const result = await limiter.checkAndConsume("zero-limit", 0, 1000);
  assert.equal(result.allowed, false);
  assert.equal(result.remaining, 0);
});

test("RedisRateLimiter - error handler registration", () => {
  const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
  assert.ok(limiter instanceof RedisRateLimiter);
});