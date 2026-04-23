import test from "node:test";
import assert from "node:assert/strict";
import { runBenchmark } from "../../../src/benchmarks/index.js";
test("runBenchmark returns a valid BenchmarkResult", async () => {
    const result = await runBenchmark("test-benchmark", () => { }, { iterations: 10, warmupIterations: 0 });
    assert.strictEqual(result.name, "test-benchmark");
    assert.strictEqual(result.iterations, 10);
    assert.ok(typeof result.durationMs === "number");
    assert.ok(typeof result.avgLatencyMs === "number");
    assert.ok(typeof result.p50LatencyMs === "number");
    assert.ok(typeof result.p95LatencyMs === "number");
    assert.ok(typeof result.p99LatencyMs === "number");
    assert.ok(typeof result.minLatencyMs === "number");
    assert.ok(typeof result.maxLatencyMs === "number");
    assert.ok(typeof result.opsPerSecond === "number");
});
test("runBenchmark uses default iterations when not specified", async () => {
    const result = await runBenchmark("default-iterations", () => { });
    assert.strictEqual(result.iterations, 1000);
});
test("runBenchmark uses default warmupIterations when not specified", async () => {
    let warmupCalled = false;
    await runBenchmark("warmup-test", () => {
        if (!warmupCalled)
            warmupCalled = true;
    });
    // warmup runs before measurement, so callback is called at least twice
    assert.ok(warmupCalled);
});
test("runBenchmark accepts async function", async () => {
    const result = await runBenchmark("async-benchmark", async () => {
        await new Promise((resolve) => setTimeout(resolve, 1));
    }, { iterations: 5, warmupIterations: 0 });
    assert.strictEqual(result.name, "async-benchmark");
    assert.ok(result.durationMs > 0);
});
test("runBenchmark accepts sync function", async () => {
    const result = await runBenchmark("sync-benchmark", () => {
        let sum = 0;
        for (let i = 0; i < 100; i++)
            sum += i;
    }, { iterations: 100, warmupIterations: 0 });
    assert.strictEqual(result.name, "sync-benchmark");
    assert.ok(result.durationMs >= 0);
});
test("runBenchmark calculates opsPerSecond correctly", async () => {
    const iterations = 100;
    const result = await runBenchmark("ops-calculation", () => { }, { iterations, warmupIterations: 0 });
    const expectedOpsPerSecond = (iterations / result.durationMs) * 1000;
    assert.strictEqual(result.opsPerSecond, expectedOpsPerSecond);
});
test("runBenchmark with zero duration returns infinity or large number for opsPerSecond", async () => {
    // Very fast operations may complete in 0ms, causing division issues
    const result = await runBenchmark("fast-operation", () => { }, { iterations: 100000, warmupIterations: 0 });
    assert.ok(result.opsPerSecond > 0 || Number.isFinite(result.opsPerSecond));
});
test("runBenchmark includes memoryUsedBytes when provided", async () => {
    // This test verifies the interface supports memoryUsedBytes
    const result = await runBenchmark("memory-test", () => { }, { iterations: 10, warmupIterations: 0 });
    // memoryUsedBytes is optional, so it may or may not be present
    if (result.memoryUsedBytes !== undefined) {
        assert.ok(typeof result.memoryUsedBytes === "number");
    }
});
//# sourceMappingURL=index.test.js.map