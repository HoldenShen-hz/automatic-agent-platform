import assert from "node:assert/strict";
import test from "node:test";
test("ExecutionResourceCeilingEnvConfig structure is correct", () => {
    const config = {
        maxToolCalls: 100,
        maxMemoryMb: 512,
        maxElapsedMs: 30000,
    };
    assert.equal(config.maxToolCalls, 100);
    assert.equal(config.maxMemoryMb, 512);
    assert.equal(config.maxElapsedMs, 30000);
});
test("ExecutionResourceCeilingEnvConfig allows null values", () => {
    const config = {
        maxToolCalls: null,
        maxMemoryMb: null,
        maxElapsedMs: null,
    };
    assert.equal(config.maxToolCalls, null);
    assert.equal(config.maxMemoryMb, null);
    assert.equal(config.maxElapsedMs, null);
});
test("ExecutionResourceCeilingEnvConfig allows mixed values", () => {
    const config = {
        maxToolCalls: 50,
        maxMemoryMb: null,
        maxElapsedMs: 60000,
    };
    assert.equal(config.maxToolCalls, 50);
    assert.equal(config.maxMemoryMb, null);
    assert.equal(config.maxElapsedMs, 60000);
});
test("ExecutionResourceCeilingEnvConfig values can be zero for maxToolCalls", () => {
    // Note: maxToolCalls: 0 might mean "no limit" or "disabled"
    // The type allows it, so the test should reflect that
    const config = {
        maxToolCalls: 0,
        maxMemoryMb: 256,
        maxElapsedMs: 30000,
    };
    assert.equal(config.maxToolCalls, 0);
});
//# sourceMappingURL=runtime-env-types.test.js.map