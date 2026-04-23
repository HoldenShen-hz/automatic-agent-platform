import assert from "node:assert/strict";
import test from "node:test";
// Re-export test for barrel file
import { DEFAULT_LOCK_TTL_MS, SECONDS_PER_DAY, MS_PER_DAY, } from "../../../../../src/platform/contracts/constants/index.js";
test("constants index exports time constants", () => {
    assert.equal(DEFAULT_LOCK_TTL_MS, 30_000);
    assert.equal(SECONDS_PER_DAY, 86_400);
    assert.equal(MS_PER_DAY, 86_400_000);
});
test("DEFAULT_LOCK_TTL_MS is used for lock timeout", () => {
    const lockTimeout = DEFAULT_LOCK_TTL_MS;
    assert.ok(lockTimeout > 0);
    assert.ok(lockTimeout < 60000);
});
test("SECONDS_PER_DAY multiplied by 1000 equals MS_PER_DAY", () => {
    assert.equal(SECONDS_PER_DAY * 1000, MS_PER_DAY);
});
test("Time constants are positive numbers", () => {
    assert.ok(DEFAULT_LOCK_TTL_MS > 0);
    assert.ok(SECONDS_PER_DAY > 0);
    assert.ok(MS_PER_DAY > 0);
});
//# sourceMappingURL=index.test.js.map