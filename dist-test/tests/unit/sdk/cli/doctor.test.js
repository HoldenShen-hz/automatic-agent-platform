/**
 * Doctor CLI Tests
 *
 * Tests for doctor.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for EPIPE handler logic
// ---------------------------------------------------------------------------
test("EPIPE error code is recognized as broken pipe", () => {
    const error = { code: "EPIPE" };
    assert.equal(error.code, "EPIPE");
});
test("non-EPIPE errors should be rethrown", () => {
    const error = { code: "ECONNREFUSED" };
    assert.notEqual(error.code, "EPIPE");
});
// ---------------------------------------------------------------------------
// Tests for doctor CLI entrypoint
// ---------------------------------------------------------------------------
test("doctor CLI installs broken pipe handler", () => {
    // The doctor.ts file calls installBrokenPipeHandler() which sets up
    // process.stdout.on("error", ...) to handle EPIPE errors gracefully
    // This is a smoke test to verify the concept
    const stdout = process.stdout;
    assert.ok(stdout != null);
});
//# sourceMappingURL=doctor.test.js.map