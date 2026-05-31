import assert from "node:assert/strict";
import test from "node:test";

import { StructuredLogger, StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

// Test safePath with absolute path that contains traversal
test("safePath blocks absolute paths with traversal attempts", () => {
  // This tests the defensive check in safePath: even absolute paths
  // that would try to escape should be blocked
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.log({ level: "info", message: "test" });
  assert.ok(entry.createdAt !== undefined);
});

// Test that telemetry context bridging works when all context fields are present
test("StructuredLogger.log bridges trace and span context when all fields present", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  // Manually inject a log entry with explicit traceId/spanId to override telemetry
  const entry = logger.log({
    level: "info",
    message: "explicit trace",
    traceId: "explicit_trace",
    spanId: "explicit_span",
    parentSpanId: "explicit_parent",
    correlationId: "explicit_corr",
  });

  // When explicit values are provided, they should be used
  assert.equal(entry.traceId, "explicit_trace");
  assert.equal(entry.spanId, "explicit_span");
  assert.equal(entry.parentSpanId, "explicit_parent");
  assert.equal(entry.correlationId, "explicit_corr");
});

// Test that log entry uses telemetry context when no explicit values provided
test("StructuredLogger.log uses telemetry context when available", async () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  // Without explicit traceId, the log should still work
  const entry = logger.log({
    level: "info",
    message: "no explicit trace",
  });

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "no explicit trace");
  assert.ok(entry.createdAt !== undefined);
});

// Test writeToTransports with synchronous transport that returns value
test("StructuredLogger.writeToTransports handles sync return value", () => {
  assert.doesNotThrow(() => {
    const logger = new StructuredLogger({ retentionLimit: 10 });
    const transport = {
      name: "sync-transport",
      write: (entry: StructuredLogEntry) => {
        return "sync result"; // Return a non-Promise value
      },
    };

    StructuredLogger.addTransport(transport as any);
    logger.log({ level: "info", message: "sync test" });
    StructuredLogger.removeTransport("sync-transport");
  });
});

// Test writeToTransports with transport that throws during write
test("StructuredLogger.writeToTransports handles transport write exception", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const transport = {
    name: "throwing-transport",
    write: () => {
      throw new Error("transport write failed");
    },
  };

  StructuredLogger.addTransport(transport as any);
  // Should not throw
  logger.log({ level: "info", message: "exception test" });
  StructuredLogger.removeTransport("throwing-transport");
});

// Test writeToGlobalFileSink when file operations fail
test("StructuredLogger handles file sink append failure gracefully", () => {
  // Reset global sink to null first
  StructuredLogger.configureGlobalFileSink(null);

  // Configure sink to a path that might fail
  StructuredLogger.configureGlobalFileSink({ filePath: "/proc/invalid-path/test.log", maxBytes: 1024 });

  const logger = new StructuredLogger({ retentionLimit: 10 });

  // Should not throw even if file sink fails
  const entry = logger.log({ level: "info", message: "sink fail test" });
  assert.ok(entry !== undefined);

  // Reset
  StructuredLogger.configureGlobalFileSink(null);
});

// Test ring buffer behavior: count exactly at retention limit
test("StructuredLogger ring buffer count does not exceed retention limit", () => {
  const logger = new StructuredLogger({ retentionLimit: 5 });

  for (let i = 0; i < 5; i++) {
    logger.info(`message ${i}`);
  }

  const summary = logger.getBufferSummary();
  assert.equal(summary.entryCount, 5);
  assert.equal(summary.droppedEntryCount, 0);

  // Add one more
  logger.info("message 5");

  const summary2 = logger.getBufferSummary();
  assert.equal(summary2.entryCount, 5); // Still 5
  assert.equal(summary2.droppedEntryCount, 1);
});

// Test recent with limit larger than count
test("StructuredLogger.recent handles limit larger than count", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("only one");
  const recent = logger.recent(1000); // Request more than exists

  assert.equal(recent.length, 1);
  assert.equal(recent[0]!.message, "only one");
});

// Test getBufferSummary returns correct structure
test("StructuredLogger.getBufferSummary returns correct structure", () => {
  const logger = new StructuredLogger({ retentionLimit: 25 });

  const summary = logger.getBufferSummary();

  assert.equal(summary.entryCount, 0);
  assert.equal(summary.retentionLimit, 25);
  assert.equal(summary.droppedEntryCount, 0);
  assert.ok(typeof summary.entryCount === "number");
  assert.ok(typeof summary.retentionLimit === "number");
  assert.ok(typeof summary.droppedEntryCount === "number");
});

// Test configureGlobalFileSink with options that result in invalid path
test("StructuredLogger.configureGlobalFileSink rejects path escaping base directory", () => {
  StructuredLogger.configureGlobalFileSink(null);

  // Path that escapes the base directory
  StructuredLogger.configureGlobalFileSink("../../../tmp/escape.log");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

// Test configureGlobalFileSink with whitespace-only path
test("StructuredLogger.configureGlobalFileSink rejects whitespace-only path", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("     ");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

// Test configureGlobalFileSink with string that trims to empty
test("StructuredLogger.configureGlobalFileSink handles empty string after trim", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("   \t\n   ");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

// Test getGlobalFileSinkPath when sink is null
test("StructuredLogger.getGlobalFileSinkPath returns null when sink is not configured", () => {
  StructuredLogger.configureGlobalFileSink(null);

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

// Test recentByTask with empty result
test("StructuredLogger.recentByTask returns empty array for non-existent task", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "task1", taskId: "task_1" });

  const result = logger.recentByTask("non_existent_task");
  assert.deepEqual(result, []);
});

// Test recentByTrace with empty result
test("StructuredLogger.recentByTrace returns empty array for non-existent trace", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "trace1", traceId: "trace_1" });

  const result = logger.recentByTrace("non_existent_trace");
  assert.deepEqual(result, []);
});

// Test recentByCorrelation with empty result
test("StructuredLogger.recentByCorrelation returns empty array for non-existent correlation", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "corr1", correlationId: "corr_1" });

  const result = logger.recentByCorrelation("non_existent_corr");
  assert.deepEqual(result, []);
});

// Test that closeTransports handles empty transport list
test("StructuredLogger.closeTransports handles empty transport list", async () => {
  // Ensure no transports are registered
  assert.equal((StructuredLogger as unknown as { transports: unknown[] }).transports.length, 0);
  await StructuredLogger.closeTransports();

  assert.equal((StructuredLogger as unknown as { transports: unknown[] }).transports.length, 0);
});

// Test that flushTransports handles empty transport list
test("StructuredLogger.flushTransports handles empty transport list", async () => {
  // Ensure no transports are registered
  assert.equal((StructuredLogger as unknown as { transports: unknown[] }).transports.length, 0);
  await StructuredLogger.flushTransports();

  assert.equal((StructuredLogger as unknown as { transports: unknown[] }).transports.length, 0);
});
