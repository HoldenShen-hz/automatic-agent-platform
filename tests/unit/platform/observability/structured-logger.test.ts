/**
 * @fileoverview StructuredLogger Unit Tests
 *
 * Tests for StructuredLogger class that provides in-memory structured logging
 * with support for filtering by task, trace, and correlation IDs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import {
  StructuredLogger,
  type StructuredLogEntry,
  type StructuredPlane,
} from "../../../../src/platform/shared/observability/structured-logger.js";

// =============================================================================
// StructuredLogger basic operations
// =============================================================================

test("StructuredLogger log creates entry with timestamp", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.log({ level: "info", message: "Test message" });

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "Test message");
  assert.ok(entry.createdAt != null, "Should have createdAt timestamp");
  assert.ok(entry.createdAt.includes("T"), "Timestamp should be ISO format");
});

test("StructuredLogger log includes data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.log({
    level: "info",
    message: "Test with data",
    data: { key: "value", number: 42 },
  });

  assert.deepEqual(entry.data, { key: "value", number: 42 });
});

test("StructuredLogger log accepts optional correlation IDs", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.log({
    level: "info",
    message: "Test with IDs",
    taskId: "task-123",
    agentId: "agent-456",
    sessionId: "session-789",
    traceId: "trace-abc",
    spanId: "span-def",
  });

  assert.equal(entry.taskId, "task-123");
  assert.equal(entry.agentId, "agent-456");
  assert.equal(entry.sessionId, "session-789");
  assert.equal(entry.traceId, "trace-abc");
  assert.equal(entry.spanId, "span-def");
});

test("StructuredLogger uses default retention limit of 500", () => {
  const logger = new StructuredLogger();

  const summary = logger.getBufferSummary();
  assert.equal(summary.retentionLimit, 500);
});

test("StructuredLogger respects custom retention limit", () => {
  const logger = new StructuredLogger({ retentionLimit: 50 });

  const summary = logger.getBufferSummary();
  assert.equal(summary.retentionLimit, 50);
});

// =============================================================================
// Log level convenience methods
// =============================================================================

test("StructuredLogger debug creates debug level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.debug("Debug message");

  assert.equal(entry.level, "debug");
  assert.equal(entry.message, "Debug message");
});

test("StructuredLogger info creates info level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.info("Info message");

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "Info message");
});

test("StructuredLogger warn creates warn level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.warn("Warn message");

  assert.equal(entry.level, "warn");
  assert.equal(entry.message, "Warn message");
});

test("StructuredLogger error creates error level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.error("Error message");

  assert.equal(entry.level, "error");
  assert.equal(entry.message, "Error message");
});

test("StructuredLogger convenience methods include data when provided", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.info("Info with data", { userId: "user-123", action: "login" });

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "Info with data");
  assert.deepEqual(entry.data, { userId: "user-123", action: "login" });
});

// =============================================================================
// Ring buffer behavior
// =============================================================================

test("StructuredLogger ring buffer returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("First");
  logger.info("Second");
  logger.info("Third");

  const recent = logger.recent(3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0]!.message, "First");
  assert.equal(recent[1]!.message, "Second");
  assert.equal(recent[2]!.message, "Third");
});

test("StructuredLogger ring buffer wraps around when full", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });

  logger.info("Message 1");
  logger.info("Message 2");
  logger.info("Message 3");
  logger.info("Message 4"); // Should overwrite first message

  const recent = logger.recent(3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0]!.message, "Message 2");
  assert.equal(recent[1]!.message, "Message 3");
  assert.equal(recent[2]!.message, "Message 4");
});

test("StructuredLogger recent respects limit parameter", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  for (let i = 0; i < 10; i++) {
    logger.info(`Message ${i}`);
  }

  const recent = logger.recent(5);
  assert.equal(recent.length, 5);
});

test("StructuredLogger tracks dropped entries when buffer wraps", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });

  logger.info("Msg 1");
  logger.info("Msg 2");
  logger.info("Msg 3");
  logger.info("Msg 4"); // Overwrites Msg 1
  logger.info("Msg 5"); // Overwrites Msg 2

  const summary = logger.getBufferSummary();
  assert.equal(summary.droppedEntryCount, 2, "Should track 2 dropped entries");
});

test("StructuredLogger getBufferSummary returns correct counts", () => {
  const logger = new StructuredLogger({ retentionLimit: 50 });

  logger.info("Message 1");
  logger.info("Message 2");

  const summary = logger.getBufferSummary();
  assert.equal(summary.entryCount, 2);
  assert.equal(summary.retentionLimit, 50);
  assert.equal(summary.droppedEntryCount, 0);
});

// =============================================================================
// Filtering by correlation IDs
// =============================================================================

test("StructuredLogger recentByTask filters by taskId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "Task 1 msg", taskId: "task-A" });
  logger.log({ level: "info", message: "Task 2 msg", taskId: "task-B" });
  logger.log({ level: "info", message: "Task 1 again", taskId: "task-A" });

  const taskALogs = logger.recentByTask("task-A");
  assert.equal(taskALogs.length, 2);
  assert.ok(taskALogs.every((e) => e.taskId === "task-A"));
});

test("StructuredLogger recentByTrace filters by traceId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "Trace 1 msg", traceId: "trace-X" });
  logger.log({ level: "info", message: "Trace 2 msg", traceId: "trace-Y" });
  logger.log({ level: "info", message: "Trace 1 again", traceId: "trace-X" });

  const traceXLogs = logger.recentByTrace("trace-X");
  assert.equal(traceXLogs.length, 2);
  assert.ok(traceXLogs.every((e) => e.traceId === "trace-X"));
});

test("StructuredLogger recentByCorrelation filters by correlationId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "Corr 1 msg", correlationId: "corr-1" });
  logger.log({ level: "info", message: "Corr 2 msg", correlationId: "corr-2" });
  logger.log({ level: "info", message: "Corr 1 again", correlationId: "corr-1" });

  const corr1Logs = logger.recentByCorrelation("corr-1");
  assert.equal(corr1Logs.length, 2);
  assert.ok(corr1Logs.every((e) => e.correlationId === "corr-1"));
});

test("StructuredLogger recentByTask respects limit", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  for (let i = 0; i < 20; i++) {
    logger.log({ level: "info", message: `Msg ${i}`, taskId: "task-Limited" });
  }

  const logs = logger.recentByTask("task-Limited", 5);
  assert.equal(logs.length, 5);
});

// =============================================================================
// Plane assignment
// =============================================================================

test("StructuredLogger assigns explicit plane", () => {
  const logger = new StructuredLogger({ retentionLimit: 100, plane: "P1" });

  const entry = logger.info("P1 message");

  assert.equal(entry.plane, "P1");
});

test("StructuredLogger uses X1 when no plane specified", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const entry = logger.info("No plane message");

  assert.equal(entry.plane, "X1");
});

// =============================================================================
// Global file sink configuration
// =============================================================================

test("StructuredLogger configureGlobalFileSink accepts null to disable", () => {
  StructuredLogger.configureGlobalFileSink(null);

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.equal(path, null);
});

test("StructuredLogger configureGlobalFileSink accepts file path string", () => {
  StructuredLogger.configureGlobalFileSink("logs/test-structured-logger.log");

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(path?.includes("test-structured-logger.log"));

  StructuredLogger.configureGlobalFileSink(null);
});

test("StructuredLogger configureGlobalFileSink rejects empty string", () => {
  StructuredLogger.configureGlobalFileSink("   ");

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.equal(path, null);
});

// =============================================================================
// Transport management
// =============================================================================

test("StructuredLogger addTransport adds transport", () => {
  const mockTransport = {
    name: "test-transport",
    write: (entry: StructuredLogEntry) => { },
  };

  StructuredLogger.addTransport(mockTransport);

  const removed = StructuredLogger.removeTransport("test-transport");
  assert.equal(removed, true);
});

test("StructuredLogger removeTransport returns false for unknown transport", () => {
  const removed = StructuredLogger.removeTransport("nonexistent-transport");
  assert.equal(removed, false);
});

test("StructuredLogger closeTransports clears all transports", async () => {
  const mockTransport = {
    name: "close-test",
    write: (entry: StructuredLogEntry) => { },
    close: async () => { },
  };

  StructuredLogger.addTransport(mockTransport);
  await StructuredLogger.closeTransports();

  // Transport should be removed
  const removed = StructuredLogger.removeTransport("close-test");
  assert.equal(removed, false);
});

// =============================================================================
// Edge cases
// =============================================================================

test("StructuredLogger handles empty recent when buffer is empty", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const recent = logger.recent(10);
  assert.equal(recent.length, 0);
});

test("StructuredLogger handles zero limit in recent", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.info("Message");

  const recent = logger.recent(0);
  assert.equal(recent.length, 0);
});

test("StructuredLogger handles limit larger than buffer", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("Message 1");
  logger.info("Message 2");

  const recent = logger.recent(100);
  assert.equal(recent.length, 2);
});

test("StructuredLogger recentByTask returns empty for nonexistent task", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "Some message", taskId: "task-X" });

  const logs = logger.recentByTask("nonexistent-task");
  assert.equal(logs.length, 0);
});

test("StructuredLogger recentByTrace returns empty for nonexistent trace", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "Some message", traceId: "trace-X" });

  const logs = logger.recentByTrace("nonexistent-trace");
  assert.equal(logs.length, 0);
});
