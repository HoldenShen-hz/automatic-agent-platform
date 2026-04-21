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
 * Benchmark result for a single test run.
 */
export interface BenchmarkResult {
    name: string;
    iterations: number;
    durationMs: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    p99LatencyMs: number;
    minLatencyMs: number;
    maxLatencyMs: number;
    opsPerSecond: number;
    memoryUsedBytes?: number;
}
/**
 * Runs a benchmark and returns results.
 */
export declare function runBenchmark(name: string, fn: () => void | Promise<void>, options?: {
    iterations?: number;
    warmupIterations?: number;
}): Promise<BenchmarkResult>;
