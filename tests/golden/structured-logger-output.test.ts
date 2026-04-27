/**
 * Golden Test: Structured Logger Output Format
 *
 * Verifies structured logger produces consistent JSON output format
 * with all required fields for log entries.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { StructuredLogger, type StructuredLogEntry } from "../../src/platform/shared/observability/structured-logger.js";

test("golden: structured logger produces valid log entry format", () => {
  const logger = new StructuredLogger({ retentionLimit: 100, service: "test-service" });

  const entry = logger.info("Test message", { key: "value" });

  // Verify required fields
  assert.ok(entry, "Entry should be returned");
  assert.equal(entry.level, "info", "Level should be info");
  assert.equal(entry.message, "Test message", "Message should match");
  assert.ok(entry.timestamp, "Should have timestamp");
  assert.ok(entry.service, "Should have service");
  assert.equal(entry.service, "test-service", "Service should match");

  // Verify data payload
  assert.ok(entry.data, "Should have data");
  assert.deepEqual(entry.data, { key: "value" }, "Data should match input");
});

test("golden: structured logger entry has correct JSON structure", () => {
  const logger = new StructuredLogger({ retentionLimit: 50, service: "json-test" });

  const entry = logger.log({
    level: "error",
    message: "Error occurred",
    taskId: "task-123",
    traceId: "trace-456",
    data: { errorCode: "TEST_ERROR" },
  });

  // Verify JSON serialization works
  const json = JSON.stringify(entry);
  assert.ok(json.length > 0, "Should serialize to JSON");

  const parsed = JSON.parse(json);
  assert.equal(parsed.level, "error");
  assert.equal(parsed.message, "Error occurred");
  assert.equal(parsed.taskId, "task-123");
  assert.equal(parsed.traceId, "trace-456");
  assert.equal(parsed.data.errorCode, "TEST_ERROR");
});

test("golden: structured logger ring buffer maintains order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  for (let i = 1; i <= 5; i++) {
    logger.info(`Message ${i}`, { index: i });
  }

  const recent = logger.recent(5);

  assert.equal(recent.length, 5, "Should have 5 entries");
  assert.ok(recent.every((e) => e.level === "info"), "All should be info level");

  // Verify chronological order (oldest first)
  for (let i = 0; i < recent.length - 1; i++) {
    const current = new Date(recent[i].timestamp).getTime();
    const next = new Date(recent[i + 1].timestamp).getTime();
    assert.ok(current <= next, "Entries should be in chronological order");
  }
});

test("golden: structured logger buffer summary format", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("First");
  logger.warn("Second");
  logger.error("Third");

  const summary = logger.getBufferSummary();

  assert.ok(summary, "Summary should exist");
  assert.ok(typeof summary.entryCount === "number", "entryCount should be number");
  assert.ok(typeof summary.retentionLimit === "number", "retentionLimit should be number");
  assert.ok(typeof summary.droppedEntryCount === "number", "droppedEntryCount should be number");
  assert.equal(summary.retentionLimit, 100, "Retention limit should match");
  assert.ok(summary.entryCount >= 3, "Should have at least 3 entries");
});

test("golden: structured logger filters by task ID", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("Task 1 log", { taskId: "task-1" });
  logger.info("Task 2 log", { taskId: "task-2" });
  logger.info("Another task 1", { taskId: "task-1" });

  const task1Logs = logger.recentByTask("task-1", 10);
  const task2Logs = logger.recentByTask("task-2", 10);

  assert.equal(task1Logs.length, 2, "Task 1 should have 2 logs");
  assert.equal(task2Logs.length, 1, "Task 2 should have 1 log");
  assert.ok(task1Logs.every((e) => e.taskId === "task-1"), "All should be task-1");
});

test("golden: structured logger filters by trace ID", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("Trace A log", { traceId: "trace-a" });
  logger.info("Trace B log", { traceId: "trace-b" });
  logger.info("Another trace A", { traceId: "trace-a" });

  const traceALogs = logger.recentByTrace("trace-a", 10);
  const traceBLogs = logger.recentByTrace("trace-b", 10);

  assert.equal(traceALogs.length, 2, "Trace A should have 2 logs");
  assert.equal(traceBLogs.length, 1, "Trace B should have 1 log");
});

test("golden: structured logger log levels are correct", () => {
  const logger = new StructuredLogger({ retentionLimit: 50 });

  const debugEntry = logger.debug("Debug test");
  const infoEntry = logger.info("Info test");
  const warnEntry = logger.warn("Warn test");
  const errorEntry = logger.error("Error test");
  const fatalEntry = logger.fatal("Fatal test");

  assert.equal(debugEntry.level, "debug");
  assert.equal(infoEntry.level, "info");
  assert.equal(warnEntry.level, "warn");
  assert.equal(errorEntry.level, "error");
  assert.equal(fatalEntry.level, "fatal");
});

test("golden: structured logger plane inference", () => {
  const loggerP1 = new StructuredLogger({ planeSourceFile: "/path/to/platform/interface/api/index.ts" });
  const loggerP4 = new StructuredLogger({ planeSourceFile: "/path/to/platform/execution/dispatcher/index.ts" });
  const loggerUnknown = new StructuredLogger({});

  assert.equal(loggerP1.plane, "P1", "Interface layer should be P1");
  assert.equal(loggerP4.plane, "P4", "Execution layer should be P4");
  assert.equal(loggerUnknown.plane, "X1", "Unknown should default to X1");
});
