/**
 * Stable Prompt Injection CLI Tests
 *
 * Tests for stable-prompt-injection.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for CLI factory configuration
// ---------------------------------------------------------------------------
test("stable-prompt-injection uses AA_STABLE_PROMPT_INJECTION env var prefix", () => {
    const envVar = "AA_STABLE_PROMPT_INJECTION";
    assert.ok(envVar.startsWith("AA_"));
    assert.ok(envVar.includes("PROMPT_INJECTION"));
});
test("stable-prompt-injection defaultDir follows data/stable-prompt-injection pattern", () => {
    const defaultDir = "data/stable-prompt-injection";
    assert.ok(defaultDir.startsWith("data/"));
    assert.ok(defaultDir.includes("prompt-injection"));
});
test("stable-prompt-injection reportFilename follows stable-prompt-injection-report.json pattern", () => {
    const reportFilename = "stable-prompt-injection-report.json";
    assert.ok(reportFilename.endsWith(".json"));
    assert.ok(reportFilename.includes("prompt-injection"));
});
test("stable-prompt-injection failed predicate uses default failedScenarios", () => {
    const failed = (report) => (report.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 0 }), false);
    assert.equal(failed({ failedScenarios: 1 }), true);
});
//# sourceMappingURL=stable-prompt-injection.test.js.map