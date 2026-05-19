/**
 * [SYS-PERF-3.2] No Redis KEYS Command Tests
 *
 * Verifies that Redis lock adapter uses SCAN instead of KEYS.
 * KEYS command is O(n) and blocks the event loop on large keyspaces.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "fs";
test("[SYS-PERF-3.2] redis lock adapter uses SCAN instead of KEYS", () => {
    const content = readFileSync("src/platform/execution/distributed-lock/redis-lock-adapter.ts", "utf8");
    // Must not use .keys() method which is O(n) blocking
    assert.ok(!content.includes(".keys("), "Redis lock adapter must not use .keys() method - use SCAN instead");
    // Must use SCAN or scanStream for key iteration
    assert.ok(content.includes(".scan(") || content.includes("scanStream("), "Redis lock adapter must use SCAN or scanStream for key iteration");
});
test("[SYS-PERF-3.2] redis lock adapter listHeldAsync uses SCAN", () => {
    const content = readFileSync("src/platform/execution/distributed-lock/redis-lock-adapter.ts", "utf8");
    // Check if listHeldAsync exists and uses SCAN
    const listHeldAsyncMatch = content.match(/listHeldAsync[\s\S]*?\{([\s\S]*?)\}/);
    if (listHeldAsyncMatch && listHeldAsyncMatch[1] !== undefined) {
        const methodBody = listHeldAsyncMatch[1];
        assert.ok(!methodBody.includes(".keys("), "listHeldAsync must not use .keys() - use SCAN instead");
        assert.ok(methodBody.includes(".scan(") || methodBody.includes("scanStream("), "listHeldAsync must use SCAN or scanStream for key iteration");
    }
});
test("[SYS-PERF-3.2] other redis operations do not use blocking KEYS command", () => {
    const content = readFileSync("src/platform/execution/distributed-lock/redis-lock-adapter.ts", "utf8");
    // Find all uses of redis.keys
    const keysUsage = content.match(/redis\.keys\(/g);
    assert.equal(keysUsage?.length ?? 0, 0, "redis.keys() is forbidden - it blocks the event loop on large keyspaces");
});
//# sourceMappingURL=no-redis-keys.test.js.map