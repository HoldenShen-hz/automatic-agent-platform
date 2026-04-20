import assert from "node:assert/strict";
import test from "node:test";

import { SqliteCacheStore } from "../../../../../src/platform/shared/cache/stores/sqlite-cache-store.js";
import type { CacheMeta } from "../../../../../src/platform/shared/cache/cache-types.js";

function makeMeta(overrides: Partial<CacheMeta> = {}): CacheMeta {
  return {
    scope: "memory",
    tags: ["tag:a"],
    version: "v1",
    createdAt: Date.now(),
    lastAccessedAt: Date.now(),
    hitCount: 0,
    sizeBytes: 32,
    ...overrides,
  };
}

// Mock database that stores entries in memory
class MockDatabase {
  public entries: Map<string, {
    namespace: string;
    cache_key: string;
    value_json: string;
    scope: string;
    version: string;
    tags_json: string;
    size_bytes: number;
    created_at: number;
    expires_at: number | null;
    last_accessed_at: number;
    hit_count: number;
  }> = new Map();

  public tagIndex: Map<string, Array<{ namespace: string; cache_key: string }>> = new Map();

  async query<T>(sql: string, params?: unknown[]): Promise<T[]> {
    if (sql.includes("SELECT") && sql.includes("cache_entries") && sql.includes("namespace = ?")) {
      const namespace = (params as string[])[0] ?? "";
      const key = (params as string[])[1] ?? "";
      const fullKey = `${namespace}:${key}`;
      const entry = this.entries.get(fullKey);
      if (entry) return [entry as unknown as T];
      return [];
    }
    if (sql.includes("SELECT") && sql.includes("cache_tag_index") && sql.includes("tag = ?")) {
      const tag = (params as string[])[0] ?? "";
      return (this.tagIndex.get(tag) ?? []) as unknown as T[];
    }
    return [];
  }

  async execute(sql: string, params?: unknown[]): Promise<{ changes?: number }> {
    if (sql.includes("INSERT") && sql.includes("cache_entries")) {
      const p = params as unknown[];
      const namespace = String(p[0] ?? "");
      const key = String(p[1] ?? "");
      const scope = String(p[2] ?? "");
      const value_json = String(p[3] ?? "");
      const version = String(p[4] ?? "");
      const tags_json = String(p[5] ?? "");
      const size_bytes = Number(p[6] ?? 0);
      const created_at = Number(p[7] ?? 0);
      const expires_at = p[8] != null ? Number(p[8]) : null;
      const last_accessed_at = Number(p[9] ?? 0);
      const hit_count = Number(p[10] ?? 0);

      const fullKey = `${namespace}:${key}`;
      this.entries.set(fullKey, {
        namespace, cache_key: key, value_json, scope, version, tags_json,
        size_bytes, created_at, expires_at, last_accessed_at, hit_count,
      });
      return { changes: 1 };
    }
    if (sql.includes("INSERT") && sql.includes("cache_tag_index")) {
      const tag = String((params as string[])[0] ?? "");
      const namespace = String((params as string[])[1] ?? "");
      const key = String((params as string[])[2] ?? "");
      const existing = this.tagIndex.get(tag) ?? [];
      existing.push({ namespace, cache_key: key });
      this.tagIndex.set(tag, existing);
      return { changes: 1 };
    }
    if (sql.includes("UPDATE") && sql.includes("cache_entries")) {
      return { changes: 1 };
    }
    if (sql.includes("DELETE") && sql.includes("cache_entries") && sql.includes("expires_at")) {
      // cleanupExpired query
      const cutoffTime = Number(params?.[0] ?? 0);
      let count = 0;
      for (const [key, entry] of this.entries.entries()) {
        if (entry.expires_at != null && entry.expires_at <= cutoffTime) {
          this.entries.delete(key);
          count++;
        }
      }
      return { changes: count };
    }
    if (sql.includes("DELETE") && sql.includes("cache_entries") && sql.includes("namespace = ?")) {
      const namespace = String((params as string[])[0] ?? "");
      // Check if this is a namespace-only delete (invalidateNamespace) or single key delete
      if (sql.includes("cache_key = ?") && params && params.length >= 2) {
        const key = String((params as string[])[1] ?? "");
        const fullKey = `${namespace}:${key}`;
        this.entries.delete(fullKey);
        return { changes: 1 };
      } else {
        // Namespace-only delete - remove all entries with this namespace prefix
        let count = 0;
        for (const key of this.entries.keys()) {
          if (key.startsWith(`${namespace}:`)) {
            this.entries.delete(key);
            count++;
          }
        }
        return { changes: count };
      }
    }
    if (sql.includes("DELETE") && sql.includes("cache_tag_index") && sql.includes("namespace = ?")) {
      return { changes: 0 };
    }
    return { changes: 0 };
  }
}

test("SqliteCacheStore.get returns miss for not found entry", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  const result = await store.get<string>("ns", "nonexistent");

  assert.equal(result.hit, false);
  assert.equal(result.value, null);
  assert.equal(result.reason, "not_found");
});

test("SqliteCacheStore.get returns hit with parsed value", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  // Manually insert an entry
  const meta = makeMeta();
  await store.set("ns", "key1", { data: "test" }, meta);

  const result = await store.get<{ data: string }>("ns", "key1");

  assert.equal(result.hit, true);
  assert.deepEqual(result.value, { data: "test" });
  assert.equal(result.layer, "L3");
});

test("SqliteCacheStore.get returns miss for expired entry", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  const expiredMeta = makeMeta({
    expiresAt: Date.now() - 1000,
  });
  await store.set("ns", "expired", "value", expiredMeta);

  const result = await store.get<string>("ns", "expired");

  assert.equal(result.hit, false);
  assert.equal(result.reason, "expired");
});

test("SqliteCacheStore.set inserts entry with correct fields", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  const meta = makeMeta({ tags: ["tag:x", "tag:y"] });
  await store.set("ns", "key1", { hello: "world" }, meta);

  const result = await store.get<{ hello: string }>("ns", "key1");
  assert.equal(result.hit, true);
  assert.deepEqual(result.value, { hello: "world" });
});

test("SqliteCacheStore.set updates existing entry on conflict", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns", "key1", "original", makeMeta());
  await store.set("ns", "key1", "updated", makeMeta());

  const result = await store.get<string>("ns", "key1");
  assert.equal(result.hit, true);
  assert.equal(result.value, "updated");
});

test("SqliteCacheStore.delete removes entry", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns", "key1", "value", makeMeta());
  await store.delete("ns", "key1");

  const result = await store.get<string>("ns", "key1");
  assert.equal(result.hit, false);
});

test("SqliteCacheStore.invalidateByTag removes tagged entries", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns", "key1", "v1", makeMeta({ tags: ["tag:x"] }));
  await store.set("ns", "key2", "v2", makeMeta({ tags: ["tag:y"] }));
  await store.set("ns", "key3", "v3", makeMeta({ tags: ["tag:x"] }));

  const count = await store.invalidateByTag("tag:x");

  assert.equal(count >= 1, true);
});

test("SqliteCacheStore.invalidateByTag returns 0 for non-existent tag", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  const count = await store.invalidateByTag("nonexistent:tag");

  assert.equal(count, 0);
});

test("SqliteCacheStore.invalidateNamespace removes all entries in namespace", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns1", "key1", "v1", makeMeta());
  await store.set("ns2", "key2", "v2", makeMeta());

  const count = await store.invalidateNamespace("ns1");

  assert.equal(count >= 1, true);

  const r1 = await store.get<string>("ns1", "key1");
  const r2 = await store.get<string>("ns2", "key2");
  assert.equal(r1.hit, false);
  assert.equal(r2.hit, true);
});

test("SqliteCacheStore.cleanupExpired removes expired entries", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns", "expired", "old", makeMeta({ expiresAt: Date.now() - 1000 }));
  await store.set("ns", "fresh", "new", makeMeta({ expiresAt: Date.now() + 10000 }));

  const cleaned = await store.cleanupExpired();

  assert.equal(cleaned >= 1, true);

  const rExpired = await store.get<string>("ns", "expired");
  const rFresh = await store.get<string>("ns", "fresh");
  assert.equal(rExpired.hit, false);
  assert.equal(rFresh.hit, true);
});

test("SqliteCacheStore.set creates tag index entries", async () => {
  const db = new MockDatabase();
  const store = new SqliteCacheStore(db);

  await store.set("ns", "key1", "value", makeMeta({ tags: ["tool:read", "file:/workspace/a.ts"] }));

  const result = await db.query<{ namespace: string; cache_key: string }>(
    `SELECT namespace, cache_key FROM cache_tag_index WHERE tag = ?`,
    ["tool:read"]
  );

  assert.equal(result.length > 0, true);
});
