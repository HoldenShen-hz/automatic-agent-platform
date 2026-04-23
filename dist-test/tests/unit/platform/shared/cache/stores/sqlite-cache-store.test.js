/**
 * SQLite Cache Store Unit Tests
 *
 * Tests for persistent cache store using SQLite for L2/L3 caching.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { SqliteCacheStore } from "../../../../../../src/platform/shared/cache/stores/sqlite-cache-store.js";
function createTestMeta(overrides = {}) {
    return {
        scope: "persistent",
        tags: [],
        version: "1.0",
        createdAt: Date.now(),
        lastAccessedAt: Date.now(),
        hitCount: 0,
        sizeBytes: 100,
        ...overrides,
    };
}
function createMockDb(queryResults = [], executeResults = []) {
    const callLog = [];
    let queryIndex = 0;
    let execIndex = 0;
    return {
        callLog,
        execute: async (sql, params) => {
            callLog.push({ method: "execute", sql, params: params ?? [] });
            const result = executeResults[execIndex++] ?? { changes: 0 };
            return result;
        },
        query: async (sql, params) => {
            callLog.push({ method: "query", sql, params: params ?? [] });
            const result = queryResults[queryIndex++];
            return (result?.rows ?? []);
        },
    };
}
// ---------------------------------------------------------------------------
// get - Cache Hits
// ---------------------------------------------------------------------------
test("get returns hit=true for existing entry", async () => {
    const mockDb = createMockDb(
    // Query result for get
    [{
            rows: [
                {
                    namespace: "ns1",
                    cache_key: "key1",
                    value_json: JSON.stringify({ data: "test" }),
                    scope: "persistent",
                    version: "1.0",
                    tags_json: "[]",
                    size_bytes: 100,
                    created_at: Date.now(),
                    expires_at: null,
                    last_accessed_at: Date.now(),
                    hit_count: 0,
                },
            ],
        }], 
    // Update result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, true);
    assert.deepStrictEqual(result.value, { data: "test" });
    assert.strictEqual(result.layer, "L3");
});
test("get returns hit=false for non-existent entry", async () => {
    const mockDb = createMockDb(
    // Empty query result
    [{ rows: [] }], []);
    const store = new SqliteCacheStore(mockDb);
    const result = await store.get("ns1", "nonexistent");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.value, null);
    assert.strictEqual(result.reason, "not_found");
});
test("get returns hit=false for expired entry and deletes it", async () => {
    const pastTime = Date.now() - 1000;
    const mockDb = createMockDb(
    // Query result with expired entry
    [{
            rows: [
                {
                    namespace: "ns1",
                    cache_key: "key1",
                    value_json: JSON.stringify({ data: "test" }),
                    scope: "persistent",
                    version: "1.0",
                    tags_json: "[]",
                    size_bytes: 100,
                    created_at: Date.now(),
                    expires_at: pastTime,
                    last_accessed_at: Date.now(),
                    hit_count: 0,
                },
            ],
        }], 
    // Delete result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const result = await store.get("ns1", "key1");
    assert.strictEqual(result.hit, false);
    assert.strictEqual(result.reason, "expired");
    // Verify delete was called
    const deleteCalls = mockDb.callLog.filter((c) => c.sql.includes("DELETE"));
    assert.ok(deleteCalls.length > 0, "Delete should be called for expired entry");
});
test("get updates hit count and last accessed time", async () => {
    const mockDb = createMockDb(
    // Query result
    [{
            rows: [
                {
                    namespace: "ns1",
                    cache_key: "key1",
                    value_json: JSON.stringify({ data: "test" }),
                    scope: "persistent",
                    version: "1.0",
                    tags_json: "[]",
                    size_bytes: 100,
                    created_at: Date.now(),
                    expires_at: null,
                    last_accessed_at: Date.now(),
                    hit_count: 5,
                },
            ],
        }], 
    // Update result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    await store.get("ns1", "key1");
    // Verify update was called
    const updateCall = mockDb.callLog.find((c) => c.sql.includes("UPDATE"));
    assert.ok(updateCall, "Update should be called to increment hit count");
    assert.deepStrictEqual(updateCall?.params[1], "ns1");
    assert.deepStrictEqual(updateCall?.params[2], "key1");
});
// ---------------------------------------------------------------------------
// set - Basic Operations
// ---------------------------------------------------------------------------
test("set inserts new entry", async () => {
    const mockDb = createMockDb([], 
    // Insert result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const meta = createTestMeta({ tags: ["tag1", "tag2"] });
    await store.set("ns1", "key1", { data: "test" }, meta);
    // Verify insert was called
    const insertCall = mockDb.callLog.find((c) => c.sql.includes("INSERT INTO cache_entries"));
    assert.ok(insertCall, "Insert should be called");
    assert.deepStrictEqual(insertCall?.params[0], "ns1");
    assert.deepStrictEqual(insertCall?.params[1], "key1");
    // Verify tag inserts were called
    const tagInserts = mockDb.callLog.filter((c) => c.sql.includes("cache_tag_index"));
    assert.strictEqual(tagInserts.length, 2, "Should insert for each tag");
});
test("set updates existing entry", async () => {
    const mockDb = createMockDb([], 
    // Insert with ON CONFLICT result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const meta = createTestMeta({ tags: ["tag1"] });
    await store.set("ns1", "key1", { data: "updated" }, meta);
    // Verify insert/update was called
    const insertCall = mockDb.callLog.find((c) => c.sql.includes("INSERT INTO cache_entries"));
    assert.ok(insertCall, "Insert should be called with ON CONFLICT");
});
test("set handles entries without tags", async () => {
    const mockDb = createMockDb([], 
    // Insert result
    [{ changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const meta = createTestMeta({ tags: [] });
    await store.set("ns1", "key1", { data: "test" }, meta);
    // Verify no tag inserts were called
    const tagInserts = mockDb.callLog.filter((c) => c.sql.includes("cache_tag_index"));
    assert.strictEqual(tagInserts.length, 0, "Should not insert tag entries when no tags");
});
// ---------------------------------------------------------------------------
// delete
// ---------------------------------------------------------------------------
test("delete removes entry from cache_entries", async () => {
    const mockDb = createMockDb([], 
    // Delete results
    [{ changes: 1 }, { changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    await store.delete("ns1", "key1");
    const deleteCalls = mockDb.callLog.filter((c) => c.method === "execute");
    assert.ok(deleteCalls.length >= 2, "Should call delete on both tables");
    const cacheDelete = deleteCalls.find((c) => c.sql.includes("cache_entries"));
    assert.ok(cacheDelete, "Should delete from cache_entries");
    assert.deepStrictEqual(cacheDelete?.params, ["ns1", "key1"]);
});
test("delete removes entry from cache_tag_index", async () => {
    const mockDb = createMockDb([], 
    // Delete results
    [{ changes: 1 }, { changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    await store.delete("ns1", "key1");
    const tagDelete = mockDb.callLog.find((c) => c.sql.includes("cache_tag_index"));
    assert.ok(tagDelete, "Should delete from cache_tag_index");
    assert.deepStrictEqual(tagDelete?.params, ["ns1", "key1"]);
});
// ---------------------------------------------------------------------------
// invalidateByTag
// ---------------------------------------------------------------------------
test("invalidateByTag returns 0 when no entries match", async () => {
    const mockDb = createMockDb(
    // Empty tag index query
    [{ rows: [] }], []);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.invalidateByTag("nonexistent");
    assert.strictEqual(count, 0);
});
test("invalidateByTag deletes matching entries", async () => {
    const mockDb = createMockDb(
    // Tag index query result
    [{
            rows: [
                { namespace: "ns1", cache_key: "key1" },
                { namespace: "ns1", cache_key: "key2" },
            ],
        }], 
    // Delete results
    [{ changes: 1 }, { changes: 1 }, { changes: 1 }, { changes: 1 }]);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.invalidateByTag("tag1");
    assert.strictEqual(count, 2);
});
// ---------------------------------------------------------------------------
// invalidateNamespace
// ---------------------------------------------------------------------------
test("invalidateNamespace deletes all entries in namespace", async () => {
    const mockDb = createMockDb([], 
    // Delete from cache_entries result, Delete from cache_tag_index result
    [{ changes: 5 }, { changes: 3 }]);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.invalidateNamespace("ns1");
    assert.strictEqual(count, 5);
    const nsDelete = mockDb.callLog.find((c) => c.sql.includes("cache_entries"));
    assert.ok(nsDelete, "Should delete from cache_entries");
    assert.deepStrictEqual(nsDelete?.params, ["ns1"]);
    const tagNsDelete = mockDb.callLog.find((c) => c.sql.includes("cache_tag_index") && c.params.includes("ns1"));
    assert.ok(tagNsDelete, "Should delete from cache_tag_index for namespace");
});
test("invalidateNamespace returns 0 for non-existent namespace", async () => {
    const mockDb = createMockDb([], [{ changes: 0 }, { changes: 0 }]);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.invalidateNamespace("nonexistent");
    assert.strictEqual(count, 0);
});
// ---------------------------------------------------------------------------
// cleanupExpired
// ---------------------------------------------------------------------------
test("cleanupExpired deletes expired entries", async () => {
    const mockDb = createMockDb([], 
    // Delete result
    [{ changes: 3 }]);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.cleanupExpired();
    assert.strictEqual(count, 3);
    const deleteCall = mockDb.callLog.find((c) => c.sql.includes("DELETE FROM cache_entries"));
    assert.ok(deleteCall, "Should delete expired entries");
    assert.ok(deleteCall?.sql.includes("expires_at"), "Delete should filter by expires_at");
});
test("cleanupExpired returns 0 when no entries expired", async () => {
    const mockDb = createMockDb([], [{ changes: 0 }]);
    const store = new SqliteCacheStore(mockDb);
    const count = await store.cleanupExpired();
    assert.strictEqual(count, 0);
});
//# sourceMappingURL=sqlite-cache-store.test.js.map