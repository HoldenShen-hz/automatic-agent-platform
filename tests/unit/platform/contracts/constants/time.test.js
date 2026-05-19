import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_LOCK_TTL_MS, SECONDS_PER_DAY, MS_PER_DAY, } from "../../../../../src/platform/contracts/constants/time.js";
test("DEFAULT_LOCK_TTL_MS is 30 seconds", () => {
    assert.equal(DEFAULT_LOCK_TTL_MS, 30_000);
});
test("SECONDS_PER_DAY is 86400", () => {
    assert.equal(SECONDS_PER_DAY, 86_400);
});
test("MS_PER_DAY is 86400000", () => {
    assert.equal(MS_PER_DAY, 86_400_000);
});
test("MS_PER_DAY equals SECONDS_PER_DAY * 1000", () => {
    assert.equal(MS_PER_DAY, SECONDS_PER_DAY * 1000);
});
test("DEFAULT_LOCK_TTL_MS is less than one minute", () => {
    assert.ok(DEFAULT_LOCK_TTL_MS < 60_000);
    assert.ok(DEFAULT_LOCK_TTL_MS > 0);
});
test("SECONDS_PER_DAY equals 24 hours worth of seconds", () => {
    assert.equal(SECONDS_PER_DAY, 86400); // 24 * 60 * 60
    assert.equal(SECONDS_PER_DAY, 24 * 60 * 60);
});
test("MS_PER_DAY is in milliseconds", () => {
    assert.ok(MS_PER_DAY > 1_000_000);
});
//# sourceMappingURL=time.test.js.map