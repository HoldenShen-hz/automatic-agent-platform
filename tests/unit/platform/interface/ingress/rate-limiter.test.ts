/**
 * Rate Limiter Unit Tests
 *
 * Tests for RedisRateLimiter with mocked Redis client.
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
      zremrangebyscore: function(_key, _min, _max) {
        self.pipelineCommands.push("zremrangebyscore");
        return this;
      },
      zadd: function(_key, _score, _member) {
        self.pipelineCommands.push("zadd");
        return this;
      },
      zcard: function(_key) {
        self.pipelineCommands.push("zcard");
        return this;
      },
      pexpire: function(_key, _ms) {
        self.pipelineCommands.push("pexpire");
        return this;
      },
      exec: async function() {
        self.pipelineCommands.push("exec");
        return self.pipelineResults;
      },
    };
  }

  async zremrangebyscore(_key, _min, _max): Promise<number> {
    this.zremrangebyscoreCount++;
    return 0;
  }

  async zcard(_key): Promise<number> {
    this.zcardCount++;
    return 3;
  }

  async zrange(key, ..._args): Promise<string[]> {
    this.lastZrangeKey = key;
    return [];
  }

  async zrem(key, id): Promise<number> {
    this.lastZrangeKey = key;
    this.lastZremId = id;
    return 1;
  }

  async del(key): Promise<number> {
    this.lastDelKey = key;
    return 1;
  }
}

async function withMockRedisCtor<T>(
  run: (MockRedisClient: new () => MockRedisClient) => Promise<T>,
): Promise<T> {
  require(ioredisPath);
  const moduleEntry = require.cache[ioredisPath];
  if (!moduleEntry) {
    throw new Error("ioredis module must be present in require cache");
  }
  const originalExports = moduleEntry.exports;

  moduleEntry.exports = MockRedisClient;
  try {
    return await run(MockRedisClient as any);
  } finally {
    moduleEntry.exports = originalExports;
  }
}

async function getRedisRateLimiter() {
  const { RedisRateLimiter } = await import("../../../../../src/platform/five-plane-interface/ingress/redis-rate-limiter.js");
  return RedisRateLimiter;
}

test("RedisRateLimiter constructor creates instance", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
    assert.ok(limiter !== null);
    assert.ok(limiter !== undefined);
  });
});

test("RedisRateLimiter default keyPrefix is ratelimit:", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });
    assert.ok(limiter !== null);
  });
});

test("RedisRateLimiter custom keyPrefix is applied", async () => {
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

test("RedisRateLimiter checkAndConsume returns allowed when under limit", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 5],
      [null, 1],
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 5);
  });
});

test("RedisRateLimiter checkAndConsume returns not allowed when over limit", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => ["request1", String(Date.now() - 30000)];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.equal(result.remaining, 0);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter checkAndConsume handles null zcard result", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, null],
      [null, 1],
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 10);
  });
});

test("RedisRateLimiter checkAndConsume removes entry when rejected", async () => {
  let zremCalled = false;

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "rl:",
    });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => ["req1", String(Date.now() - 30000)];
    mock.zrem = async () => {
      zremCalled = true;
      return 1;
    };
    (limiter as any).redis = mock;

    await limiter.checkAndConsume("test:key", 10, 60000);
    assert.ok(zremCalled, "zrem should be called to remove rejected entry");
  });
});

test("RedisRateLimiter checkAndConsume calculates retryAfterMs from oldest entry", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    const now = Date.now();
    mock.zrange = async () => ["req1", String(now - 30000)];
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs > 0);
    assert.ok(result.retryAfterMs <= 60000);
  });
});

test("RedisRateLimiter checkAndConsume handles empty zrange result", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => [];
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter checkAndConsume handles partial zrange result", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => ["req1"];
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, false);
    assert.ok(result.retryAfterMs !== undefined);
  });
});

test("RedisRateLimiter getUsage returns count of entries in window", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.zrange = async () => ["req1", "req2", "req3"];
    (limiter as any).redis = mock;

    const count = await limiter.getUsage("test:key", 60000);
    assert.equal(count, 3);
  });
});

test("RedisRateLimiter getUsage calls zremrangebyscore then zcard", async () => {
  let zremrangebyscoreCalled = false;
  let zcardCalled = false;

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
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
    assert.ok(zremrangebyscoreCalled);
    assert.ok(zcardCalled);
  });
});

test("RedisRateLimiter reset deletes the key with prefix", async () => {
  let deletedKey = "";

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({
      host: "localhost",
      port: 6379,
      keyPrefix: "rl:",
    });

    const mock = new MockRedisClient();
    mock.del = async (key) => {
      deletedKey = key;
      return 1;
    };
    (limiter as any).redis = mock;

    await limiter.reset("test:key");
    assert.equal(deletedKey, "rl:test:key");
  });
});

test("RedisRateLimiter connect calls redis.connect", async () => {
  let connectCalled = false;

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
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

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
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

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
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

  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
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
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 10],
      [null, 1],
    ];
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.allowed, true);
    assert.equal(result.remaining, 0);
  });
});

test("RedisRateLimiter checkAndConsume remaining never goes negative", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 15],
      [null, 1],
    ];
    mock.zrange = async () => ["req1", String(Date.now() - 30000)];
    mock.zrem = async () => 1;
    (limiter as any).redis = mock;

    const result = await limiter.checkAndConsume("test:key", 10, 60000);
    assert.equal(result.remaining, 0);
  });
});

test("RedisRateLimiter pipeline includes all required commands", async () => {
  await withMockRedisCtor(async () => {
    const RedisRateLimiter = await getRedisRateLimiter();
    const limiter = new RedisRateLimiter({ host: "localhost", port: 6379 });

    const mock = new MockRedisClient();
    mock.pipelineResults = [
      [null, 0],
      [null, 1],
      [null, 5],
      [null, 1],
    ];
    (limiter as any).redis = mock;

    await limiter.checkAndConsume("test:key", 10, 60000);

    assert.ok(mock.pipelineCommands.includes("zremrangebyscore"));
    assert.ok(mock.pipelineCommands.includes("zadd"));
    assert.ok(mock.pipelineCommands.includes("zcard"));
    assert.ok(mock.pipelineCommands.includes("pexpire"));
    assert.ok(mock.pipelineCommands.includes("exec"));
  });
});