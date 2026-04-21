/**
 * Performance Benchmarks Module
 *
 * Provides performance benchmarking utilities and benchmark suites.
 *
 * ## Overview
 *
 * This module provides infrastructure for running performance benchmarks
 * to measure latency, throughput, and resource usage.
 *
 * ## Contents
 *
 * - Benchmark runners
 * - Performance measurement utilities
 * - Result aggregation and reporting
 *
 * @see tests/benchmarks/ for actual benchmark implementations
 */
/**
 * Runs a benchmark and returns results.
 */
export async function runBenchmark(name, fn, options = {}) {
    const iterations = options.iterations ?? 1000;
    const warmupIterations = options.warmupIterations ?? 100;
    // Warmup
    for (let i = 0; i < warmupIterations; i++) {
        await fn();
    }
    const start = Date.now();
    for (let i = 0; i < iterations; i++) {
        await fn();
    }
    const durationMs = Date.now() - start;
    return {
        name,
        iterations,
        durationMs,
        avgLatencyMs: durationMs / iterations,
        p50LatencyMs: durationMs / iterations, // Simplified
        p95LatencyMs: durationMs / iterations,
        p99LatencyMs: durationMs / iterations,
        minLatencyMs: durationMs / iterations,
        maxLatencyMs: durationMs / iterations,
        opsPerSecond: (iterations / durationMs) * 1000,
    };
}
//# sourceMappingURL=index.js.map