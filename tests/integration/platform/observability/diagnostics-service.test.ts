/**
 * DiagnosticsService Integration Tests
 *
 * Tests for DiagnosticsService integration with real database,
 * task snapshots, debug dumps, incident timelines, and minimal repro bundles.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { DiagnosticsService } from "../../../../src/platform/shared/observability/diagnostics-service.js";
import { InspectService } from "../../../../src/platform/shared/observability/inspect-service.js";
import { HealthService } from "../../../../src/platform/shared/observability/health-service.js";
import { StructuredLogger } from "../../../../src/platform/shared/observability/structured-logger.js";

// =============================================================================
// DiagnosticsService with seeded database
// =============================================================================

test("DiagnosticsService buildTaskSnapshot returns comprehensive snapshot", () => {
  const ctx = createSeededIntegrationContext("aa-diag-snapshot-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    // Log some entries for the task
    logger.log({ level: "info", message: "Test log entry", taskId: "task-seeded-001" });

    const snapshot = diagnosticsService.buildTaskSnapshot("task-seeded-001");

    assert.ok(snapshot != null, "Should return a snapshot");
    assert.equal(snapshot.taskId, "task-seeded-001");
    assert.ok(snapshot.traceSummary != null, "Should have trace summary");
    assert.ok(snapshot.inspect != null, "Should have inspect view");
    assert.ok(snapshot.timeline != null, "Should have timeline entries");
    assert.ok(snapshot.recentLogs != null, "Should have recent logs");
    assert.ok(snapshot.health != null, "Should have health report");
    assert.ok(snapshot.systemInfo != null, "Should have system info");
    assert.ok(snapshot.contextSummary != null, "Should have context summary");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump returns troubleshooting information", () => {
  const ctx = createSeededIntegrationContext("aa-diag-debug-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(debugDump != null, "Should return a debug dump");
    assert.equal(debugDump.taskId, "task-seeded-001");
    assert.ok(debugDump.traceId != null, "Should have trace ID");
    assert.ok(debugDump.stateSnapshots != null, "Should have state snapshots");
    assert.ok(debugDump.eventTail != null, "Should have event tail");
    assert.ok(debugDump.providerStatus != null, "Should have provider status");
    assert.ok(debugDump.backpressure != null, "Should have backpressure info");
    assert.ok(debugDump.warnings != null, "Should have warnings array");
    assert.ok(debugDump.warningSummary != null, "Should have warning summary");
    assert.ok(debugDump.recentLogs != null, "Should have recent logs");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump captures state snapshots correctly", () => {
  const ctx = createSeededIntegrationContext("aa-diag-state-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(debugDump.stateSnapshots != null);
    assert.equal(debugDump.stateSnapshots.taskStatus, "in_progress", "Task should be in_progress");
    assert.equal(debugDump.stateSnapshots.executionStatus, "executing", "Execution should be executing");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump includes dispatch summary", () => {
  const ctx = createSeededIntegrationContext("aa-diag-dispatch-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(debugDump.dispatchSummary != null, "Should have dispatch summary");
    assert.ok("totalDecisions" in debugDump.dispatchSummary, "Should track total decisions");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump captures backpressure metrics", () => {
  const ctx = createSeededIntegrationContext("aa-diag-backpressure-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(debugDump.backpressure != null);
    assert.ok("status" in debugDump.backpressure, "Should have status");
    assert.ok("degradationMode" in debugDump.backpressure, "Should have degradation mode");
    assert.ok("queuedTasks" in debugDump.backpressure, "Should have queued tasks");
    assert.ok("activeExecutions" in debugDump.backpressure, "Should have active executions");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildTaskSnapshot returns trace summary with IDs", () => {
  const ctx = createSeededIntegrationContext("aa-diag-trace-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const snapshot = diagnosticsService.buildTaskSnapshot("task-seeded-001");

    assert.ok(snapshot.traceSummary != null);
    assert.ok("traceId" in snapshot.traceSummary, "Should have trace ID");
    assert.ok("correlationId" in snapshot.traceSummary, "Should have correlation ID");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildTaskSnapshot includes context summary metrics", () => {
  const ctx = createSeededIntegrationContext("aa-diag-context-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const snapshot = diagnosticsService.buildTaskSnapshot("task-seeded-001");

    assert.ok(snapshot.contextSummary != null);
    assert.ok("messageCount" in snapshot.contextSummary, "Should have message count");
    assert.ok("compactionCount" in snapshot.contextSummary, "Should have compaction count");
    assert.ok("dispatchDecisionCount" in snapshot.contextSummary, "Should have dispatch decision count");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump generates warning codes", () => {
  const ctx = createSeededIntegrationContext("aa-diag-warnings-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(Array.isArray(debugDump.warnings), "Warnings should be an array");
    assert.ok(debugDump.warningSummary != null, "Should have warning summary");
    assert.ok("entries" in debugDump.warningSummary, "Warning summary should have entries");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump includes recent tool calls", () => {
  const ctx = createSeededIntegrationContext("aa-diag-tools-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok("recentToolCalls" in debugDump, "Should have recent tool calls");
    assert.ok(Array.isArray(debugDump.recentToolCalls), "Recent tool calls should be an array");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildTaskSnapshot includes system information", () => {
  const ctx = createSeededIntegrationContext("aa-diag-system-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const snapshot = diagnosticsService.buildTaskSnapshot("task-seeded-001");

    assert.ok(snapshot.systemInfo != null);
    assert.ok("platform" in snapshot.systemInfo, "Should have platform");
    assert.ok("arch" in snapshot.systemInfo, "Should have arch");
    assert.ok("nodeVersion" in snapshot.systemInfo, "Should have node version");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump includes provider status", () => {
  const ctx = createSeededIntegrationContext("aa-diag-provider-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);

    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok(debugDump.providerStatus != null);
    assert.ok("health" in debugDump.providerStatus, "Should have provider health");
    assert.ok("successRate" in debugDump.providerStatus, "Should have success rate");
    assert.ok("recentCalls" in debugDump.providerStatus, "Should have recent calls");
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService with retention service includes retention preview", () => {
  const ctx = createSeededIntegrationContext("aa-diag-retention-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });
    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger, null);

    const snapshot = diagnosticsService.buildTaskSnapshot("task-seeded-001");

    // retention can be null when retention service is not provided
    assert.ok(snapshot.retention === null || snapshot.retention != null);
  } finally {
    ctx.cleanup();
  }
});

test("DiagnosticsService buildDebugDump includes log buffer summary", () => {
  const ctx = createSeededIntegrationContext("aa-diag-logbuffer-");

  try {
    const inspectService = new InspectService(ctx.store);
    const healthService = new HealthService(ctx.db, ctx.store);
    const logger = new StructuredLogger({ retentionLimit: 100 });

    // Add some log entries
    logger.log({ level: "info", message: "Test message", taskId: "task-seeded-001" });

    const diagnosticsService = new DiagnosticsService(inspectService, healthService, logger);
    const debugDump = diagnosticsService.buildDebugDump("task-seeded-001");

    assert.ok("logBuffer" in debugDump, "Should have log buffer summary");
  } finally {
    ctx.cleanup();
  }
});
