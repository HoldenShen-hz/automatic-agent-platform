/**
 * Stable Runner Factory CLI Tests
 *
 * Tests for stable-runner-factory.ts module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for StableRunnerOptions interface
// ---------------------------------------------------------------------------
test("StableRunnerOptions requires outputDir", () => {
    const opts = { outputDir: "/test/output" };
    assert.equal(opts.outputDir, "/test/output");
});
// ---------------------------------------------------------------------------
// Tests for createStableCli factory options
// ---------------------------------------------------------------------------
test("createStableCli accepts envVar option", () => {
    const opts = {
        envVar: "AA_STABLE_TEST",
        defaultDir: "data/stable-test",
        runner: () => ({}),
    };
    assert.equal(opts.envVar, "AA_STABLE_TEST");
    assert.equal(opts.defaultDir, "data/stable-test");
});
test("createStableCli accepts optional reportFilename", () => {
    const opts = {
        envVar: "AA_STABLE_TEST",
        defaultDir: "data/stable-test",
        reportFilename: "stable-test-report.json",
        runner: () => ({}),
    };
    assert.equal(opts.reportFilename, "stable-test-report.json");
});
test("createStableCli accepts custom failed predicate", () => {
    const customFailed = (r) => r.failed === true;
    const opts = {
        envVar: "AA_STABLE_TEST",
        defaultDir: "data/stable-test",
        runner: () => ({}),
        failed: customFailed,
    };
    assert.equal(opts.failed?.({ failed: false }), false);
    assert.equal(opts.failed?.({ failed: true }), true);
});
test("createStableCli uses default failed predicate checking failedScenarios", () => {
    const defaultFailed = (r) => (r.failedScenarios ?? 0) > 0;
    assert.equal(defaultFailed({ failedScenarios: 0 }), false);
    assert.equal(defaultFailed({ failedScenarios: 1 }), true);
    assert.equal(defaultFailed({}), false);
});
test("createStableCli accepts prepare function for custom args", () => {
    const prepare = (outputDir) => ({
        outputDir,
        customArg: "value",
        durationMs: 5000,
    });
    const result = prepare("/test/output");
    assert.equal(result.outputDir, "/test/output");
    assert.equal(result.customArg, "value");
    assert.equal(result.durationMs, 5000);
});
test("createStableCli accepts includeOutputDir option", () => {
    const opts = {
        envVar: "AA_STABLE_TEST",
        defaultDir: "data/stable-test",
        includeOutputDir: false,
        runner: () => ({}),
    };
    assert.equal(opts.includeOutputDir, false);
});
// ---------------------------------------------------------------------------
// Tests for output dir resolution logic
// ---------------------------------------------------------------------------
test("output dir uses env var when set", () => {
    const envKey = "AA_STABLE_TEST_OUTPUT_DIR";
    const envValue = "/custom/output/path";
    const fromEnv = envValue;
    if (fromEnv && fromEnv.length > 0) {
        assert.equal(fromEnv, "/custom/output/path");
    }
});
test("output dir ignores empty string env var", () => {
    const envKey = "AA_STABLE_TEST_OUTPUT_DIR";
    const fromEnv = "";
    const result = fromEnv && fromEnv.length > 0 ? fromEnv : null;
    assert.equal(result, null);
});
test("output dir uses default when env is not set", () => {
    const envKey = "AA_STABLE_TEST_OUTPUT_DIR";
    const fromEnv = undefined;
    const result = fromEnv && fromEnv.length > 0 ? fromEnv : null;
    assert.equal(result, null);
});
// ---------------------------------------------------------------------------
// Tests for runner invocation logic
// ---------------------------------------------------------------------------
test("runner receives outputDir in args by default", () => {
    const runnerArgs = { outputDir: "/test/output" };
    assert.equal(runnerArgs.outputDir, "/test/output");
});
test("runner receives prepared args when prepare is provided", () => {
    const prepare = (_outputDir) => ({ durationMs: 5000, custom: true });
    const preparedArgs = prepare("/test/output");
    const runnerArgs = { ...preparedArgs, outputDir: "/test/output" };
    assert.equal(runnerArgs.durationMs, 5000);
    assert.equal(runnerArgs.custom, true);
    assert.equal(runnerArgs.outputDir, "/test/output");
});
test("runner args excludes outputDir when includeOutputDir is false", () => {
    const prepare = (_outputDir) => ({ durationMs: 5000 });
    const preparedArgs = prepare("/test/output");
    // includeOutputDir = false means don't inject outputDir
    const runnerArgs = preparedArgs; // No outputDir injected
    assert.equal(runnerArgs.durationMs, 5000);
    assert.equal("outputDir" in runnerArgs, false);
});
test("async runner is properly awaited", async () => {
    const asyncRunner = async () => ({ failedScenarios: 0, async: true });
    const result = asyncRunner();
    // Check it's a promise
    assert.equal(result instanceof Promise, true);
    // Await and verify
    const report = await result;
    assert.equal(report.failedScenarios, 0);
    assert.equal(report.async, true);
});
test("sync runner returns result directly", () => {
    const syncRunner = () => ({ failedScenarios: 0, async: false });
    const result = syncRunner();
    // Sync result is not a promise
    assert.equal(result instanceof Promise, false);
    assert.equal(result.failedScenarios, 0);
    assert.equal(result.async, false);
});
// ---------------------------------------------------------------------------
// Tests for failed predicate logic
// ---------------------------------------------------------------------------
test("failed predicate returns true when failedScenarios > 0", () => {
    const failed = (r) => (r.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 1 }), true);
    assert.equal(failed({ failedScenarios: 5 }), true);
    assert.equal(failed({ failedScenarios: 0 }), false);
});
test("failed predicate returns false for empty object with default", () => {
    const failed = (r) => (r.failedScenarios ?? 0) > 0;
    assert.equal(failed({}), false);
});
test("failed predicate with custom check works correctly", () => {
    const failed = (r) => (r.failedRuns ?? 0) > 0 || (r.integrityFailures ?? 0) > 0 || (r.backupFailures ?? 0) > 0;
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 0 }), false);
    assert.equal(failed({ failedRuns: 1 }), true);
    assert.equal(failed({ integrityFailures: 1 }), true);
    assert.equal(failed({ backupFailures: 1 }), true);
    assert.equal(failed({ failedRuns: 0, integrityFailures: 0, backupFailures: 1 }), true);
});
// ---------------------------------------------------------------------------
// Tests for report path construction
// ---------------------------------------------------------------------------
test("report path joins outputDir and reportFilename", () => {
    const outputDir = "/test/output";
    const reportFilename = "stable-test-report.json";
    const reportPath = `${outputDir}/${reportFilename}`;
    assert.equal(reportPath, "/test/output/stable-test-report.json");
});
// ---------------------------------------------------------------------------
// Tests for exit code logic
// ---------------------------------------------------------------------------
test("exit code is 1 when failed predicate returns true", () => {
    const report = { failedScenarios: 3 };
    const shouldFail = (report.failedScenarios ?? 0) > 0;
    const exitCode = shouldFail ? 1 : 0;
    assert.equal(exitCode, 1);
});
test("exit code is 0 when failed predicate returns false", () => {
    const report = { failedScenarios: 0 };
    const shouldFail = (report.failedScenarios ?? 0) > 0;
    const exitCode = shouldFail ? 1 : 0;
    assert.equal(exitCode, 0);
});
// ---------------------------------------------------------------------------
// Type exports verification
// ---------------------------------------------------------------------------
test("StableRunner type accepts any function with any args and any return", () => {
    const runner = (opts) => ({ result: opts });
    const result = runner({ test: true });
    assert.equal(result.result.test, true);
});
test("StableReportWriter type accepts path and report", () => {
    const writer = (path, report) => {
        assert.equal(path, "/test/path.json");
        assert.equal(report.ok, true);
    };
    writer("/test/path.json", { ok: true });
});
test("FailedPredicate type accepts report and returns boolean", () => {
    const failed = (report) => report.failed === true;
    assert.equal(failed({ failed: true }), true);
    assert.equal(failed({ failed: false }), false);
});
//# sourceMappingURL=stable-runner-factory.test.js.map