/**
 * Unit tests for Directory Structure
 *
 * Verifies that all documented directories exist and export valid modules.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { join } from "node:path";
const SRC_ROOT = join(process.cwd(), "src");
/**
 * Documents the 5 directories that were missing per §35 review.
 * These are now created as namespace wrappers per the architecture doc.
 */
const DOCUMENTED_DIRECTORIES = [
    "platform/cost-management",
    "platform/agent-delegation",
    "platform/prompt-registry",
    "testing",
    "benchmarks",
];
test("§35: All documented directories exist in src/", () => {
    for (const dir of DOCUMENTED_DIRECTORIES) {
        const fullPath = join(SRC_ROOT, dir);
        assert.equal(existsSync(fullPath), true, `Directory ${dir} should exist at ${fullPath}`);
    }
});
test("§35: All documented directories have index.ts", () => {
    for (const dir of DOCUMENTED_DIRECTORIES) {
        const indexPath = join(SRC_ROOT, dir, "index.ts");
        assert.equal(existsSync(indexPath), true, `Directory ${dir} should have index.ts at ${indexPath}`);
    }
});
test("§35: cost-management exports from scale-ecosystem", async () => {
    const mod = await import("../../../../src/platform/cost-management/index.js");
    assert.ok(mod.CostEstimationService != null);
});
test("§35: agent-delegation exports delegation types", async () => {
    const mod = await import("../../../../src/platform/agent-delegation/index.js");
    assert.ok(mod.DelegationManagerService != null);
    assert.ok(mod.TopologyValidator != null);
});
test("§35: prompt-registry exports prompt registry types", async () => {
    const mod = await import("../../../../src/platform/prompt-registry/index.js");
    assert.ok(mod.HierarchicalPromptRegistryService != null);
    assert.ok(mod.PromptVersionManager != null);
});
test("§35: testing exports test utilities", async () => {
    const mod = await import("../../../../src/testing/index.js");
    assert.ok(mod.createTempWorkspace != null);
    assert.ok(mod.cleanupPath != null);
});
test("§35: benchmarks exports benchmark runner", async () => {
    const mod = await import("../../../../src/benchmarks/index.js");
    assert.ok(mod.runBenchmark != null);
    // BenchmarkResult is a type, not a value - we verify it exists via typeof
    assert.ok(typeof mod.BenchmarkResult !== "undefined");
});
test("§35: benchmarks runBenchmark returns valid result", async () => {
    const { runBenchmark } = await import("../../../../src/benchmarks/index.js");
    let callCount = 0;
    const result = await runBenchmark("test-benchmark", () => {
        callCount++;
    }, { iterations: 10 });
    assert.equal(result.name, "test-benchmark");
    assert.equal(result.iterations, 10);
    assert.ok(result.durationMs >= 0);
    assert.ok(result.opsPerSecond >= 0);
    assert.equal(callCount, 10); // warmup (100) + iterations (10) = 110, but we set iterations only
});
//# sourceMappingURL=directory-structure.test.js.map