import assert from "node:assert/strict";
import test from "node:test";

import { RedisCacheStore } from "../../../../../src/platform/shared/cache/stores/redis-cache-store.js";
import type { CacheMeta } from "../../../../../src/platform/shared/cache/cache-types.js";

type FakeRedis = ReturnType<typeof createFakeRedis>;

function makeMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    scope: "session",
    tags: [],
    version: "v1",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 64,
    ...overrides,
  };
}

function createFakeRedis() {
  const kv = new Map<string, string>();
  const sets = new Map<string, Set<string>>();
  const expirations = new Map<string, number>();

  const getSet = (key: string): Set<string> => {
    let entry = sets.get(key);
    if (entry == null) {
      entry = new Set<string>();
      sets.set(key, entry);
    }
    return entry;
  };

  const applyCommand = async (command: string, args: unknown[]): Promise<unknown> => {
    switch (command) {
      case "set": {
        const [key, value, mode, ttlMs] = args as [string, string, string | undefined, number | undefined];
        kv.set(key, value);
        if (mode === "PX" && typeof ttlMs === "number") {
          expirations.set(key, Date.now() + ttlMs);
        } else {
          expirations.delete(key);
        }
        return "OK";
      }
      case "get": {
        const [key] = args as [string];
        if (!kv.has(key)) {
          return null;
        }
        const expiresAt = expirations.get(key);
        if (expiresAt != null && expiresAt <= Date.now()) {
          kv.delete(key);
          expirations.delete(key);
          return null;
        }
        return kv.get(key) ?? null;
      }
      case "del": {
        let count = 0;
        for (const key of args as string[]) {
          count += kv.delete(key) ? 1 : 0;
          expirations.delete(key);
          sets.delete(key);
        }
        return count;
      }
      case "sadd": {
        const [key, ...members] = args as [string, ...string[]];
        const entry = getSet(key);
        for (const member of members) {
          entry.add(member);
        }
        return entry.size;
      }
      case "srem": {
        const [key, ...members] = args as [string, ...string[]];
        const entry = getSet(key);
        let removed = 0;
        for (const member of members) {
          if (entry.delete(member)) {
            removed += 1;
          }
        }
        if (entry.size === 0) {
          sets.delete(key);
        }
        return removed;
      }
      case "smembers": {
        const [key] = args as [string];
        return [...(sets.get(key) ?? new Set<string>())];
      }
      case "mget": {
        return Promise.all((args as string[]).map(async (key) => applyCommand("get", [key]) as Promise<string | null>));
      }
      case "pttl": {
        const [key] = args as [string];
        if (!kv.has(key) && !sets.has(key)) {
          return -2;
        }
        const expiresAt = expirations.get(key);
        if (expiresAt == null) {
          return -1;
        }
        return Math.max(0, expiresAt - Date.now());
      }
      case "pexpire": {
        const [key, ttlMs] = args as [string, number];
        expirations.set(key, Date.now() + ttlMs);
        return 1;
      }
      case "scan": {
        const [, matchToken, pattern] = args as [string, string, string, string, number];
        assert.equal(matchToken, "MATCH");
        const regex = new RegExp(`^${pattern.replace(/\*/g, ".*")}$`);
        const keys = [...sets.keys()].filter((key) => regex.test(key));
        return ["0", keys];
      }
      case "sscan": {
        const [key] = args as [string, string, string, number];
        return ["0", [...(sets.get(key) ?? new Set<string>())]];
      }
      default:
        throw new Error(`Unsupported fake redis command: ${command}`);
    }
  };

  return {
    status: "ready",
    get: (key: string) => applyCommand("get", [key]) as Promise<string | null>,
    del: (...keys: string[]) => applyCommand("del", keys) as Promise<number>,
    smembers: (key: string) => applyCommand("smembers", [key]) as Promise<string[]>,
    srem: (key: string, ...members: string[]) => applyCommand("srem", [key, ...members]) as Promise<number>,
    mget: (...keys: string[]) => applyCommand("mget", keys) as Promise<Array<string | null>>,
    pttl: (key: string) => applyCommand("pttl", [key]) as Promise<number>,
    pexpire: (key: string, ttlMs: number) => applyCommand("pexpire", [key, ttlMs]) as Promise<number>,
    scan: (cursor: string, match: string, pattern: string, count: string, amount: number) =>
      applyCommand("scan", [cursor, match, pattern, count, amount]) as Promise<[string, string[]]>,
    sscan: (key: string, cursor: string, count: string, amount: number) =>
      applyCommand("sscan", [key, cursor, count, amount]) as Promise<[string, string[]]>,
    pipeline() {
      const commands: Array<[string, unknown[]]> = [];
      return {
        set(...args: unknown[]) {
          commands.push(["set", args]);
          return this;
        },
        sadd(...args: unknown[]) {
          commands.push(["sadd", args]);
          return this;
        },
        srem(...args: unknown[]) {
          commands.push(["srem", args]);
          return this;
        },
        del(...args: unknown[]) {
          commands.push(["del", args]);
          return this;
        },
        exec: async () => {
          const results: Array<[null, unknown]> = [];
          for (const [command, args] of commands) {
            results.push([null, await applyCommand(command, args)]);
          }
          return results;
        },
      };
    },
  };
}

function createStore(redis = createFakeRedis()): RedisCacheStore {
  const store = Object.create(RedisCacheStore.prototype) as RedisCacheStore & {
    redis: FakeRedis;
    prefix: string;
  };
  store.redis = redis;
  store.prefix = "test:";
  return store;
}

test("RedisCacheStore isolates entry keys from tag and namespace indexes", async () => {
  const store = createStore();
  const expiresAt = Date.now() + 60_000;

  await store.set("_tag", "_ns", { ok: true }, makeMeta({ tags: ["_ns"], expiresAt }));

  const result = await store.get<{ ok: boolean }>("_tag", "_ns");

  assert.equal(result.hit, true);
  assert.equal(result.meta?.expiresAt, expiresAt);
});

test("RedisCacheStore set with expired TTL removes stale entry and indexes", async () => {
  const redis = createFakeRedis();
  const store = createStore(redis);

  await store.set("ns", "key1", "value", makeMeta({ tags: ["tag:a"], expiresAt: Date.now() + 60_000 }));
  await store.set("ns", "key1", "value", makeMeta({ tags: ["tag:a"], expiresAt: Date.now() - 1 }));

  const result = await store.get<string>("ns", "key1");
  const tagMembers = await redis.smembers("test:index:tag:tag%3Aa");
  const namespaceMembers = await redis.smembers("test:index:namespace:ns");

  assert.equal(result.hit, false);
  assert.deepEqual(tagMembers, []);
  assert.deepEqual(namespaceMembers, []);
});

test("RedisCacheStore cleanupExpired removes stale members from tag and namespace indexes", async () => {
  const redis = createFakeRedis();
  const store = createStore(redis);
  const fullKey = "test:entry:ns:key1";

  await redis.pipeline()
    .sadd("test:index:tag:tag%3Aa", fullKey)
    .sadd("test:index:namespace:ns", fullKey)
    .exec();

  const cleaned = await store.cleanupExpired();

  assert.equal(cleaned, 2);
  assert.deepEqual(await redis.smembers("test:index:tag:tag%3Aa"), []);
  assert.deepEqual(await redis.smembers("test:index:namespace:ns"), []);
});
