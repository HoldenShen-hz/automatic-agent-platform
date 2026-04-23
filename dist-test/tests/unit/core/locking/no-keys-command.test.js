/**
 * @fileoverview [SYS-PERF-3.2] Redis Lock Adapter KEYS Command Tests
 *
 * Regression tests for SYS-PERF-3.2: Redis KEYS command blocking
 *
 * The redis-lock-adapter.ts uses .keys() which blocks the Redis event loop.
 * Must use SCAN instead for production safety.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
test("[SYS-PERF-3.2] redis lock adapter uses SCAN not KEYS", () => {
    // Static analysis test: verify the implementation doesn't use .keys()
    // The KEYS command blocks Redis for the duration of the scan, which can
    // cause latency spikes in production. Use SCAN instead.
    const lockAdapterPath = join(process.cwd(), "src/platform/execution/distributed-lock/redis-lock-adapter.ts");
    assert.ok(existsSync(lockAdapterPath), `redis-lock-adapter.ts must exist at ${lockAdapterPath}`);
    const content = readFileSync(lockAdapterPath, "utf8");
    // Check for the problematic .keys( pattern
    const keysPattern = /\.keys\s*\(/;
    const match = content.match(keysPattern);
    assert.ok(!match, "redis-lock-adapter.ts must NOT use .keys() command. Use .scan() instead to avoid blocking Redis event loop.");
    // Verify that SCAN is used instead
    const scanPattern = /\.scan\s*\(/;
    const hasScan = scanPattern.test(content);
    assert.ok(hasScan, "redis-lock-adapter.ts should use .scan() for iterating keys (found in listHeldAsync)");
});
test("[SYS-PERF-3.2] redis lock adapter listHeldAsync uses SCAN", () => {
    // Verify that listHeldAsync properly uses SCAN for iteration
    const lockAdapterPath = join(process.cwd(), "src/platform/execution/distributed-lock/redis-lock-adapter.ts");
    const content = readFileSync(lockAdapterPath, "utf8");
    // Find the listHeldAsync method
    const listHeldMatch = content.match(/listHeldAsync[\s\S]*?\{[\s\S]*?\}/);
    assert.ok(listHeldMatch, "listHeldAsync method should exist");
    const listHeldCode = listHeldMatch[0];
    // Verify SCAN is used
    assert.ok(/\bscan\b/.test(listHeldCode), "listHeldAsync should use scan() method");
    // Verify KEYS is NOT used
    assert.ok(!/\.keys\(/.test(listHeldCode), "listHeldAsync must not use .keys() which blocks Redis");
});
test("[SYS-PERF-3.2] other files in execution layer must not use KEYS", () => {
    // Check other Redis-using files for the same issue
    const filesToCheck = [
        "src/platform/execution/queue/redis-queue-adapter.ts",
        "src/platform/shared/cache/stores/redis-cache-store.ts",
        "src/platform/interface/ingress/redis-rate-limiter.ts",
    ];
    for (const filePath of filesToCheck) {
        const fullPath = join(process.cwd(), filePath);
        if (!existsSync(fullPath)) {
            continue; // Skip if file doesn't exist
        }
        const content = readFileSync(fullPath, "utf8");
        const keysMatch = content.match(/\.keys\s*\(/);
        assert.ok(!keysMatch, `${filePath} must NOT use .keys() - it blocks the Redis event loop. Use .scan() instead.`);
    }
});
test("[SYS-PERF-3.2] KEYS vs SCAN performance impact explanation", () => {
    // Document the performance difference between KEYS and SCAN
    // KEYS pattern: O(N) where N is all keys in the database
    // - Blocks Redis completely during the scan
    // - Can cause latency spikes of seconds on large databases
    // - Should NEVER be used in production
    // SCAN pattern: O(1) per iteration, returns cursor and batch
    // - Non-blocking, yields to other clients
    // - Can be used incrementally over many calls
    // - Safe for production use
    const explanation = `
Redis KEYS vs SCAN performance characteristics:

KEYS <pattern>:
- Time complexity: O(N) where N = total keys in database
- Blocks Redis event loop for entire duration
- For 1M keys, can block for 1-5 seconds
- NOT safe for production

SCAN cursor [MATCH pattern] [COUNT count]:
- Time complexity: O(1) per call, but amortized O(N)
- Returns small batch per call (typically 10-100 keys)
- Non-blocking, yields to other clients between batches
- Safe for production

The redis-lock-adapter.ts uses SCAN in listHeldAsync() which is correct.
`;
    // This test just documents the issue - actual check is in the test above
    assert.ok(true, explanation);
});
test("[SYS-PERF-3.2] static analysis catches .keys( usage", () => {
    // Simulate a scenario where .keys( is used
    const buggyCode = `
public async listLocksAsync(): Promise<LockRecord[]> {
  const keys = await this.redis.keys("lock:*");
  // BAD: keys() blocks Redis event loop
  return this.getLocks(keys);
}
`;
    const correctCode = `
public async listLocksAsync(): Promise<LockRecord[]> {
  const locks: LockRecord[] = [];
  let cursor = "0";
  do {
    const [nextCursor, keys] = await this.redis.scan(cursor, "MATCH", "lock:*", "COUNT", 100);
    cursor = nextCursor;
    // Process keys in small batches
    for (const key of keys) {
      const lock = await this.getLock(key);
      if (lock) locks.push(lock);
    }
  } while (cursor !== "0");
  return locks;
}
`;
    // Verify our static analysis would catch the buggy code
    const buggyHasKeys = /\.keys\(/.test(buggyCode);
    const correctHasKeys = /\.keys\(/.test(correctCode);
    const correctHasScan = /\.scan\(/.test(correctCode);
    assert.strictEqual(buggyHasKeys, true, "Buggy code should have .keys(");
    assert.strictEqual(correctHasKeys, false, "Correct code should NOT have .keys(");
    assert.strictEqual(correctHasScan, true, "Correct code should have .scan(");
});
//# sourceMappingURL=no-keys-command.test.js.map