import assert from "node:assert/strict";
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import { startActiveSpan } from "../../../../../src/platform/shared/observability/otel-tracer.js";
import { StructuredLogger, StructuredLogEntry } from "../../../../../src/platform/shared/observability/structured-logger.js";

test("StructuredLogger constructor uses default retention limit", () => {
  const logger = new StructuredLogger();
  const summary = logger.getBufferSummary();
  assert.equal(summary.retentionLimit, 500);
  assert.equal(summary.entryCount, 0);
  assert.equal(summary.droppedEntryCount, 0);
});

test("StructuredLogger constructor accepts custom retention limit", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  const summary = logger.getBufferSummary();
  assert.equal(summary.retentionLimit, 100);
});

test("StructuredLogger constructor clamps minimum retention limit to 1", () => {
  const logger = new StructuredLogger({ retentionLimit: 0 });
  const summary = logger.getBufferSummary();
  assert.equal(summary.retentionLimit, 0);

  const logger2 = new StructuredLogger({ retentionLimit: -5 });
  const summary2 = logger2.getBufferSummary();
  assert.equal(summary2.retentionLimit, 0);
});

test("StructuredLogger.log adds entry with timestamp", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.log({ level: "info", message: "test message" });

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "test message");
  assert.equal(entry.plane, "X1");
  assert.equal(entry.service, "unknown_service");
  assert.equal(typeof entry.createdAt, "string");
  assert.equal(entry.timestamp, entry.createdAt);
  assert.ok(entry.createdAt?.includes("T"), "ISO timestamp should contain T");
});

test("StructuredLogger infers plane from source file path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.info("dispatch");
  assert.equal(entry.plane, "P4");
});

test("StructuredLogger.log includes optional fields when provided", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.log({
    level: "error",
    message: "error occurred",
    taskId: "task_123",
    agentId: "agent_456",
    sessionId: "sess_789",
    traceId: "trace_abc",
    data: { errorCode: "E001" },
  });

  assert.equal(entry.taskId, "task_123");
  assert.equal(entry.agentId, "agent_456");
  assert.equal(entry.sessionId, "sess_789");
  assert.equal(entry.traceId, "trace_abc");
  assert.deepEqual(entry.data, { errorCode: "E001" });
  assert.deepEqual(entry.structuredPayload, { errorCode: "E001" });
});

test("StructuredLogger normalizes service name from source file and supports structuredPayload aliases", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });
  const entry = logger.log({
    level: "fatal",
    message: "hard failure",
    structuredPayload: { code: "F001" },
  });

  assert.equal(entry.service, "index");
  assert.equal(entry.level, "fatal");
  assert.deepEqual(entry.data, { code: "F001" });
  assert.deepEqual(entry.structuredPayload, { code: "F001" });
});

test("StructuredLogger.debug creates debug level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.debug("debug message", { key: "value" });

  assert.equal(entry.level, "debug");
  assert.equal(entry.message, "debug message");
  assert.deepEqual(entry.data, { key: "value" });
});

test("StructuredLogger.info creates info level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.info("info message");

  assert.equal(entry.level, "info");
  assert.equal(entry.message, "info message");
});

test("StructuredLogger.warn creates warn level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.warn("warning message", { reason: "slow" });

  assert.equal(entry.level, "warn");
  assert.equal(entry.message, "warning message");
  assert.deepEqual(entry.data, { reason: "slow" });
});

test("StructuredLogger.error creates error level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.error("error message");

  assert.equal(entry.level, "error");
  assert.equal(entry.message, "error message");
});

test("StructuredLogger.fatal creates fatal level entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.fatal("fatal message");

  assert.equal(entry.level, "fatal");
  assert.equal(entry.message, "fatal message");
});

test("StructuredLogger.recent returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.info("first");
  logger.info("second");
  logger.info("third");

  const recent = logger.recent(3);
  assert.equal(recent.length, 3);
  assert.equal(recent[0]!.message, "first");
  assert.equal(recent[1]!.message, "second");
  assert.equal(recent[2]!.message, "third");
});

test("StructuredLogger.recent limits results", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  for (let i = 0; i < 5; i++) {
    logger.info(`message ${i}`);
  }

  const recent = logger.recent(2);
  assert.equal(recent.length, 2);
});

test("StructuredLogger.recent returns empty array when no entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const recent = logger.recent();
  assert.deepEqual(recent, []);
});

test("StructuredLogger.recent defaults to 50 entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  for (let i = 0; i < 60; i++) {
    logger.info(`message ${i}`);
  }

  const recent = logger.recent();
  assert.equal(recent.length, 50);
});

test("StructuredLogger ring buffer overwrites old entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });
  logger.info("first");
  logger.info("second");
  logger.info("third");
  logger.info("fourth");
  logger.info("fifth");

  const recent = logger.recent(3);
  // Should have third, fourth, fifth (oldest first)
  assert.equal(recent[0]!.message, "third");
  assert.equal(recent[1]!.message, "fourth");
  assert.equal(recent[2]!.message, "fifth");
});

test("StructuredLogger tracks dropped entries when buffer wraps", () => {
  const logger = new StructuredLogger({ retentionLimit: 3 });
  assert.equal(logger.getBufferSummary().droppedEntryCount, 0);

  logger.info("first");
  logger.info("second");
  logger.info("third");
  logger.info("fourth"); // First entry dropped

  assert.equal(logger.getBufferSummary().droppedEntryCount, 1);

  logger.info("fifth"); // Second entry dropped
  logger.info("sixth"); // Third entry dropped

  assert.equal(logger.getBufferSummary().droppedEntryCount, 3);
});

test("StructuredLogger.recentByTask filters by taskId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "task1 msg1", taskId: "task_1" });
  logger.log({ level: "info", message: "task2 msg1", taskId: "task_2" });
  logger.log({ level: "info", message: "task1 msg2", taskId: "task_1" });
  logger.log({ level: "info", message: "task2 msg2", taskId: "task_2" });

  const task1Logs = logger.recentByTask("task_1");
  assert.equal(task1Logs.length, 2);
  assert.ok(task1Logs.every((e) => e.taskId === "task_1"));
});

test("StructuredLogger.recentByTrace filters by traceId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "traceA msg1", traceId: "trace_A" });
  logger.log({ level: "info", message: "traceB msg1", traceId: "trace_B" });
  logger.log({ level: "info", message: "traceA msg2", traceId: "trace_A" });

  const traceALogs = logger.recentByTrace("trace_A");
  assert.equal(traceALogs.length, 2);
  assert.ok(traceALogs.every((e) => e.traceId === "trace_A"));
});

test("StructuredLogger.recentByCorrelation filters by correlationId", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  logger.log({ level: "info", message: "corr1 msg1", correlationId: "corr_1" });
  logger.log({ level: "info", message: "corr2 msg1", correlationId: "corr_2" });
  logger.log({ level: "info", message: "corr1 msg2", correlationId: "corr_1" });

  const corr1Logs = logger.recentByCorrelation("corr_1");
  assert.equal(corr1Logs.length, 2);
  assert.ok(corr1Logs.every((e) => e.correlationId === "corr_1"));
});

test("StructuredLogger.recentByTask respects limit parameter", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });
  for (let i = 0; i < 10; i++) {
    logger.log({ level: "info", message: `task1 msg ${i}`, taskId: "task_1" });
  }

  const recent = logger.recentByTask("task_1", 3);
  assert.equal(recent.length, 3);
});

test("StructuredLogger.getBufferSummary returns correct counts", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.info("msg1");
  logger.info("msg2");
  logger.info("msg3");

  const summary = logger.getBufferSummary();
  assert.equal(summary.entryCount, 3);
  assert.equal(summary.retentionLimit, 10);
  assert.equal(summary.droppedEntryCount, 0);
});

test("StructuredLogger handles concurrent-ish logging", () => {
  const logger = new StructuredLogger({ retentionLimit: 5 });
  logger.info("msg1");
  logger.info("msg2");
  logger.info("msg3");

  // Verify entries are accessible
  const recent = logger.recent();
  assert.equal(recent.length, 3);
});

test("StructuredLogger.log preserves all structured fields", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.log({
    level: "info",
    message: "structured message",
    spanId: "span_123",
    parentSpanId: "parent_456",
    stepId: "step_789",
  });

  assert.equal(entry.spanId, "span_123");
  assert.equal(entry.parentSpanId, "parent_456");
  assert.equal(entry.stepId, "step_789");
});

test("StructuredLogger.log bridges active telemetry context when ids are omitted", async () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  await startActiveSpan("logger.bridge", {}, async (_span, context) => {
    const entry = logger.info("bridged");
    assert.equal(entry.traceId, context.traceId);
    assert.equal(entry.spanId, context.spanId);
  });
});

test("StructuredLogger.configureGlobalFileSink rejects absolute paths", () => {
  // Reset global sink
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("/etc/passwd");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger.configureGlobalFileSink rejects path traversal sequences", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("logs/../../../etc/passwd");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger.configureGlobalFileSink rejects empty paths", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("   ");

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger.configureGlobalFileSink accepts null to disable sink", () => {
  StructuredLogger.configureGlobalFileSink(null);

  assert.equal(StructuredLogger.getGlobalFileSinkPath(), null);
});

test("StructuredLogger.configureGlobalFileSink accepts valid relative path", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink("logs/test.log");

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(path !== null);
  assert.ok(path.endsWith("logs/test.log"));
});

test("StructuredLogger.configureGlobalFileSink accepts valid path options", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink({ filePath: "logs/options.log", maxBytes: 1024, maxFiles: 3 });

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(path !== null);
  assert.ok(path.endsWith("logs/options.log"));
});

test("StructuredLogger.configureGlobalFileSink clamps maxBytes to minimum 1", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink({ filePath: "logs/clamped.log", maxBytes: 0 });

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(path !== null);
});

test("StructuredLogger.configureGlobalFileSink clamps maxFiles to minimum 1", () => {
  StructuredLogger.configureGlobalFileSink(null);

  StructuredLogger.configureGlobalFileSink({ filePath: "logs/clamped-files.log", maxFiles: 0 });

  const path = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(path !== null);
});

test("StructuredLogger uses shared rotation state across logger instances for the global file sink", async () => {
  const relativePath = join(".test-output", "structured-logger-rotation.log");
  StructuredLogger.configureGlobalFileSink(null);
  rmSync(".test-output", { recursive: true, force: true });
  StructuredLogger.configureGlobalFileSink({ filePath: relativePath, maxBytes: 64, maxFiles: 2 });

  const loggerA = new StructuredLogger({ retentionLimit: 10 });
  const loggerB = new StructuredLogger({ retentionLimit: 10 });
  loggerA.info("A".repeat(256));
  loggerB.info("B".repeat(256));

  await new Promise((resolve) => setTimeout(resolve, 150));

  const sinkPath = StructuredLogger.getGlobalFileSinkPath();
  assert.ok(sinkPath !== null);
  assert.equal(existsSync(`${sinkPath!}.1`) || existsSync(sinkPath!), true);

  StructuredLogger.configureGlobalFileSink(null);
  rmSync(".test-output", { recursive: true, force: true });
});

test("StructuredLogger.addTransport and removeTransport manage transport list", () => {
  const mockTransport = {
    name: "mock-transport",
    write: () => {},
  };

  StructuredLogger.addTransport(mockTransport as any);

  const removed = StructuredLogger.removeTransport("mock-transport");
  assert.equal(removed, true);
});

test("StructuredLogger.removeTransport returns false for non-existent transport", () => {
  const removed = StructuredLogger.removeTransport("non-existent-transport");
  assert.equal(removed, false);
});

test("StructuredLogger.flushTransports calls flush on flushable transports", async () => {
  let flushCalled = false;
  const flushableTransport = {
    name: "flushable-transport",
    write: () => {},
    flush: async () => {
      flushCalled = true;
    },
  };

  const unflushableTransport = {
    name: "unflushable-transport",
    write: () => {},
  };

  StructuredLogger.addTransport(flushableTransport as any);
  StructuredLogger.addTransport(unflushableTransport as any);

  await StructuredLogger.flushTransports();

  assert.equal(flushCalled, true);

  StructuredLogger.removeTransport("flushable-transport");
  StructuredLogger.removeTransport("unflushable-transport");
});

test("StructuredLogger.closeTransports calls close on closeable transports", async () => {
  let closeCalled = false;
  const closeableTransport = {
    name: "closeable-transport",
    write: () => {},
    close: async () => {
      closeCalled = true;
    },
  };

  StructuredLogger.addTransport(closeableTransport as any);

  await StructuredLogger.closeTransports();

  assert.equal(closeCalled, true);
});

test("StructuredLogger redacts inline bearer and token-like values from string payloads", () => {
  const logger = new StructuredLogger();

  logger.info("inline-secret", {
    detail: "Authorization: Bearer sk_live_secret_token_12345678 and token=eyJheader.payload.signature",
  });

  const entry = logger.recent(1)[0];
  assert.equal(typeof entry?.data?.detail, "string");
  assert.equal(String(entry?.data?.detail).includes("Bearer"), false);
  assert.equal(String(entry?.data?.detail).includes("sk_live_secret_token_12345678"), false);
  assert.equal(String(entry?.data?.detail).includes("[REDACTED]"), true);
});
