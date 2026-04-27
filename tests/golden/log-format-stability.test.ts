/**
 * Golden Test: Log Format Stability
 *
 * Verifies log output maintains consistent format across different
 * log levels, services, and task contexts.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { StructuredLogger, type StructuredLogEntry } from "../../src/platform/shared/observability/structured-logger.js";

test("golden: log entry JSON contains all required fields", () => {
  const logger = new StructuredLogger({ service: "format-test" });

  const entry = logger.info("Test message", { key: "value" });

  // Parse JSON and verify all fields
  const json = JSON.stringify(entry);
  const parsed = JSON.parse(json);

  assert.ok(parsed.timestamp, "Should have timestamp");
  assert.ok(parsed.level, "Should have level");
  assert.ok(parsed.message, "Should have message");
  assert.ok(parsed.service, "Should have service");
  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "Test message");
});

test("golden: log entry includes plane when specified", () => {
  const logger = new StructuredLogger({ plane: "P4", service: "plane-test" });

  const entry = logger.info("Plane test");

  assert.ok(entry.plane, "Should have plane");
  assert.equal(entry.plane, "P4", "Plane should be P4");
});

test("golden: log entry formats data payload correctly", () => {
  const logger = new StructuredLogger({ service: "data-test" });

  const complexData = {
    userId: "user-123",
    items: [1, 2, 3],
    nested: { a: 1, b: 2 },
  };

  const entry = logger.info("Complex data", complexData);

  assert.deepEqual(entry.data, complexData);
  assert.deepEqual(entry.structuredPayload, complexData);
});

test("golden: log entry correlation ID is set correctly", () => {
  const logger = new StructuredLogger({ service: "correlation-test" });

  const entry = logger.info("With correlation", {
    traceId: "trace-abc",
    correlationId: "corr-123",
  });

  assert.ok(entry.correlationId, "Should have correlationId");
  assert.equal(entry.correlationId, "corr-123");
});

test("golden: recent logs preserve original entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const originalEntries: StructuredLogEntry[] = [];
  for (let i = 0; i < 10; i++) {
    const entry = logger.info(`Message ${i}`, { index: i });
    originalEntries.push(entry);
  }

  const recent = logger.recent(10);

  assert.equal(recent.length, 10);
  // Most recent entries should be last in the recent list
  assert.equal(recent[9].message, "Message 9");
});

test("golden: log entries with task ID are filterable", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("Task 1 log A", { taskId: "task-1" });
  logger.info("Task 2 log", { taskId: "task-2" });
  logger.info("Task 1 log B", { taskId: "task-1" });
  logger.info("Task 3 log", { taskId: "task-3" });

  const task1Logs = logger.recentByTask("task-1", 10);

  assert.equal(task1Logs.length, 2);
  assert.ok(task1Logs.every((e) => e.taskId === "task-1"));
});

test("golden: log entries with trace ID are filterable", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("Trace A first", { traceId: "trace-a" });
  logger.info("Trace B", { traceId: "trace-b" });
  logger.info("Trace A second", { traceId: "trace-a" });

  const traceALogs = logger.recentByTrace("trace-a", 10);

  assert.equal(traceALogs.length, 2);
  assert.ok(traceALogs.every((e) => e.traceId === "trace-a"));
});

test("golden: logger clear removes all entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("First");
  logger.info("Second");
  logger.info("Third");

  assert.equal(logger.recent(10).length, 3);

  logger.clear();

  assert.equal(logger.recent(10).length, 0);
});

test("golden: different log levels produce different level values", () => {
  const logger = new StructuredLogger({ service: "level-test" });

  const debugEntry = logger.debug("Debug");
  const infoEntry = logger.info("Info");
  const warnEntry = logger.warn("Warn");
  const errorEntry = logger.error("Error");
  const fatalEntry = logger.fatal("Fatal");

  assert.equal(debugEntry.level, "debug");
  assert.equal(infoEntry.level, "info");
  assert.equal(warnEntry.level, "warn");
  assert.equal(errorEntry.level, "error");
  assert.equal(fatalEntry.level, "fatal");
});

test("golden: log timestamps are ISO 8601 format", () => {
  const logger = new StructuredLogger({ service: "timestamp-test" });

  const entry = logger.info("Timestamp check");

  // ISO 8601 format: 2026-04-26T10:30:00.000Z
  const isoPattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
  assert.ok(isoPattern.test(entry.timestamp), `Timestamp ${entry.timestamp} should match ISO 8601 format`);
});
