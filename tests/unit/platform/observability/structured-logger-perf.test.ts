/**
 * @fileoverview [SYS-PERF-3.1] StructuredLogger Performance Tests
 *
 * Regression tests for SYS-PERF-3.1: StructuredLogger sync I/O blocking
 *
 * The structured-logger.ts uses appendFileSync which blocks the event loop.
 * Log writes must complete in < 1ms average to avoid blocking.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, unlinkSync, existsSync } from "node:fs";
import { join } from "node:path";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";

import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";

test("[SYS-PERF-3.1] log write does not block event loop > 1ms", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "structured-logger-perf-"));

  try {
    const logFile = join(tempDir, "test.log");

    // Configure global file sink
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 1024 * 1024, // 1MB
      maxFiles: 3,
    });

    const logger = new StructuredLogger({ retentionLimit: 100 });

    const iterations = 100;
    const latencies: number[] = [];

    // Warm-up
    for (let i = 0; i < 5; i++) {
      logger.info(`warmup-${i}`, { step: i });
    }

    // Measure latency for each log write
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();

      logger.info(`test-log-${i}`, {
        iteration: i,
        data: { key: "value", number: i },
        extra: "this is extra data to make the log entry larger",
      });

      const end = process.hrtime.bigint();
      const latencyNs = Number(end - start);
      const latencyMs = latencyNs / 1_000_000;
      latencies.push(latencyMs);
    }

    // Flush transports
    await StructuredLogger.flushTransports();

    // Calculate average latency
    const totalLatency = latencies.reduce((sum, lat) => sum + lat, 0);
    const avgLatency = totalLatency / latencies.length;

    // Calculate max latency
    const maxLatency = Math.max(...latencies);

    // Calculate percentiles
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] ?? 0;
    const p99 = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] ?? 0;

    // Clean up global file sink
    StructuredLogger.configureGlobalFileSink(null);

    // Log performance metrics for debugging
    console.log(`[SYS-PERF-3.1] Log write performance:`);
    console.log(`  Iterations: ${iterations}`);
    console.log(`  Average latency: ${avgLatency.toFixed(3)}ms`);
    console.log(`  Max latency: ${maxLatency.toFixed(3)}ms`);
    console.log(`  P50 latency: ${p50.toFixed(3)}ms`);
    console.log(`  P99 latency: ${p99.toFixed(3)}ms`);

    // The critical assertion: average must be < 1ms
    // This catches the bug where appendFileSync blocks the event loop
    assert.ok(
      avgLatency < 1.0,
      `Average log write latency must be < 1ms to avoid blocking event loop. Got: ${avgLatency.toFixed(3)}ms`,
    );

  } finally {
    // Clean up
    StructuredLogger.configureGlobalFileSink(null);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("[SYS-PERF-3.1] individual log write completes in reasonable time", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "structured-logger-single-"));

  try {
    const logFile = join(tempDir, "single-test.log");

    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 1024 * 1024,
      maxFiles: 2,
    });

    const logger = new StructuredLogger({ retentionLimit: 50 });

    // Single write timing
    const start = process.hrtime.bigint();
    logger.info("single-write-test", { data: "test" });
    const end = process.hrtime.bigint();

    const latencyMs = Number(end - start) / 1_000_000;

    await StructuredLogger.flushTransports();
    StructuredLogger.configureGlobalFileSink(null);

    // Single write should complete quickly
    assert.ok(
      latencyMs < 10,
      `Single log write should complete in < 10ms, got ${latencyMs.toFixed(3)}ms`,
    );

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("[SYS-PERF-3.1] concurrent log writes don't block excessively", async () => {
  const tempDir = await mkdtemp(join(tmpdir(), "structured-logger-concurrent-"));

  try {
    const logFile = join(tempDir, "concurrent-test.log");

    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 10 * 1024 * 1024, // 10MB to avoid rotation
      maxFiles: 2,
    });

    const logger = new StructuredLogger({ retentionLimit: 200 });
    const iterations = 50;

    const start = process.hrtime.bigint();

    // Simulate concurrent writes (in practice these are serialized through the ring buffer)
    for (let i = 0; i < iterations; i++) {
      logger.info(`concurrent-log-${i}`, { iteration: i });
    }

    const end = process.hrtime.bigint();
    const totalLatencyMs = Number(end - start) / 1_000_000;
    const avgLatencyPerWrite = totalLatencyMs / iterations;

    await StructuredLogger.flushTransports();
    StructuredLogger.configureGlobalFileSink(null);

    console.log(`[SYS-PERF-3.1] Concurrent writes: ${iterations} iterations in ${totalLatencyMs.toFixed(3)}ms total, avg ${avgLatencyPerWrite.toFixed(3)}ms per write`);

    // With proper async I/O, average should be very low
    assert.ok(
      avgLatencyPerWrite < 1.0,
      `Average per-write latency should be < 1ms with async I/O. Got: ${avgLatencyPerWrite.toFixed(3)}ms`,
    );

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("[SYS-PERF-3.1] file sink uses async appendFile not sync", async () => {
  // This test verifies the implementation uses async I/O for file writes
  // by checking the actual implementation doesn't use appendFileSync

  // We can't directly test implementation here, but we can verify the behavior:
  // if appendFileSync is used, it will block and we can measure it

  const tempDir = await mkdtemp(join(tmpdir(), "structured-logger-sync-check-"));

  try {
    const logFile = join(tempDir, "sync-check.log");

    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 1024 * 1024,
      maxFiles: 2,
    });

    const logger = new StructuredLogger({ retentionLimit: 50 });

    // Do several writes and measure if any single write takes > 5ms
    // (sync I/O would typically take 1-5ms per write)
    let maxLatency = 0;

    for (let i = 0; i < 20; i++) {
      const start = process.hrtime.bigint();
      logger.info(`sync-check-${i}`, { data: i });
      const end = process.hrtime.bigint();

      const latencyMs = Number(end - start) / 1_000_000;
      maxLatency = Math.max(maxLatency, latencyMs);
    }

    await StructuredLogger.flushTransports();
    StructuredLogger.configureGlobalFileSink(null);

    // If sync I/O is being used, max latency would be > 5ms regularly
    // With async I/O, max latency should be < 5ms
    console.log(`[SYS-PERF-3.1] Max write latency: ${maxLatency.toFixed(3)}ms`);

    assert.ok(
      maxLatency < 5.0,
      `Max write latency should be < 5ms (indicating async I/O). Got: ${maxLatency.toFixed(3)}ms`,
    );

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    await rm(tempDir, { recursive: true, force: true });
  }
});

test("[SYS-PERF-3.1] ring buffer insertion is O(1)", async () => {
  // Verify that ring buffer insertion doesn't slow down with more entries
  const tempDir = await mkdtemp(join(tmpdir(), "structured-logger-ring-"));

  try {
    const logFile = join(tempDir, "ring-test.log");

    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 1024 * 1024,
      maxFiles: 2,
    });

    // Small retention limit = faster ring buffer
    const smallLogger = new StructuredLogger({ retentionLimit: 10 });
    const largeLogger = new StructuredLogger({ retentionLimit: 1000 });

    // Measure insertion time with empty buffer
    const smallStart = process.hrtime.bigint();
    for (let i = 0; i < 10; i++) {
      smallLogger.info(`small-${i}`);
    }
    const smallEnd = process.hrtime.bigint();
    const smallTotalMs = Number(smallEnd - smallStart) / 1_000_000;

    // Measure with buffer at capacity
    for (let i = 0; i < 1000; i++) {
      largeLogger.info(`large-fill-${i}`);
    }

    const largeStart = process.hrtime.bigint();
    for (let i = 0; i < 10; i++) {
      largeLogger.info(`large-${i}`);
    }
    const largeEnd = process.hrtime.bigint();
    const largeTotalMs = Number(largeEnd - largeStart) / 1_000_000;

    await StructuredLogger.flushTransports();
    StructuredLogger.configureGlobalFileSink(null);

    // Both should take roughly the same time since ring buffer is O(1)
    // Large buffer might be slightly slower due to memory pressure
    const ratio = largeTotalMs / smallTotalMs;

    console.log(`[SYS-PERF-3.1] Ring buffer performance: small=${smallTotalMs.toFixed(3)}ms, large=${largeTotalMs.toFixed(3)}ms, ratio=${ratio.toFixed(2)}`);

    // Ring buffer insertion should be O(1), so ratio should be close to 1
    assert.ok(
      ratio < 5,
      `Large buffer should not be significantly slower. Ratio: ${ratio.toFixed(2)}`,
    );

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    await rm(tempDir, { recursive: true, force: true });
  }
});
