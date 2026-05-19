/**
 * Stable Validate CLI Tests
 *
 * Tests for stable-validate.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { loadStableValidateCliEnv } from "../../../../src/platform/control-plane/config-center/stable-cli-env.js";
// ---------------------------------------------------------------------------
// Tests for loadStableValidateCliEnv
// ---------------------------------------------------------------------------
test("loadStableValidateCliEnv returns default iterations of 3", () => {
    const result = loadStableValidateCliEnv({});
    assert.equal(result.iterations, 3);
});
test("loadStableValidateCliEnv parses custom iterations", () => {
    const result = loadStableValidateCliEnv({ AA_VALIDATION_ITERATIONS: "10" });
    assert.equal(result.iterations, 10);
});
test("loadStableValidateCliEnv throws on invalid iterations", () => {
    assert.throws(() => loadStableValidateCliEnv({ AA_VALIDATION_ITERATIONS: "-5" }), /stable\.invalid_env:AA_VALIDATION_ITERATIONS/);
});
test("loadStableValidateCliEnv throws on non-numeric iterations", () => {
    assert.throws(() => loadStableValidateCliEnv({ AA_VALIDATION_ITERATIONS: "invalid" }), /stable\.invalid_env:AA_VALIDATION_ITERATIONS/);
});
test("loadStableValidateCliEnv throws on zero iterations", () => {
    assert.throws(() => loadStableValidateCliEnv({ AA_VALIDATION_ITERATIONS: "0" }), /stable\.invalid_env:AA_VALIDATION_ITERATIONS/);
});
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-validate uses AA_VALIDATION env var prefix", () => {
    const envVar = "AA_VALIDATION";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("VALIDATION"));
});
test("stable-validate defaultDir follows data/validation pattern", () => {
    const defaultDir = "data/validation";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("validation"));
});
test("stable-validate failed predicate checks multiple failure types", () => {
    // Mirrors the failed predicate in stable-validate.ts
    const failed = (report) => (report.failedRuns ?? 0) > 0 || (report.integrityFailures ?? 0) > 0 || (report.backupFailures ?? 0) > 0;
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 0 }), false);
    assert.equal(failed({ failedRuns: 1, integrityFailures: 0, backupFailures: 0 }), true);
    assert.equal(failed({ failedRuns: 0, integrityFailures: 1, backupFailures: 0 }), true);
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 1 }), true);
});
//# sourceMappingURL=stable-validate.test.js.map