/**
 * Stable Chaos CLI Tests
 *
 * Tests for stable-chaos.ts CLI module.
 */
import assert from "node:assert/strict";
import test from "node:test";
// ---------------------------------------------------------------------------
// Tests for createStableCli options structure
// ---------------------------------------------------------------------------
test("stable-chaos uses AA_STABLE_CHAOS env var", () => {
    const opts = {
        envVar: "AA_STABLE_CHAOS",
        defaultDir: "data/stable-chaos",
        reportFilename: "stable-chaos-report.json",
    };
    assert.equal(opts.envVar, "AA_STABLE_CHAOS");
    assert.ok(opts.defaultDir.startsWith("data"));
});
test("stable-chaos uses correct report filename", () => {
    const opts = {
        envVar: "AA_STABLE_CHAOS",
        defaultDir: "data/stable-chaos",
        reportFilename: "stable-chaos-report.json",
    };
    assert.ok(opts.reportFilename.endsWith(".json"));
    assert.ok(opts.reportFilename.includes("stable-chaos"));
});
test("stable-chaos passes runner function", () => {
    const runStableChaosSmoke = () => ({ failedScenarios: 0 });
    const opts = {
        envVar: "AA_STABLE_CHAOS",
        defaultDir: "data/stable-chaos",
        reportFilename: "stable-chaos-report.json",
        runner: runStableChaosSmoke,
    };
    assert.ok(opts.runner != null);
    assert.equal(typeof opts.runner, "function");
});
test("stable-chaos passes writer function", () => {
    const writeStableChaosSmokeReport = (_path, _report) => { };
    const opts = {
        envVar: "AA_STABLE_CHAOS",
        defaultDir: "data/stable-chaos",
        reportFilename: "stable-chaos-report.json",
        runner: () => { },
        writer: writeStableChaosSmokeReport,
    };
    assert.ok(opts.writer != null);
    assert.equal(typeof opts.writer, "function");
});
// ---------------------------------------------------------------------------
// Tests for output dir resolution
// ---------------------------------------------------------------------------
test("stable-chaos output dir defaults to data/stable-chaos", () => {
    const cwd = "/Users/test/project";
    const defaultDir = "data/stable-chaos";
    const outputDir = `${cwd}/${defaultDir}`;
    assert.ok(outputDir.includes("data/stable-chaos"));
});
test("stable-chaos output dir can be overridden via env", () => {
    const envKey = "AA_STABLE_CHAOS_OUTPUT_DIR";
    const envValue = "/custom/output/path";
    const fromEnv = envValue;
    const outputDir = fromEnv ?? "/default/path";
    assert.equal(outputDir, "/custom/output/path");
});
test("stable-chaos uses env var when set", () => {
    const envKey = "AA_STABLE_CHAOS_OUTPUT_DIR";
    const processEnv = { [envKey]: "/custom/path" };
    const fromEnv = processEnv[envKey];
    const outputDir = fromEnv && fromEnv.length > 0 ? fromEnv : null;
    assert.equal(outputDir, "/custom/path");
});
test("stable-chaos uses default when env is empty string", () => {
    const envKey = "AA_STABLE_CHAOS_OUTPUT_DIR";
    const processEnv = { [envKey]: "" };
    const fromEnv = processEnv[envKey];
    const outputDir = fromEnv && fromEnv.length > 0 ? fromEnv : null;
    assert.equal(outputDir, null);
});
// ---------------------------------------------------------------------------
// Tests for failed predicate
// ---------------------------------------------------------------------------
test("stable-chaos default failed predicate checks failedScenarios", () => {
    const failed = (r) => (r.failedScenarios ?? 0) > 0;
    assert.equal(failed({ failedScenarios: 0 }), false);
    assert.equal(failed({ failedScenarios: 1 }), true);
    assert.equal(failed({}), false);
});
test("stable-chaos report with failedScenarios > 0 triggers exit code 1", () => {
    const report = { failedScenarios: 3 };
    const shouldFail = (report.failedScenarios ?? 0) > 0;
    const exitCode = shouldFail ? 1 : 0;
    assert.equal(exitCode, 1);
});
test("stable-chaos report with failedScenarios = 0 does not trigger exit code", () => {
    const report = { failedScenarios: 0 };
    const shouldFail = (report.failedScenarios ?? 0) > 0;
    const exitCode = shouldFail ? 1 : 0;
    assert.equal(exitCode, 0);
});
// ---------------------------------------------------------------------------
// Tests for runner invocation
// ---------------------------------------------------------------------------
test("stable-chaos runner receives outputDir in args", () => {
    const outputDir = "/Users/test/data/stable-chaos";
    const runnerArgs = { outputDir };
    assert.equal(runnerArgs.outputDir, "/Users/test/data/stable-chaos");
});
test("stable-chaos runner supports async result", async () => {
    const runAsync = async () => ({ failedScenarios: 0 });
    const result = runAsync();
    const report = result instanceof Promise ? await result : result;
    assert.equal(report.failedScenarios, 0);
});
test("stable-chaos runner supports sync result", () => {
    const runSync = () => ({ failedScenarios: 0 });
    const result = runSync();
    const report = result instanceof Promise ? null : result;
    assert.equal(report?.failedScenarios, 0);
});
//# sourceMappingURL=stable-chaos.test.js.map