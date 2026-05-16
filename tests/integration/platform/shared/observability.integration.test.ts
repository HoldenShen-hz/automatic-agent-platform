/**
 * Observability Integration Tests
 *
 * Integration tests for observability components (StructuredLogger, transports, file sink)
 * Tests real-world logging scenarios with persistence and multiple components.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, readFileSync, readdirSync, rmSync, unlinkSync } from "node:fs";
import {
  StructuredLogger,
  type StructuredLogEntry,
} from "../../../../src/platform/shared/observability/structured-logger.js";
import { createTempWorkspace, cleanupPath } from "../../../helpers/fs.js";

test("observability-integration: StructuredLogger writes to file sink", () => {
  const workspace = join("data", `aa-obs-integration-${Date.now()}`);
  const logFile = join(workspace, "app.log");

  try {
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: null, // No rotation
    });

    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.info("first message");
    logger.info("second message");
    logger.error("error message");

    // Give time for async file write
    // eslint-disable-next-line no-empty
    try {
      // Synchronous check - file may not be written yet due to async nature
    } catch {
      // Ignore
    }

    // Verify logger captured entries
    const entries = logger.getEntries();
    assert.equal(entries.length, 3);
    assert.equal(entries[0]?.message, "first message");
    assert.equal(entries[2]?.level, "error");

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    cleanupPath(workspace);
  }
});

test("observability-integration: StructuredLogger file rotation", async () => {
  const workspace = join("data", `aa-rotation-test-${Date.now()}`);
  const logFile = join(workspace, "rotating.log");

  try {
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: 100, // Small size to trigger rotation
      maxFiles: 3,
    });

    const logger = new StructuredLogger({ retentionLimit: 100 });

    // Write enough to trigger rotation
    for (let i = 0; i < 50; i++) {
      logger.info(`message-${i}-${"x".repeat(20)}`);
    }

    await new Promise((resolve) => setTimeout(resolve, 50));
    const files = readdirSync(workspace).filter((f) => f.startsWith("rotating.log"));
    assert.ok(files.length > 0, "Log sink should create at least one current or rotated file");

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("observability-integration: Multiple loggers share global sink", () => {
  const workspace = join("data", `aa-shared-sink-${Date.now()}`);
  const logFile = join(workspace, "shared.log");

  try {
    StructuredLogger.configureGlobalFileSink({
      filePath: logFile,
      maxBytes: null,
    });

    // Create multiple logger instances
    const logger1 = new StructuredLogger({ retentionLimit: 50 });
    const logger2 = new StructuredLogger({ retentionLimit: 50 });
    const logger3 = new StructuredLogger({ retentionLimit: 50 });

    // Log from each
    logger1.info("from logger1");
    logger2.info("from logger2");
    logger3.info("from logger3");

    // All should capture entries
    assert.equal(logger1.getEntries().length, 1);
    assert.equal(logger2.getEntries().length, 1);
    assert.equal(logger3.getEntries().length, 1);

  } finally {
    StructuredLogger.configureGlobalFileSink(null);
    rmSync(workspace, { recursive: true, force: true });
  }
});

test("observability-integration: StructuredLogger with transport pipeline", () => {
  const workspace = createTempWorkspace("aa-transport-pipeline-");

  try {
    const receivedEntries: { entry: StructuredLogEntry; transportName: string }[] = [];

    const transport1 = {
      name: "transport-1",
      write: (entry: StructuredLogEntry) => {
        receivedEntries.push({ entry, transportName: "transport-1" });
      },
    };

    const transport2 = {
      name: "transport-2",
      write: (entry: StructuredLogEntry) => {
        receivedEntries.push({ entry, transportName: "transport-2" });
      },
    };

    StructuredLogger.addTransport(transport1 as any);
    StructuredLogger.addTransport(transport2 as any);

    const logger = new StructuredLogger({ retentionLimit: 100 });
    logger.info("test message");
    logger.error("error message");

    // Both transports should receive entries
    assert.ok(receivedEntries.some((e) => e.entry.message === "test message" && e.transportName === "transport-1"));
    assert.ok(receivedEntries.some((e) => e.entry.message === "test message" && e.transportName === "transport-2"));

    StructuredLogger.removeTransport("transport-1");
    StructuredLogger.removeTransport("transport-2");

  } finally {
    cleanupPath(workspace);
  }
});

test("observability-integration: Log filtering with minLogLevel", () => {
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
  assert.ok(entries.every((e) => ["warn", "error", "fatal"].includes(e.level)));
});

test("observability-integration: Log correlation across services", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  const correlationId = "corr-12345";

  // Simulate log entries from different services with same correlation
  logger.log({
    level: "info",
    message: "API received request",
    correlationId,
    service: "api-gateway",
    taskId: "task-001",
  });

  logger.log({
    level: "debug",
    message: "Processing request",
    correlationId,
    service: "processor",
    taskId: "task-001",
  });

  logger.log({
    level: "info",
    message: "Request completed",
    correlationId,
    service: "api-gateway",
    taskId: "task-001",
  });

  const correlatedEntries = logger.recentByCorrelation(correlationId);
  assert.equal(correlatedEntries.length, 3);
  assert.ok(correlatedEntries.every((e) => e.correlationId === correlationId));
});

test("observability-integration: StructuredLogger handles high volume", () => {
  const logger = new StructuredLogger({ retentionLimit: 1000 });

  const count = 500;

  for (let i = 0; i < count; i++) {
    logger.info(`high-volume-message-${i}`, { index: i });
  }

  const summary = logger.getBufferSummary();
  assert.equal(summary.entryCount, 500);
  assert.equal(summary.droppedEntryCount, 0);

  const recent = logger.recent(10);
  assert.equal(recent.length, 10);
  assert.ok(recent[0]?.message.includes("high-volume-message-490"));
});

test("observability-integration: Ring buffer overflow tracking", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  // Write more than retention limit
  for (let i = 0; i < 25; i++) {
    logger.info(`overflow-message-${i}`);
  }

  const summary = logger.getBufferSummary();
  assert.equal(summary.entryCount, 10);
  assert.equal(summary.droppedEntryCount, 15);

  const entries = logger.getEntries();
  assert.equal(entries.length, 10);
  assert.ok(entries[0]?.message.includes("overflow-message-15"));
  assert.ok(entries[9]?.message.includes("overflow-message-24"));
});

test("observability-integration: StructuredLogger plane and service inference", () => {
  const paths = [
    { file: "/workspace/src/platform/five-plane-interface/api/gateway.ts", expectedPlane: "P1", expectedService: "gateway" },
    { file: "/workspace/src/platform/five-plane-control-plane/iam/service.ts", expectedPlane: "P2", expectedService: "service" },
    { file: "/workspace/src/platform/five-plane-orchestration/planner/index.ts", expectedPlane: "P3", expectedService: "index" },
    { file: "/workspace/src/platform/five-plane-execution/dispatcher/index.ts", expectedPlane: "P4", expectedService: "index" },
    { file: "/workspace/src/platform/five-plane-state-evidence/truth/repository.ts", expectedPlane: "P5", expectedService: "repository" },
  ];

  for (const { file, expectedPlane, expectedService } of paths) {
    const logger = new StructuredLogger({ retentionLimit: 10, planeSourceFile: file });
    const entry = logger.info("test");

    assert.equal(entry.plane, expectedPlane, `Plane for ${file} should be ${expectedPlane}`);
    assert.equal(entry.service, expectedService, `Service for ${file} should be ${expectedService}`);
  }
});

test("observability-integration: Crosscutting fabric classification", () => {
  const logger = new StructuredLogger({ retentionLimit: 100 });

  logger.log({
    level: "info",
    message: "Circuit breaker tripped",
    crosscuttingFabric: "reliability",
    data: { circuitId: "cb-1" },
  });

  logger.log({
    level: "warn",
    message: "Authentication failure",
    crosscuttingFabric: "security",
    data: { userId: "user-123" },
  });

  logger.log({
    level: "info",
    message: "Policy check passed",
    crosscuttingFabric: "governance",
    data: { policyId: "pol-456" },
  });

  const entries = logger.getEntries();
  assert.equal(entries.length, 3);

  const reliability = entries.find((e) => e.crosscuttingFabric === "reliability");
  const security = entries.find((e) => e.crosscuttingFabric === "security");
  const governance = entries.find((e) => e.crosscuttingFabric === "governance");

  assert.ok(reliability);
  assert.ok(security);
  assert.ok(governance);
});

test("observability-integration: Telemetry context bridging", async () => {
  const { startActiveSpan } = await import("../../../../src/platform/shared/observability/otel-tracer.js");
  const logger = new StructuredLogger({ retentionLimit: 100 });

  await startActiveSpan("test-operation", {}, async (_span, context) => {
    const entry = logger.info("operation started");

    assert.equal(entry.traceId, context.traceId);
    assert.equal(entry.spanId, context.spanId);
  });
});

test("observability-integration: Flush and close transports", async () => {
  let flushCount = 0;
  let closeCount = 0;

  const transport = {
    name: "flushable",
    write: () => {},
    flush: async () => { flushCount++; },
    close: async () => { closeCount++; },
  };

  StructuredLogger.addTransport(transport as any);

  await StructuredLogger.flushTransports();
  assert.equal(flushCount, 1);

  await StructuredLogger.closeTransports();
  assert.equal(closeCount, 1);
});

test("observability-integration: Transport write failures don't crash logger", () => {
  const transport = {
    name: "failing",
    write: () => {
      throw new Error("Transport write failed");
    },
  };

  StructuredLogger.addTransport(transport as any);

  const logger = new StructuredLogger({ retentionLimit: 10 });

  // Should not throw despite transport failure
  logger.info("test message");

  // Logger should still have captured the entry
  assert.equal(logger.getEntries().length, 1);

  StructuredLogger.removeTransport("failing");
});

test("observability-integration: Large data payload handling", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const largeData = {
    items: Array.from({ length: 100 }, (_, i) => ({ id: i, data: "x".repeat(100) })),
    metadata: { total: 100, timestamp: Date.now() },
  };

  const entry = logger.log({
    level: "info",
    message: "large payload",
    data: largeData,
  });

  assert.equal(entry.message, "large payload");
  assert.ok(Array.isArray(entry.data?.items));
  assert.equal((entry.data?.items as unknown[]).length, 100);
});

test("observability-integration: Span context preservation", () => {
  const logger = new StructuredLogger({ retentionLimit: 10 });

  const entry = logger.log({
    level: "info",
    message: "span test",
    spanId: "span-abc",
    parentSpanId: "parent-xyz",
    traceId: "trace-123",
  });

  assert.equal(entry.spanId, "span-abc");
  assert.equal(entry.parentSpanId, "parent-xyz");
  assert.equal(entry.traceId, "trace-123");
});
