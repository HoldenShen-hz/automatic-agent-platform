import assert from "node:assert/strict";
import test from "node:test";

import { PgAdvisoryLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/pg-advisory-lock-adapter.js";
import { RedisLockAdapter } from "../../../../../src/platform/five-plane-execution/distributed-lock/redis-lock-adapter.js";

type RedisLike = RedisLockAdapter["redis"];

function createRedisAdapterWithMock(redis: RedisLike): RedisLockAdapter {
  const adapter = new RedisLockAdapter({ host: "localhost", port: 6379 });
  (adapter as unknown as { redis: RedisLike }).redis = redis;
  return adapter;
}

function createSharedRedisMock(shared: {
  counter: number;
  script?: string;
  setCalls: Array<Array<string | number>>;
  storedValue: string | null;
}): RedisLike {
  return {
    status: "ready",
    connect: async () => {},
    incr: async () => {
      shared.counter += 1;
      return shared.counter;
    },
    set: async (_key: string, value: string, ...args: Array<string | number>) => {
      shared.storedValue = value;
      shared.setCalls.push(args);
      return "OK";
    },
    get: async () => shared.storedValue,
    del: async () => 1,
    eval: async (script: string) => {
      shared.script = script;
      return 1;
    },
    scan: async () => ["0", []],
    mget: async () => [],
    quit: async () => {},
    disconnect: () => {},
    on: () => {},
  };
}

test("RedisLockAdapter shares a Redis-backed monotonic fencing counter across adapter instances", async () => {
  const shared = {
    counter: 0,
    setCalls: [] as Array<Array<string | number>>,
    storedValue: null as string | null,
  };
  const adapterA = createRedisAdapterWithMock(createSharedRedisMock(shared));
  const adapterB = createRedisAdapterWithMock(createSharedRedisMock(shared));

  const acquireA = await adapterA.acquireAsync({ lockKey: "lock-a", owner: "owner-a" });
  const acquireB = await adapterB.acquireAsync({ lockKey: "lock-b", owner: "owner-b" });
  const stolen = await adapterA.forceStealAsync("lock-c", "owner-c", "test-steal");

  assert.equal(acquireA.lock?.fencingToken, 1);
  assert.equal(acquireB.lock?.fencingToken, 2);
  assert.equal(stolen.fencingToken, 3);
});

test("RedisLockAdapter extendAsync writes back updated ttlMs and preserves a PX TTL update path", async () => {
  const shared = {
    counter: 0,
    script: "",
    setCalls: [] as Array<Array<string | number>>,
    storedValue: JSON.stringify({
      owner: "owner-a",
      fencingToken: 7,
      ttlMs: 5000,
      acquiredAt: new Date().toISOString(),
      metadata: null,
    }),
  };
  const adapter = createRedisAdapterWithMock(createSharedRedisMock(shared));

  const extended = await adapter.extendAsync("lock-a", "owner-a", 5000);

  assert.ok(extended);
  assert.equal(extended?.ttlMs, 5000);
  assert.ok(shared.script?.includes("data.ttlMs = newTtl"));
  assert.ok(shared.script?.includes("'PX', newTtl"));
  assert.equal(shared.script?.includes("pexpire"), false);
});

test("RedisLockAdapter forceStealAsync no longer depends on XX and succeeds when the old lock is already absent", async () => {
  const shared = {
    counter: 0,
    setCalls: [] as Array<Array<string | number>>,
    storedValue: null as string | null,
  };
  const adapter = createRedisAdapterWithMock(createSharedRedisMock(shared));

  const stolen = await adapter.forceStealAsync("missing-lock", "new-owner", "expired-lock");

  assert.equal(stolen.owner, "new-owner");
  assert.ok(stolen.fencingToken > 0);
  assert.equal(shared.setCalls.some((args) => args.includes("XX")), false);
});

test("PgAdvisoryLockAdapter lockKeyToAdvisoryKey is not truncated to a 32-bit hash", () => {
  const adapter = new PgAdvisoryLockAdapter({ dsn: "postgresql://test:test@localhost/test" });
  const advisoryKey = (adapter as unknown as { lockKeyToAdvisoryKey: (key: string) => bigint }).lockKeyToAdvisoryKey(
    "tenant/region/service/workflow/lock-key-with-enough-entropy-to-cross-32-bit",
  );

  assert.equal(typeof advisoryKey, "bigint");
  assert.ok(advisoryKey > 0xFFFFFFFFn);
  assert.ok(advisoryKey <= 0x7FFFFFFFFFFFFFFFn);
});
