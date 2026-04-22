/**
 * [SYS-PERF-3.1] StructuredLogger Synchronous I/O Blocking Event Loop Tests
 *
 * Tests to verify that the StructuredLogger does not block the event loop
 * for more than 1ms per write.
 *
 * Defect: structured-logger.ts:295 uses appendFileSync which blocks the
 * event loop synchronously on every log write.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, mkdirSync } from "node:fs";

import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { cleanupPath } from "../../../helpers/fs.js";

function createRelativeWorkspace(prefix: string): string {
  const workspace = join(
    ".tmp",
    `${prefix}${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}`,
  );
  mkdirSync(workspace, { recursive: true });
  return workspace;
}

test("[SYS-PERF-3.1] structured logger write does not block event loop > 1ms", () => {
  const workspace = createRelativeWorkspace("aa-logger-blocking-");

  try {
    const logFilePath = join(workspace, "test.log");
    StructuredLogger.configureGlobalFileSink({ filePath: logFilePath, maxBytes: 10 * 1024 * 1024, maxFiles: 3 });

    const logger = new StructuredLogger({ retentionLimit: 1000 });

    const iterations = 100;
    const measurements: number[] = [];

    // Warmup
    for (let i = 0; i < 10; i++) {
      logger.info(`warmup message ${i}`);
    }

    // Measure each write time
    for (let i = 0; i < iterations; i++) {
      const start = performance.now();
      logger.info(`test message ${i}`, { iteration: i });
      const elapsed = performance.now() - start;
      measurements.push(elapsed);
    }

    // Calculate statistics
    const total = measurements.reduce((a, b) => a + b, 0);
    const avgMs = total / iterations;
    const maxMs = Math.max(...measurements);
    const minMs = Math.min(...measurements);

    // Sort for percentile
    const sorted = [...measurements].sort((a, b) => a - b);
    const p95Ms = sorted[Math.floor(sorted.length * 0.95)]!;
    const p99Ms = sorted[Math.floor(sorted.length * 0.99)]!;

    // Assert average is under 1ms
    assert.ok(
      avgMs < 1,
      `Average log write ${avgMs.toFixed(3)}ms must be < 1ms. Defect: appendFileSync blocks event loop. Max: ${maxMs.toFixed(3)}ms, P95: ${p95Ms.toFixed(3)}ms`,
    );

    // P99 should be under 5ms (allow some variance)
    assert.ok(
      p99Ms < 5,
      `P99 log write ${p99Ms.toFixed(3)}ms must be < 5ms. Defect: synchronous I/O blocks event loop.`,
    );

    StructuredLogger.configureGlobalFileSink(null);
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-PERF-3.1] logger does not block during high-frequency writes", () => {
  const workspace = createRelativeWorkspace("aa-logger-highfreq-");

  try {
    const logFilePath = join(workspace, "highfreq.log");
    StructuredLogger.configureGlobalFileSink({ filePath: logFilePath, maxBytes: 50 * 1024 * 1024, maxFiles: 5 });

    const logger = new StructuredLogger({ retentionLimit: 2000 });

    // Simulate high-frequency logging scenario
    const batchSize = 500;
    const batches = 5;

    const allTimings: number[] = [];

    for (let batch = 0; batch < batches; batch++) {
      const batchStart = performance.now();
      for (let i = 0; i < batchSize; i++) {
        const start = performance.now();
        logger.info(`batch-${batch}-msg-${i}`, { batch, index: i });
        const elapsed = performance.now() - start;
        allTimings.push(elapsed);
      }
      const batchElapsed = performance.now() - batchStart;
      const avgPerMsg = batchElapsed / batchSize;
      assert.ok(
        avgPerMsg < 1,
        `Batch ${batch} average ${avgPerMsg.toFixed(3)}ms per message must be < 1ms`,
      );
    }

    // Overall average
    const overallAvg = allTimings.reduce((a, b) => a + b, 0) / allTimings.length;
    const overallP99 = [...allTimings].sort((a, b) => a - b)[Math.floor(allTimings.length * 0.99)]!;

    assert.ok(
      overallAvg < 0.5,
      `Overall average ${overallAvg.toFixed(3)}ms must be < 0.5ms`,
    );

    assert.ok(
      overallP99 < 5,
      `Overall P99 ${overallP99.toFixed(3)}ms must be < 5ms`,
    );

    StructuredLogger.configureGlobalFileSink(null);
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-PERF-3.1] structured logger in-memory buffer is not affected by file sink", () => {
  const workspace = createRelativeWorkspace("aa-logger-memory-");

  try {
    const logFilePath = join(workspace, "memory.log");
    StructuredLogger.configureGlobalFileSink({ filePath: logFilePath, maxBytes: 10 * 1024 * 1024, maxFiles: 2 });

    const logger = new StructuredLogger({ retentionLimit: 100 });

    // Write some logs
    for (let i = 0; i < 50; i++) {
      logger.info(`message ${i}`);
    }

    // Verify in-memory buffer works
    const recent = logger.recent(10);
    assert.equal(recent.length, 10, "Should have 10 recent entries in buffer");

    // File sink should also have entries
    assert.ok(existsSync(logFilePath), "Log file should exist");

    StructuredLogger.configureGlobalFileSink(null);
  } finally {
    cleanupPath(workspace);
  }
});

test("[SYS-PERF-3.1] concurrent logger writes do not block each other excessively", () => {
  const workspace = createRelativeWorkspace("aa-logger-concurrent-");

  try {
    const logFilePath = join(workspace, "concurrent.log");
    StructuredLogger.configureGlobalFileSink({ filePath: logFilePath, maxBytes: 20 * 1024 * 1024, maxFiles: 3 });

    const logger = new StructuredLogger({ retentionLimit: 500 });

    const concurrentWrites = 10;
    const writesPerThread = 100;
    const allTimings: number[] = [];

    // Simulate concurrent writes from multiple "threads" (using sequential loop)
    const runWrites = (threadId: number) => {
      for (let i = 0; i < writesPerThread; i++) {
        const start = performance.now();
        logger.info(`thread-${threadId}-msg-${i}`, { threadId, index: i });
        const elapsed = performance.now() - start;
        allTimings.push(elapsed);
      }
    };

    // Run all threads sequentially (blocking loop)
    const startTime = performance.now();
    for (let i = 0; i < concurrentWrites; i++) {
      runWrites(i);
    }
    const totalTime = performance.now() - startTime;

    const totalMessages = concurrentWrites * writesPerThread;
    const avgPerMessage = totalTime / totalMessages;
    const maxTiming = Math.max(...allTimings);
    const p99Timing = [...allTimings].sort((a, b) => a - b)[Math.floor(allTimings.length * 0.99)]!;

    assert.ok(
      avgPerMessage < 1,
      `Average per message ${avgPerMessage.toFixed(3)}ms must be < 1ms. Defect: appendFileSync blocks event loop.`,
    );

    assert.ok(
      maxTiming < 10,
      `Max timing ${maxTiming.toFixed(3)}ms should be < 10ms even with contention`,
    );

    // P99 should be reasonable
    assert.ok(
      p99Timing < 5,
      `P99 timing ${p99Timing.toFixed(3)}ms must be < 5ms`,
    );

    StructuredLogger.configureGlobalFileSink(null);
  } finally {
    cleanupPath(workspace);
  }
});
