/**
 * StructuredLogger Formatting Tests
 *
 * Tests for src/platform/shared/observability/structured-logger.ts
 * Focus areas:
 * - Log entry JSON formatting
 * - Timestamp and ISO date formatting
 * - Correlation ID and trace formatting
 * - Data payload serialization
 */

import assert from "node:assert/strict";
import test from "node:test";
import { StructuredLogger } from "../../../../../src/platform/shared/observability/structured-logger.js";

test("StructuredLogger - JSON serialization of log entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const entry = logger.info("test message");

  const json = JSON.stringify(entry);
  const parsed = JSON.parse(json);

  assert.equal(parsed.level, "info");
  assert.equal(parsed.message, "test message");
  assert.equal(parsed.service, "unknown_service");
  assert.ok(parsed.timestamp);
  assert.ok(parsed.createdAt);
});

test("StructuredLogger - ISO timestamp format", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  const before = new Date().toISOString();
  const entry = logger.info("test");
  const after = new Date().toISOString();

  assert.ok(entry.timestamp >= before && entry.timestamp <= after, "timestamp should be within expected range");
  assert.match(entry.timestamp, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
  assert.match(entry.createdAt, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}.\d{3}Z$/);
});

test("StructuredLogger - all log levels produce valid entries", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const debugEntry = logger.debug("debug message");
  const infoEntry = logger.info("info message");
  const warnEntry = logger.warn("warn message");
  const errorEntry = logger.error("error message");
  const fatalEntry = logger.fatal("fatal message");

  assert.equal(debugEntry.level, "debug");
  assert.equal(infoEntry.level, "info");
  assert.equal(warnEntry.level, "warn");
  assert.equal(errorEntry.level, "error");
  assert.equal(fatalEntry.level, "fatal");

  // All should have valid timestamps
  for (const entry of [debugEntry, infoEntry, warnEntry, errorEntry, fatalEntry]) {
    assert.ok(entry.timestamp);
    assert.ok(entry.createdAt);
  }
});

test("StructuredLogger - data payload with various types serializes correctly", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const complexData = {
    stringValue: "hello",
    numberValue: 42,
    floatValue: 3.14159,
    boolValue: true,
    nullValue: null,
    arrayValue: [1, 2, 3],
    nestedObject: { key: "value" },
  };

  const entry = logger.log({
    level: "info",
    message: "complex data test",
    data: complexData,
  });

  assert.deepEqual(entry.data, complexData);
  const json = JSON.stringify(entry);
  const parsed = JSON.parse(json);
  assert.deepEqual(parsed.data, complexData);
});

test("StructuredLogger - traceId and spanId formatting", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "trace test",
    traceId: "trace-abc123",
    spanId: "span-def456",
    parentSpanId: "parent-span-789",
  });

  assert.equal(entry.traceId, "trace-abc123");
  assert.equal(entry.spanId, "span-def456");
  assert.equal(entry.parentSpanId, "parent-span-789");
});

test("StructuredLogger - correlationId and causationId formatting", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "correlation test",
    correlationId: "corr-001",
    causationId: "cause-002",
  });

  assert.equal(entry.correlationId, "corr-001");
  assert.equal(entry.causationId, "cause-002");
});

test("StructuredLogger - tenantId and harnessRunId formatting", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "tenant test",
    tenantId: "tenant-xyz",
    harnessRunId: "run-abc",
  });

  assert.equal(entry.tenantId, "tenant-xyz");
  assert.equal(entry.harnessRunId, "run-abc");
});

test("StructuredLogger - requestId is promoted from structured data", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.info("request scoped log", {
    requestId: "req-123",
    taskId: "task-123",
  });

  assert.equal(entry.requestId, "req-123");
  assert.equal(entry.taskId, "task-123");
});

test("StructuredLogger - sensitive data fields are redacted recursively", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.info("sensitive log", {
    authorization: "Bearer token",
    nested: {
      password: "secret",
      safe: "visible",
      tokens: [{ apiKey: "key-1" }],
    },
  });

  assert.deepEqual(entry.data, {
    authorization: "[REDACTED]",
    nested: {
      password: "[REDACTED]",
      safe: "visible",
      tokens: "[REDACTED]",
    },
  });
  assert.deepEqual(entry.structuredPayload, entry.data);
});

test("StructuredLogger - plane field is correctly set", () => {
  const loggerP1 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/interface/api/index.ts" });
  const loggerP2 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/control-plane/iam/service.ts" });
  const loggerP3 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/orchestration/planner/index.ts" });
  const loggerP4 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts" });
  const loggerP5 = new StructuredLogger({ retentionLimit: 10, planeSourceFile: "/workspace/src/platform/state-evidence/truth/repo.ts" });

  assert.equal(loggerP1.info("P1").plane, "P1");
  assert.equal(loggerP2.info("P2").plane, "P2");
  assert.equal(loggerP3.info("P3").plane, "P3");
  assert.equal(loggerP4.info("P4").plane, "P4");
  assert.equal(loggerP5.info("P5").plane, "P5");
});

test("StructuredLogger - crosscuttingFabric category values", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const reliability = logger.log({ level: "info", message: "reliability", crosscuttingFabric: "reliability" });
  const security = logger.log({ level: "info", message: "security", crosscuttingFabric: "security" });
  const governance = logger.log({ level: "info", message: "governance", crosscuttingFabric: "governance" });

  assert.equal(reliability.crosscuttingFabric, "reliability");
  assert.equal(security.crosscuttingFabric, "security");
  assert.equal(governance.crosscuttingFabric, "governance");
});

test("StructuredLogger - getBufferSummary returns correct format", () => {
  const logger = new StructuredLogger({ retentionLimit: 50 });

  logger.info("first");
  logger.info("second");
  logger.info("third");

  const summary = logger.getBufferSummary();

  assert.equal(summary.entryCount, 3);
  assert.equal(summary.retentionLimit, 50);
  assert.equal(summary.droppedEntryCount, 0);
});

test("StructuredLogger - droppedEntryCount increments when buffer overflows", () => {
  const logger = new StructuredLogger({ retentionLimit: 2 });

  logger.info("first");
  logger.info("second");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 0);

  logger.info("third");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 1);

  logger.info("fourth");
  assert.equal(logger.getBufferSummary().droppedEntryCount, 2);
});

test("StructuredLogger - recent entries maintain insertion order", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  for (let i = 0; i < 10; i++) {
    logger.info(`message-${i}`);
  }

  const entries = logger.recent(10);
  assert.equal(entries.length, 10);
  for (let i = 0; i < 10; i++) {
    assert.equal(entries[i]?.message, `message-${i}`);
  }
});

test("StructuredLogger - recentByTask returns entries in order", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "msg1", taskId: "task-A" });
  logger.log({ level: "info", message: "msg2", taskId: "task-B" });
  logger.log({ level: "info", message: "msg3", taskId: "task-A" });
  logger.log({ level: "info", message: "msg4", taskId: "task-A" });

  const taskA = logger.recentByTask("task-A");
  assert.equal(taskA.length, 3);
  assert.equal(taskA[0]?.message, "msg1");
  assert.equal(taskA[1]?.message, "msg3");
  assert.equal(taskA[2]?.message, "msg4");
});

test("StructuredLogger - recentByTrace returns entries in order", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "trace1", traceId: "trace-X" });
  logger.log({ level: "info", message: "trace2", traceId: "trace-Y" });
  logger.log({ level: "info", message: "trace3", traceId: "trace-X" });

  const traceX = logger.recentByTrace("trace-X");
  assert.equal(traceX.length, 2);
  assert.equal(traceX[0]?.message, "trace1");
  assert.equal(traceX[1]?.message, "trace3");
});

test("StructuredLogger - recentByCorrelation returns entries in order", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({ level: "info", message: "corr1", correlationId: "corr-1" });
  logger.log({ level: "info", message: "corr2", correlationId: "corr-2" });
  logger.log({ level: "info", message: "corr3", correlationId: "corr-1" });
  logger.log({ level: "info", message: "corr4", correlationId: "corr-1" });

  const corr1 = logger.recentByCorrelation("corr-1");
  assert.equal(corr1.length, 3);
  assert.equal(corr1[0]?.message, "corr1");
  assert.equal(corr1[1]?.message, "corr3");
  assert.equal(corr1[2]?.message, "corr4");
});

test("StructuredLogger - service name extracted from file path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "index");
});

test("StructuredLogger - service name with platform path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/control-plane/config-center/service.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "service");
});

test("StructuredLogger - service option overrides planeSourceFile", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/execution/dispatcher/index.ts",
    service: "custom-service",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "custom-service");
});
