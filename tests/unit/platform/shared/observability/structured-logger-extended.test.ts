import assert from "node:assert/strict";
import test from "node:test";

import {
  StructuredLogger,
  type StructuredLogEntry,
  type StructuredLoggerOptions,
} from "../../../../../src/platform/shared/observability/structured-logger.js";

test("StructuredLogger minLogLevel filters entries below threshold", () => {
  const logger = new StructuredLogger({
    retentionLimit: 100,
    minLogLevel: "warn",
  });

  logger.debug("debug message");
  logger.info("info message");
  logger.warn("warn message");
  logger.error("error message");
  logger.fatal("fatal message");

  const entries = logger.getEntries();

  // Only warn, error, fatal should pass the filter
  assert.equal(entries.length, 3);
  assert.ok(entries.every((e) => e.level === "warn" || e.level === "error" || e.level === "fatal"));
});

test("StructuredLogger minLogLevel error includes error and fatal", () => {
  const logger = new StructuredLogger({
    retentionLimit: 100,
    minLogLevel: "error",
  });

  logger.debug("debug");
  logger.info("info");
  logger.warn("warn");
  logger.error("error");
  logger.fatal("fatal");

  const entries = logger.getEntries();
  assert.equal(entries.length, 2);
  assert.equal(entries[0]?.level, "error");
  assert.equal(entries[1]?.level, "fatal");
});

test("StructuredLogger minLogLevel fatal includes only fatal", () => {
  const logger = new StructuredLogger({
    retentionLimit: 100,
    minLogLevel: "fatal",
  });

  logger.debug("debug");
  logger.info("info");
  logger.warn("warn");
  logger.error("error");
  logger.fatal("fatal");

  const entries = logger.getEntries();
  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.level, "fatal");
});

test("StructuredLogger minLogLevel debug includes all levels", () => {
  const logger = new StructuredLogger({
    retentionLimit: 100,
    minLogLevel: "debug",
  });

  logger.debug("debug");
  logger.info("info");
  logger.warn("warn");
  logger.error("error");
  logger.fatal("fatal");

  const entries = logger.getEntries();
  assert.equal(entries.length, 5);
});

test("StructuredLogger plane inference from control-plane path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-control-plane/iam/service.ts",
  });

  const entry = logger.info("iam operation");
  assert.equal(entry.plane, "P2");
});

test("StructuredLogger plane inference from orchestration path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-orchestration/planner/index.ts",
  });

  const entry = logger.info("planning operation");
  assert.equal(entry.plane, "P3");
});

test("StructuredLogger plane inference from interface path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-interface/api/gateway.ts",
  });

  const entry = logger.info("api operation");
  assert.equal(entry.plane, "P1");
});

test("StructuredLogger plane inference from state-evidence path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-state-evidence/truth/repository.ts",
  });

  const entry = logger.info("storage operation");
  assert.equal(entry.plane, "P5");
});

test("StructuredLogger plane defaults to X1 for unknown paths", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/unknown/path.ts",
  });

  const entry = logger.info("unknown operation");
  assert.equal(entry.plane, "X1");
});

test("StructuredLogger service name extraction from file with path", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "index");
});

test("StructuredLogger service name extraction handles path separators", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "index");
});

test("StructuredLogger service name extraction strips .ts extension", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  assert.ok(!entry.service.endsWith(".ts"));
});

test("StructuredLogger service name extraction strips .mts extension", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/module.mts",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "module");
});

test("StructuredLogger service name defaults to unknown_service for empty input", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    service: "",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "unknown_service");
});

test("StructuredLogger service name defaults to unknown_service for whitespace only", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    service: "   \t\n  ",
  });

  const entry = logger.info("test");
  assert.equal(entry.service, "unknown_service");
});

test("StructuredLogger reads correlationId from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { correlationId: "data-correlation-id" },
  });

  assert.equal(entry.correlationId, "data-correlation-id");
});

test("StructuredLogger explicit correlationId overrides data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    correlationId: "explicit-corr-id",
    data: { correlationId: "data-corr-id" },
  });

  assert.equal(entry.correlationId, "explicit-corr-id");
});

test("StructuredLogger reads causationId from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { causationId: "cause-123" },
  });

  assert.equal(entry.causationId, "cause-123");
});

test("StructuredLogger explicit causationId overrides data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    causationId: "explicit-cause",
    data: { causationId: "data-cause" },
  });

  assert.equal(entry.causationId, "explicit-cause");
});

test("StructuredLogger reads tenantId from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { tenantId: "tenant-abc" },
  });

  assert.equal(entry.tenantId, "tenant-abc");
});

test("StructuredLogger explicit tenantId overrides data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    tenantId: "explicit-tenant",
    data: { tenantId: "data-tenant" },
  });

  assert.equal(entry.tenantId, "explicit-tenant");
});

test("StructuredLogger reads harnessRunId from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { harnessRunId: "run-123" },
  });

  assert.equal(entry.harnessRunId, "run-123");
});

test("StructuredLogger explicit harnessRunId overrides data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    harnessRunId: "explicit-run",
    data: { harnessRunId: "data-run" },
  });

  assert.equal(entry.harnessRunId, "explicit-run");
});

test("StructuredLogger reads crosscuttingFabric from data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { crosscuttingFabric: "security" },
  });

  assert.equal(entry.crosscuttingFabric, "security");
});

test("StructuredLogger explicit crosscuttingFabric overrides data payload", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    crosscuttingFabric: "governance",
    data: { crosscuttingFabric: "reliability" },
  });

  assert.equal(entry.crosscuttingFabric, "governance");
});

test("StructuredLogger timestamp can be provided explicitly", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    timestamp: "2026-01-15T10:30:00.000Z",
  });

  assert.equal(entry.timestamp, "2026-01-15T10:30:00.000Z");
  assert.equal(entry.createdAt, "2026-01-15T10:30:00.000Z");
});

test("StructuredLogger service can be provided explicitly", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.log({
    level: "info",
    message: "test",
    service: "custom-service",
  });

  assert.equal(entry.service, "custom-service");
});

test("StructuredLogger plane can be provided explicitly", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.log({
    level: "info",
    message: "test",
    plane: "P1",
  });

  assert.equal(entry.plane, "P1");
});

test("StructuredLogger omit null correlationId from entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
  });

  // null correlationId should not be included
  assert.strictEqual(entry.correlationId, undefined);
});

test("StructuredLogger omit null causationId from entry", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
  });

  assert.strictEqual(entry.causationId, undefined);
});

test("StructuredLogger recent returns entries in oldest-first order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.info("first");
  logger.info("second");
  logger.info("third");

  const recent = logger.recent(10);
  assert.equal(recent[0]?.message, "first");
  assert.equal(recent[1]?.message, "second");
  assert.equal(recent[2]?.message, "third");
});

test("StructuredLogger recentByTask returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.log({ level: "info", message: "task1-msg1", taskId: "task_1" });
  logger.log({ level: "info", message: "task1-msg2", taskId: "task_1" });
  logger.log({ level: "info", message: "task1-msg3", taskId: "task_1" });

  const recent = logger.recentByTask("task_1", 10);
  assert.equal(recent[0]?.message, "task1-msg1");
  assert.equal(recent[1]?.message, "task1-msg2");
  assert.equal(recent[2]?.message, "task1-msg3");
});

test("StructuredLogger recentByTrace returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.log({ level: "info", message: "trace1-msg1", traceId: "trace_1" });
  logger.log({ level: "info", message: "trace1-msg2", traceId: "trace_1" });

  const recent = logger.recentByTrace("trace_1", 10);
  assert.equal(recent[0]?.message, "trace1-msg1");
  assert.equal(recent[1]?.message, "trace1-msg2");
});

test("StructuredLogger recentByCorrelation returns entries in chronological order", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });
  logger.log({ level: "info", message: "corr1-msg1", correlationId: "corr_1" });
  logger.log({ level: "info", message: "corr1-msg2", correlationId: "corr_1" });
  logger.log({ level: "info", message: "corr1-msg3", correlationId: "corr_1" });

  const recent = logger.recentByCorrelation("corr_1", 10);
  assert.equal(recent[0]?.message, "corr1-msg1");
  assert.equal(recent[1]?.message, "corr1-msg2");
  assert.equal(recent[2]?.message, "corr1-msg3");
});

test("StructuredLogger log uses traceId as fallback correlationId", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    traceId: "trace-fallback-corr",
  });

  // When no explicit correlationId, traceId should be used
  assert.equal(entry.correlationId, "trace-fallback-corr");
});

test("StructuredLogger plane X1 for paths outside five-plane structure", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    planeSourceFile: "/workspace/src/other/module.ts",
  });

  const entry = logger.info("test");
  assert.equal(entry.plane, "X1");
});

test("StructuredLogger log accepts agentId field", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "agent operation",
    agentId: "agent_abc",
  });

  assert.equal(entry.agentId, "agent_abc");
});

test("StructuredLogger log accepts sessionId field", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "session operation",
    sessionId: "session_xyz",
  });

  assert.equal(entry.sessionId, "session_xyz");
});

test("StructuredLogger log accepts stepId field", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "step operation",
    stepId: "step_123",
  });

  assert.equal(entry.stepId, "step_123");
});

test("StructuredLogger log accepts both spanId and parentSpanId", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "span test",
    spanId: "span_child",
    parentSpanId: "span_parent",
  });

  assert.equal(entry.spanId, "span_child");
  assert.equal(entry.parentSpanId, "span_parent");
});

test("StructuredLogger clear resets dropped entry count", () => {
  const logger = new StructuredLogger({ retentionLimit: 2 });

  logger.info("msg1");
  logger.info("msg2");
  logger.info("msg3"); // This causes a drop

  assert.equal(logger.getBufferSummary().droppedEntryCount, 1);

  logger.clear();

  assert.equal(logger.getBufferSummary().droppedEntryCount, 0);
});

test("StructuredLogger clear resets entry count", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  logger.info("msg1");
  logger.info("msg2");
  logger.info("msg3");

  assert.equal(logger.getBufferSummary().entryCount, 3);

  logger.clear();

  assert.equal(logger.getBufferSummary().entryCount, 0);
});

test("StructuredLogger BufferSummary structure has correct types", () => {
  const logger = new StructuredLogger({ retentionLimit: 50 });

  const summary = logger.getBufferSummary();

  assert.ok(typeof summary.entryCount === "number");
  assert.ok(typeof summary.retentionLimit === "number");
  assert.ok(typeof summary.droppedEntryCount === "number");
});

test("StructuredLogger handles structuredPayload as primary data source", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    structuredPayload: { customField: "customValue", nested: { a: 1, b: 2 } },
  });

  assert.deepEqual(entry.data, { customField: "customValue", nested: { a: 1, b: 2 } });
  assert.deepEqual(entry.structuredPayload, { customField: "customValue", nested: { a: 1, b: 2 } });
});

test("StructuredLogger data takes precedence over structuredPayload when both provided", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "test",
    data: { primary: "data" },
    structuredPayload: { secondary: "payload" },
  });

  // data is assigned to structuredPayload directly, not merged
  assert.deepEqual(entry.data, { primary: "data" });
  assert.deepEqual(entry.structuredPayload, { primary: "data" });
});

test("StructuredLogger handles plane options in constructor", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    plane: "P3",
  });

  const entry = logger.info("test");
  assert.equal(entry.plane, "P3");
});

test("StructuredLogger plane option is used when provided", () => {
  const logger = new StructuredLogger({
    retentionLimit: 10,
    plane: "P3",
    planeSourceFile: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts",
  });

  const entry = logger.info("test");
  // When explicit plane option is provided, it is used
  assert.equal(entry.plane, "P3");
});
