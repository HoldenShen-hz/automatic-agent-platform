/**
 * Logger Performance Tests
 *
 * Performance tests for StructuredLogger focusing on:
 * - Log write throughput
 * - Ring buffer operations
 * - File sink performance
 * - Concurrent logging from multiple instances
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

test("[PERF-LOGGER-1] structured logger write throughput - 1000 entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 2000 });

  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    logger.info(`test message ${i}`, { index: i });
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;
  const throughput = 1000 / elapsed * 1000; // entries per second

  assert.ok(avgMs < 1, `Average log write ${avgMs.toFixed(3)}ms must be < 1ms`);
  assert.ok(throughput > 1000, `Throughput ${throughput.toFixed(0)} ops/sec should be > 1000`);
});

test("[PERF-LOGGER-2] structured logger write throughput - 10000 entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 15000 });

  const iterations = 10000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    logger.info(`test message ${i}`, { index: i });
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;
  const throughput = 1000 / elapsed * 1000;

  assert.ok(avgMs < 1, `Average log write ${avgMs.toFixed(3)}ms must be < 1ms`);
  assert.ok(throughput > 5000, `Throughput ${throughput.toFixed(0)} ops/sec should be > 5000`);
});

test("[PERF-LOGGER-3] structured logger recent() performance with large buffer", () => {
  const logger = new StructuredLogger({ retentionLimit: 10000 });

  // Pre-fill buffer
  for (let i = 0; i < 10000; i++) {
    logger.info(`message ${i}`);
  }

  const start = performance.now();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    logger.recent(50);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 1, `Average recent() call ${avgMs.toFixed(3)}ms must be < 1ms`);
});

test("[PERF-LOGGER-4] structured logger filtering performance", () => {
  const logger = new StructuredLogger({ retentionLimit: 5000 });

  // Add entries with different correlation IDs
  for (let i = 0; i < 5000; i++) {
    logger.log({
      level: "info",
      message: `message ${i}`,
      correlationId: `corr-${i % 100}`, // 100 different correlations
      taskId: `task-${i % 50}`, // 50 different tasks
    });
  }

  const start = performance.now();
  const iterations = 50;

  for (let i = 0; i < iterations; i++) {
    logger.recentByCorrelation(`corr-${i % 100}`);
    logger.recentByTask(`task-${i % 50}`);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 5, `Average filtering operation ${avgMs.toFixed(3)}ms must be < 5ms`);
});

test("[PERF-LOGGER-5] multiple logger instances concurrent writes", () => {
  const loggerCount = 5;
  const entriesPerLogger = 500;
  const loggers: StructuredLogger[] = [];

  for (let i = 0; i < loggerCount; i++) {
    loggers.push(new StructuredLogger({ retentionLimit: 1000 }));
  }

  const start = performance.now();

  for (let i = 0; i < entriesPerLogger; i++) {
    for (const logger of loggers) {
      logger.info(`message-${i}`);
    }
  }

  const elapsed = performance.now() - start;
  const totalEntries = loggerCount * entriesPerLogger;
  const throughput = totalEntries / elapsed * 1000;

  assert.ok(throughput > 2000, `Concurrent throughput ${throughput.toFixed(0)} ops/sec should be > 2000`);
});

test("[PERF-LOGGER-6] structured logger ring buffer wrap performance", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  // Pre-fill
  for (let i = 0; i < 100; i++) {
    logger.info(`initial ${i}`);
  }

  const start = performance.now();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    logger.info(`wrapped ${i}`);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 0.5, `Average wrap operation ${avgMs.toFixed(3)}ms must be < 0.5ms`);
});

test("[PERF-LOGGER-7] structured logger level filtering overhead", () => {
  const logger = new StructuredLogger({
    retentionLimit: 5000,
    minLogLevel: "warn",
  });

  const start = performance.now();
  const iterations = 5000;

  // These should be filtered out
  for (let i = 0; i < iterations; i++) {
    logger.debug(`debug ${i}`);
    logger.info(`info ${i}`);
  }

  // These should pass
  for (let i = 0; i < iterations; i++) {
    logger.warn(`warn ${i}`);
    logger.error(`error ${i}`);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / (iterations * 4);

  assert.ok(avgMs < 0.2, `Average filtered write ${avgMs.toFixed(3)}ms must be < 0.2ms`);
});

test("[PERF-LOGGER-8] structured logger clear() performance", () => {
  const logger = new StructuredLogger({ retentionLimit: 5000 });

  // Pre-fill
  for (let i = 0; i < 5000; i++) {
    logger.info(`message ${i}`);
  }

  const start = performance.now();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    logger.clear();
    // Re-fill to test clear overhead
    for (let j = 0; j < 100; j++) {
      logger.info(`message ${j}`);
    }
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 5, `Average clear cycle ${avgMs.toFixed(3)}ms must be < 5ms`);
});

test("[PERF-LOGGER-9] structured logger getBufferSummary performance", () => {
  const logger = new StructuredLogger({ retentionLimit: 5000 });

  // Pre-fill
  for (let i = 0; i < 5000; i++) {
    logger.info(`message ${i}`);
  }

  const start = performance.now();
  const iterations = 10000;

  for (let i = 0; i < iterations; i++) {
    logger.getBufferSummary();
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 0.1, `Average getBufferSummary ${avgMs.toFixed(3)}ms must be < 0.1ms`);
});

test("[PERF-LOGGER-10] structured logger with global file sink performance", () => {
  const workspace = createTempWorkspace("aa-perf-logger-");
  const logFile = join(workspace, "perf.log");

  try {
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: null, // No rotation for this test
    });

    const logger = new StructuredLogger({ retentionLimit: 1000 });

    const iterations = 500;
    const start = performance.now();

    for (let i = 0; i < iterations; i++) {
      logger.info(`test message ${i}`);
    }

    const elapsed = performance.now() - start;
    const avgMs = elapsed / iterations;
    const throughput = 1000 / elapsed * 1000;

    // With file sink, writes are async but still have overhead
    assert.ok(avgMs < 2, `Average log write with file sink ${avgMs.toFixed(3)}ms must be < 2ms`);
    assert.ok(throughput > 500, `Throughput ${throughput.toFixed(0)} ops/sec should be > 500`);

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    cleanupPath(workspace);
  }
});

test("[PERF-LOGGER-11] structured logger initialization overhead", () => {
  const start = performance.now();
  const iterations = 100;

  for (let i = 0; i < iterations; i++) {
    new StructuredLogger({ retentionLimit: 500 });
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 1, `Average logger initialization ${avgMs.toFixed(3)}ms must be < 1ms`);
});

test("[PERF-LOGGER-12] structured logger data extraction overhead", () => {
  const logger = new StructuredLogger({ retentionLimit: 1000 });

  const complexData = {
    level1: {
      level2: {
        level3: {
          value: "deep",
          array: [1, 2, 3, 4, 5],
        },
      },
    },
    metadata: {
      timestamp: Date.now(),
      source: "test",
    },
  };

  const start = performance.now();
  const iterations = 1000;

  for (let i = 0; i < iterations; i++) {
    logger.log({
      level: "info",
      message: `test ${i}`,
      data: complexData,
    });
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 1, `Average log with complex data ${avgMs.toFixed(3)}ms must be < 1ms`);
});

test("[PERF-LOGGER-13] structured logger concurrent writes from multiple instances with shared sink", () => {
  const workspace = createTempWorkspace("aa-concurrent-perf-");
  const logFile = join(workspace, "concurrent.log");

  try {
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: null,
    });

    const loggerCount = 3;
    const entriesPerLogger = 200;
    const loggers: StructuredLogger[] = [];

    for (let i = 0; i < loggerCount; i++) {
      loggers.push(new StructuredLogger({ retentionLimit: 500 }));
    }

    const start = performance.now();

    // Concurrent-like: interleave writes
    for (let i = 0; i < entriesPerLogger; i++) {
      for (let j = 0; j < loggerCount; j++) {
        loggers[j].info(`message-${i}-from-${j}`);
      }
    }

    const elapsed = performance.now() - start;
    const totalEntries = loggerCount * entriesPerLogger;
    const throughput = totalEntries / elapsed * 1000;

    assert.ok(throughput > 1000, `Interleaved concurrent throughput ${throughput.toFixed(0)} ops/sec should be > 1000`);

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    cleanupPath(workspace);
  }
});

test("[PERF-LOGGER-14] structured logger transport pipeline overhead", () => {
  let receivedCount = 0;
  const transport = {
    name: "perf-transport",
    write: () => {
      receivedCount++;
    },
  };

  StructuredLogger.addTransport(transport as any);

  const logger = new StructuredLogger({ retentionLimit: 1000 });

  const iterations = 1000;
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    logger.info(`message ${i}`);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;
  const throughput = 1000 / elapsed * 1000;

  assert.ok(avgMs < 1, `Average log with transport ${avgMs.toFixed(3)}ms must be < 1ms`);
  assert.ok(receivedCount === iterations, `Transport should receive all ${iterations} entries`);

  StructuredLogger.removeTransport("perf-transport");
});

test("[PERF-LOGGER-15] structured logger recentByTask scaling", () => {
  const logger = new StructuredLogger({ retentionLimit: 10000 });

  // Add entries for many tasks
  const taskCount = 100;
  const entriesPerTask = 100;

  for (let t = 0; t < taskCount; t++) {
    for (let e = 0; e < entriesPerTask; e++) {
      logger.log({
        level: "info",
        message: `task-${t}-entry-${e}`,
        taskId: `task-${t}`,
      });
    }
  }

  const start = performance.now();
  const iterations = 50;

  for (let i = 0; i < iterations; i++) {
    logger.recentByTask("task-50", 20);
  }

  const elapsed = performance.now() - start;
  const avgMs = elapsed / iterations;

  assert.ok(avgMs < 5, `Average recentByTask ${avgMs.toFixed(3)}ms must be < 5ms for 10k buffer`);
});
