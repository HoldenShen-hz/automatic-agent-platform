/**
 * StructuredLogger Unit Tests
 *
 * Tests for src/platform/shared/observability/structured-logger.ts
 * Focus areas:
 * - Issue #2139: rotationScheduled per-instance but fileSink is global
 *   This causes concurrent rotation corruption when multiple logger instances
 *   share a global file sink but each has their own rotationScheduled flag
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync, readFileSync, mkdirSync, rmSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { StructuredLogger, type StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";
import { createTempWorkspace, cleanupPath } from "../../../../helpers/fs.js";

async function waitForFileLines(filePath: string, minLineCount: number, timeoutMs = 1000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (existsSync(filePath)) {
      const content = readFileSync(filePath, "utf8");
      const lines = content.split("\n").filter((line) => line.length > 0);
      if (lines.length >= minLineCount) {
        return;
      }
    }
    await delay(10);
  }

  throw new assert.AssertionError({
    message: `Timed out waiting for ${minLineCount} log line(s) in ${filePath}`,
    expected: true,
    actual: false,
    operator: "==",
  });
}

test("StructuredLogger - basic log creates entry with required fields", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.info("test message");

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "test message");
  assert.equal(entry.service, "unknown_service");
  assert.equal(entry.plane, "X1");
  assert.ok(entry.timestamp);
  assert.ok(entry.createdAt);
});

test("StructuredLogger - ring buffer wraps correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });

  logger.info("first");
  logger.info("second");
  logger.info("third");
  logger.info("fourth"); // Should overwrite "first"

  const entries = logger.recent(3);
  assert.equal(entries[0]?.message, "second");
  assert.equal(entries[1]?.message, "third");
  assert.equal(entries[2]?.message, "fourth");
});

test("StructuredLogger - droppedEntryCount tracks overflow", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });

  logger.info("first");
  logger.info("second");
  logger.info("third");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 0);

  logger.info("fourth");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 1);

  logger.info("fifth");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 2);
});

test("StructuredLogger - clear resets buffer and counts", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });

  logger.info("first");
  logger.info("second");
  logger.info("third");
  logger.info("fourth");

  assert.equal(logger.getBufferSummary().droppedEntryCount, 1);
  assert.equal(logger.getBufferSummary().entryCount, 3);

  logger.clear();

  assert.equal(logger.getBufferSummary().droppedEntryCount, 0);
  assert.equal(logger.getBufferSummary().entryCount, 0);
});

test("StructuredLogger - recent returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("first");
  logger.info("second");
  logger.info("third");

  const recent = logger.recent(3);
  assert.equal(recent[0]?.message, "first");
  assert.equal(recent[1]?.message, "second");
  assert.equal(recent[2]?.message, "third");
});

test("StructuredLogger - recentByTask filters correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "msg1", taskId: "task-1" });
  logger.log({ level: "info", message: "msg2", taskId: "task-2" });
  logger.log({ level: "info", message: "msg3", taskId: "task-1" });

  const task1Logs = logger.recentByTask("task-1");
  assert.equal(task1Logs.length, 2);
  assert.ok(task1Logs.every((e) => e.taskId === "task-1"));
});

test("StructuredLogger - recentByTrace filters correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "trace-a-1", traceId: "trace-a" });
  logger.log({ level: "info", message: "trace-b-1", traceId: "trace-b" });
  logger.log({ level: "info", message: "trace-a-2", traceId: "trace-a" });

  const traceALogs = logger.recentByTrace("trace-a");
  assert.equal(traceALogs.length, 2);
  assert.ok(traceALogs.every((e) => e.traceId === "trace-a"));
});

test("StructuredLogger - recentByCorrelation filters correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "corr-1", correlationId: "corr-a" });
  logger.log({ level: "info", message: "corr-2", correlationId: "corr-b" });
  logger.log({ level: "info", message: "corr-3", correlationId: "corr-a" });

  const corrALogs = logger.recentByCorrelation("corr-a");
  assert.equal(corrALogs.length, 2);
  assert.ok(corrALogs.every((e) => e.correlationId === "corr-a"));
});

test("StructuredLogger - minLogLevel filters entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100, minLogLevel: "error" });

  logger.debug("debug");
  logger.info("info");
  logger.warn("warn");
  logger.error("error");
  logger.fatal("fatal");

  const entries = logger.getEntries();
  assert.equal(entries.length, 2);
  assert.ok(entries.every((e) => e.level === "error" || e.level === "fatal"));
});

test("StructuredLogger - log extracts fields from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { taskId: "from-data", customField: "value" },
  });

  assert.equal(entry.taskId, "from-data");
  assert.equal(entry.data?.customField, "value");
});

test("StructuredLogger - explicit fields override data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    taskId: "explicit-id",
    data: { taskId: "data-id" },
  });

  assert.equal(entry.taskId, "explicit-id");
});

test("StructuredLogger - plane inference from path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.plane, "P4");
  assert.equal(entry.service, "index");
});

test("StructuredLogger - service normalization strips path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "index");
  assert.ok(!entry.service.includes("/"));
});

test("StructuredLogger - crosscuttingFabric classification", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    crosscuttingFabric: "security",
  });

  assert.equal(entry.crosscuttingFabric, "security");
});

test("StructuredLogger - getEntries is alias for recent(count)", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("first");
  logger.info("second");

  const entries = logger.getEntries();
  const recent = logger.recent(logger.getBufferSummary().entryCount);

  assert.deepEqual(entries, recent);
});

test("StructuredLogger - configureGlobalFileSink accepts valid path", () => {
  const workspace = createTempWorkspace("aa-logger-");

  try {
    StructuredLogger.configureGlobalFileSink(join(workspace, "test.log"));
    assert.ok(StructuredLogger.getGlobalFileSinkPath() !== null);
  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    cleanupPath(workspace);
  }
});

test("StructuredLogger - configureGlobalFileSink rejects absolute paths", () => {
  StructuredLogger.configureGlobalFileSink("/etc/passwd");
  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger - configureGlobalFileSink rejects path traversal", () => {
  StructuredLogger.configureGlobalFileSink("logs/../../../etc/passwd");
  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger - configureGlobalFileSink rejects empty/whitespace paths", () => {
  StructuredLogger.configureGlobalFileSink("   ");
  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger - configureGlobalFileSink null disables sink", () => {
  StructuredLogger.configureGlobalFileSink("logs/test.log");
  StructuredLogger.configureGlobalFileSink(null);
  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger - addTransport and removeTransport work", () => {
  const transport = { name: "test-transport", write: () => {} };

  StructuredLogger.addTransport(transport as any);
  assert.equal(StructuredLogger.removeTransport("test-transport"), true);
  assert.equal(StructuredLogger.removeTransport("non-existent"), false);
});

test("StructuredLogger - flushTransports calls flush on compatible transports", async () => {
  let flushCalled = false;
  const transport = {
    name: "flushable",
    write: () => {},
    flush: async () => { flushCalled = true; },
  };

  StructuredLogger.addTransport(transport as any);
  await StructuredLogger.flushTransports();
  assert.equal(flushCalled, true);

  StructuredLogger.removeTransport("flushable");
});

test("StructuredLogger - closeTransports calls close and clears list", async () => {
  let closeCalled = false;
  const transport = {
    name: "closeable",
    write: () => {},
    close: async () => { closeCalled = true; },
  };

  StructuredLogger.addTransport(transport as any);
  await StructuredLogger.closeTransports();
  assert.equal(closeCalled, true);
});

test("StructuredLogger - Issue #2139: multiple instances with shared global sink", async () => {
  // This test demonstrates the issue where rotationScheduled is per-instance
  // but fileSink is global, potentially causing concurrent rotation corruption

  const workspace = createTempWorkspace("aa-multi-logger-");
  const logFile = join(workspace, "shared.log");

  try {
    // Configure shared global sink
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 1024, // Small size to trigger rotation
      maxFiles: 3,
    });

    // Create multiple logger instances (simulating different modules)
    const logger1 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/execution/module-a.ts" });
    const logger2 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/execution/module-b.ts" });
    const logger3 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/execution/module-c.ts" });

    // Log from all instances - this could trigger concurrent rotation
    for (let i = 0; i < 100; i++) {
      logger1.info(`logger1-message-${i}`);
      logger2.info(`logger2-message-${i}`);
      logger3.info(`logger3-message-${i}`);
    }

    // Give time for async file operations
    // Note: This is a potential race condition - the test verifies behavior
    // but doesn't guarantee the race condition is triggered deterministically

    // Verify file exists and has content
    await waitForFileLines(logFile, 1);

    // Verify all loggers captured entries
    assert.ok(logger1.getBufferSummary().entryCount > 0);
    assert.ok(logger2.getBufferSummary().entryCount > 0);
    assert.ok(logger3.getBufferSummary().entryCount > 0);

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    cleanupPath(workspace);
  }
});

test("StructuredLogger - retentionLimit 0 disables buffer", () => {
  const logger = new StructuredLogger({ retentionLimit: 0 });

  logger.info("message1");
  logger.info("message2");
  logger.info("message3");

  assert.equal(logger.getBufferSummary().entryCount, 0);
  assert.equal(logger.getEntries().length, 0);
});

test("StructuredLogger - structuredPayload alias works", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    structuredPayload: { key: "value" },
  });

  assert.deepEqual(entry.data, { key: "value" });
  assert.deepEqual(entry.structuredPayload, { key: "value" });
});

test("StructuredLogger - data takes precedence over structuredPayload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { primary: "data" },
    structuredPayload: { secondary: "payload" },
  });

  // data is assigned directly to structuredPayload
  assert.deepEqual(entry.data, { primary: "data" });
  assert.deepEqual(entry.structuredPayload, { primary: "data" });
});

test("StructuredLogger - timestamp and createdAt are set to same value when not provided", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.info("test");

  assert.equal(entry.timestamp, entry.createdAt);
});

test("StructuredLogger - explicit timestamp is preserved", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.log({
    level: "info",
    message: "test",
    timestamp: "2025-01-01T00:00:00.000Z",
  });

  assert.equal(entry.timestamp, "2025-01-01T00:00:00.000Z");
  assert.equal(entry.createdAt, "2025-01-01T00:00:00.000Z");
});

test("StructuredLogger - plane X1 for unknown paths", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/unknown/path.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.plane, "X1");
});

test("StructuredLogger - all plane mappings", () => {
  const planes = [
    { file: "/workspace/src/platform/interface/api/gateway.ts", expected: "P1" },
    { file: "/workspace/src/platform/control-plane/iam/service.ts", expected: "P2" },
    { file: "/workspace/src/platform/orchestration/planner/index.ts", expected: "P3" },
    { file: "/workspace/src/platform/execution/dispatcher/index.ts", expected: "P4" },
    { file: "/workspace/src/platform/state-evidence/truth/repository.ts", expected: "P5" },
  ];

  for (const { file, expected } of planes) {
    const logger = new StructuredLogger({ retentionLimit: 10, planeSourceFile: file });
    const entry = logger.info("test");
    assert.equal(entry.plane, expected, `Plane for ${file} should be ${expected}`);
  }
});

test("StructuredLogger - service name from explicit service option", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    service: "my-custom-service",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "my-custom-service");
});

test("StructuredLogger - service defaults to unknown_service for empty string", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    service: "",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "unknown_service");
});

test("StructuredLogger - service defaults to unknown_service for whitespace only", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    service: "   \t\n  ",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "unknown_service");
});

test("StructuredLogger - telemetry context bridging", async () => {
  const { startActiveSpan } = await import("../../../../../src/platform/shared/observability/otel-tracer.js");
  const logger = new StructuredLogger({ retentionLimit: 10 });

  await startActiveSpan("test-span", {}, async (_span, context) => {
    const entry = logger.info("bridged log");
    assert.equal(entry.traceId, context.traceId);
    assert.equal(entry.spanId, context.spanId);
  });
});

test("StructuredLogger - recentByTask respects limit", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  for (let i = 0; i < 10; i++) {
    logger.log({ level: "info", message: `msg-${i}`, taskId: "task-limit" });
  }

  const recent = logger.recentByTask("task-limit", 3);
  assert.equal(recent.length, 3);
});

test("StructuredLogger - recent returns empty when no entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const recent = logger.recent();
  assert.deepEqual(recent, []);
});

test("StructuredLogger - recent limits to actual count when fewer entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("first");
  logger.info("second");

  const recent = logger.recent(100); // Request more than exists
  assert.equal(recent.length, 2);
});
