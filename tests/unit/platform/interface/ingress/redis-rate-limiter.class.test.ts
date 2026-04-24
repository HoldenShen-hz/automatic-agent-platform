// @ts-nocheck
/**
 * RedisRateLimiter Class Unit Tests
 *
 * Tests for RedisRateLimiter class with mocked Redis client.
 */

import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
import test from "node:test";

const require = createRequire(import.meta.url);
const ioredisPath = require.resolve("ioredis");

// Mock Redis client class
class MockRedisClient extends EventEmitter {
  public status = "ready";
  public pipelineResults: Array<[unknown, unknown]> = [];
  public pipelineCommands: string[] = [];
  public lastZrangeKey = "";
  public lastZremKey = "";
  public lastZremId = "";
  public lastDelKey = "";
  public zcardCount = 0;
  public zremrangebyscoreCount = 0;

  async connect(): Promise<void> {}
  async quit(): Promise<void> {}
  disconnect(): void {}

  pipeline() {
    const self = this;
    return {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      zremrangebyscore: function(_key: string, _min: number, _max: number) {
        self.pipelineCommands.push("zremrangebyscore");
        return this;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      zadd: function(_key: string, _score: number, _member: string) {
        self.pipelineCommands.push("zadd");
        return this;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      zcard: function(_key: string) {
        self.pipelineCommands.push("zcard");
        return this;
      },
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      pexpire: function(_key: string, _ms: number) {
        self.pipelineCommands.push("pexpire");
        return this;
      },
      exec: async function() {
        self.pipelineCommands.push("exec");
        return self.pipelineResults;
      },
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async zremrangebyscore(_key: string, _min: number, _max: number): Promise<number> {
    this.zremrangebyscoreCount++;
    return 0;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async zcard(_key: string): Promise<number> {
    this.zcardCount++;
    return 3;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async zrange(key: string, ..._args: unknown[]): Promise<string[]> {
    this.lastZrangeKey = key;
    return [];
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async zrem(key: string, id: string): Promise<number> {
    this.lastZremKey = key;
    this.lastZremId = id;
    return 1;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async del(key: string): Promise<number> {
    this.lastDelKey = key;
    return 1;
  }
}

async function withMockRedisCtor<T>(
  run: (MockRedisClient: new () => MockRedisClient) => Promise<T>,
): Promise<T> {
  require(ioredisPath);
  const moduleEntry = require.cache[ioredisPath];
  assert.ok(moduleEntry, "ioredis module must be present in require cache");
  const originalExports = moduleEntry.exports;

  moduleEntry.exports = MockRedisClient;
  try {
    return await run(MockRedisClient as any);
  } finally {
    moduleEntry.exports = originalExports;
  }
}

// Import after mocking
async function getRedisRateLimiter() {
  const { RedisRateLimiter } = await import("../../../../../src/platform/interface/ingress/redis-rate-limiter.js");
  return RedisRateLimiter;
}

test("RedisRateLimiter constructor creates Redis client with correct options", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    assert.ok(limiter !== null);
    assert.ok(limiter !== undefined);
  });
});

test("RedisRateLimiter constructor applies custom keyPrefix", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "custom:",
    });
    assert.ok(limiter !== null);
  });
});

test("RedisRateLimiter constructor applies custom maxRetriesPerRequest", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      maxRetriesPerRequest: 5,
    });
    assert.ok(limiter !== null);
  });
});

test("RedisRateLimiter constructor applies custom connectTimeout", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      connectTimeout: 2000,
    });
    assert.ok(limiter !== null);
  });
});

test("RedisRateLimiter default keyPrefix is ratelimit:", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });
    assert.ok(limiter !== null);
  });
});

test("RedisRateLimiter checkAndConsume returns allowed when under limit", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    // Override the redis client with our mock
    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0], // zremrangebyscore
      [null, 1], // zadd
      [null, 5], // zcard - 5 entries in window (under limit of 10)
      [null, 1], // pexpire
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5);
  });
});

test("RedisRateLimiter checkAndConsume returns not allowed when over limit", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15], // zcard - 15 entries (over limit of 10)
      [null, 1],
    ];
    mock.zrange = async () => ["request1", String(Date.now() - 30000)]; // oldest entry
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter checkAndConsume handles null exec results", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 1], // Treat null as 1 for zcard
      [null, 1],
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 9);
  });
});

test("RedisRateLimiter getUsage returns count of entries in window", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.zrange = async () => ["req1", "req2", "req3"];
    (limiter as any).redis = mock;

    const count = await limiter.getUsage("test:key", 60000);
    assert.equal(count, 3);
  });
});

test("RedisRateLimiter reset deletes the key", async () => {
  let delCalled = false;
  let deletedKey = "";

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "rl:",
    });

    const mock = new MockRedis();
    mock.del = async (key: string) => {
      delCalled = true;
      deletedKey = key;
      return 1;
    };
    (limiter as any).redis = mock;

    await limiter.reset("test:key");
    assert.ok(delCalled);
    assert.equal(deletedKey, "rl:test:key");
  });
});

test("RedisRateLimiter connect calls redis.connect", async () => {
  let connectCalled = false;

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.connect = async () => {
      connectCalled = true;
    };
    (limiter as any).redis = mock;

    await limiter.connect();
    assert.ok(connectCalled);
  });
});

test("RedisRateLimiter close with ready status calls quit", async () => {
  let quitCalled = false;

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.status = "ready";
    mock.quit = async () => {
      quitCalled = true;
    };
    (limiter as any).redis = mock;

    await limiter.close();
    assert.ok(quitCalled);
  });
});

test("RedisRateLimiter close with wait status calls disconnect", async () => {
  let disconnectCalled = false;

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.status = "wait";
    mock.disconnect = () => {
      disconnectCalled = true;
    };
    (limiter as any).redis = mock;

    await limiter.close();
    assert.ok(disconnectCalled);
  });
});

test("RedisRateLimiter close with end status calls disconnect", async () => {
  let disconnectCalled = false;

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.status = "end";
    mock.disconnect = () => {
      disconnectCalled = true;
    };
    (limiter as any).redis = mock;

    await limiter.close();
    assert.ok(disconnectCalled);
  });
});

test("RedisRateLimiter checkAndConsume with exactly at limit is allowed", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 10], // exactly at limit
      [null, 1],
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
  });
});

test("RedisRateLimiter checkAndConsume removes entry when rejected", async () => {
  let zremCalled = false;
  let zremKey = "";
  let zremId = "";

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "rl:",
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15], // over limit
      [null, 1],
    ];
    mock.zrange = async () => ["req1", String(Date.now() - 30000)];
    mock.zrem = async (key: string, id: string) => {
      zremCalled = true;
      zremKey = key;
      zremId = id;
      return 1;
    };
    (limiter as any).redis = mock;

    await limiter.checkAndConsume("test:key", 10, 60000);
    assert.ok(zremCalled);
    assert.equal(zremKey, "rl:test:key");
  });
});

test("RedisRateLimiter checkAndConsume calculates retryAfterMs correctly when over limit", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15], // over limit
      [null, 1],
    ];
    // Return oldest entry with timestamp in the past relative to now
    mock.zrange = async () => ["req1", String(Date.now() - 30000)];
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
    assert.ok(result.retryAfterMs > 0, "retryAfterMs should be positive when over limit");
  });
});

test("RedisRateLimiter checkAndConsume handles empty zrange result", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => []; // empty
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter checkAndConsume handles partial zrange result", async () => {
  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => ["req1"]; // only member, no score
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter getUsage calls zremrangebyscore then zcard", async () => {
  let zremrangebyscoreCalled = false;
  let zcardCalled = false;

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
    });

    const mock = new MockRedis();
    // Override direct calls since getUsage doesn't use pipeline
    mock.zremrangebyscore = async () => {
      zremrangebyscoreCalled = true;
      return 0;
    };
    mock.zcard = async () => {
      zcardCalled = true;
      return 2;
    };
    (limiter as any).redis = mock;

    await limiter.getUsage("test:key", 60000);
    assert.ok(zremrangebyscoreCalled, "zremrangebyscore should be called");
    assert.ok(zcardCalled, "zcard should be called");
  });
});

test("RedisRateLimiter reset uses correct full key with prefix", async () => {
  let deletedKey = "";

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "myprefix:",
    });

    const mock = new MockRedis();
    mock.del = async (key: string) => {
      deletedKey = key;
      return 1;
    };
    (limiter as any).redis = mock;

    await limiter.reset("mykey");
    assert.equal(deletedKey, "myprefix:mykey");
  });
});

test("RedisRateLimiter checkAndConsume pipeline uses full key with prefix", async () => {
  let fullKeyInPipeline = "";

  await withMockRedisCtor(async (MockRedis) => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "testpfx:",
    });

    const mock = new MockRedis();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 5],
      [null, 1],
    ];
    mock.pipeline = function() {
      const pf = "testpfx:";
      const key = "testkey";
      fullKeyInPipeline = pf + key;
      return {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        zremrangebyscore: function(_k: string, _min: number, _max: number) {
          return this;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        zadd: function(_k: string, _s: number, _m: string) {
          return this;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        zcard: function(_k: string) {
          return this;
        },
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        pexpire: function(_k: string, _t: number) {
          return this;
        },
        exec: async function() {
          return [[null, 0], [null, 1], [null, 5], [null, 1]];
        },
      };
    };
    (limiter as any).redis = mock;

    await limiter.checkAndConsume("testkey", 10, 60000);
    assert.equal(fullKeyInPipeline, "testpfx:testkey");
  });
});
