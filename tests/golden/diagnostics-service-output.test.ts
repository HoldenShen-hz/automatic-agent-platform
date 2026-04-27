/**
 * Golden Test: Diagnostics Service Output Structure
 *
 * Verifies diagnostics service produces consistent diagnostic snapshots,
 * debug dumps, and incident timeline reports for troubleshooting.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { DiagnosticsService } from "../../src/platform/shared/observability/diagnostics-service.js";
import { StructuredLogger } from "../../src/platform/shared/observability/structured-logger.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";

test("golden: diagnostics buildTaskSnapshot has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-snapshot-");

  const dbPath = `${workspace}/diag-snapshot.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const service = new DiagnosticsService(inspect, health, logger);

  const taskId = "diag_snapshot_task_001";
  const executionId = "diag_snapshot_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "diag-trace" });

  const snapshot = service.buildTaskSnapshot(taskId);

  // Verify top-level structure
  assert.ok(snapshot, "Snapshot should exist");
  assert.ok(snapshot.taskId === taskId, "Task ID should match");
  assert.ok(snapshot.traceSummary, "Should have traceSummary");
  assert.ok(snapshot.inspect, "Should have inspect");
  assert.ok(Array.isArray(snapshot.timeline), "Timeline should be array");
  assert.ok(Array.isArray(snapshot.recentLogs), "Recent logs should be array");
  assert.ok(snapshot.health, "Should have health");
  assert.ok(snapshot.systemInfo, "Should have systemInfo");
  assert.ok(snapshot.contextSummary, "Should have contextSummary");

  assertGolden("diagnostics-task-snapshot-structure", {
    taskId: snapshot.taskId,
    hasTraceSummary: snapshot.traceSummary !== undefined,
    hasInspect: snapshot.inspect !== undefined,
    timelineEntryCount: snapshot.timeline.length,
    recentLogCount: snapshot.recentLogs.length,
    hasHealth: snapshot.health !== undefined,
    hasSystemInfo: snapshot.systemInfo !== undefined,
    hasContextSummary: snapshot.contextSummary !== undefined,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics buildDebugDump has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-debug-");

  const dbPath = `${workspace}/diag-debug.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const service = new DiagnosticsService(inspect, health, logger);

  const taskId = "diag_debug_task_001";
  const executionId = "diag_debug_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "debug-trace" });

  const dump = service.buildDebugDump(taskId);

  // Verify top-level structure
  assert.ok(dump, "Debug dump should exist");
  assert.ok(dump.taskId === taskId, "Task ID should match");
  assert.ok(dump.traceContext !== undefined, "Should have traceContext");
  assert.ok(Array.isArray(dump.recentLogs), "Recent logs should be array");
  assert.ok(dump.stateSnapshots, "Should have stateSnapshots");
  assert.ok(Array.isArray(dump.eventTail), "Event tail should be array");
  assert.ok(dump.providerStatus, "Should have providerStatus");
  assert.ok(dump.backpressure, "Should have backpressure");
  assert.ok(dump.contextSummary, "Should have contextSummary");
  assert.ok(dump.dispatchSummary, "Should have dispatchSummary");
  assert.ok(dump.leaseSummary !== undefined, "Should have leaseSummary");
  assert.ok(Array.isArray(dump.warnings), "Warnings should be array");
  assert.ok(dump.warningSummary, "Should have warningSummary");

  assertGolden("diagnostics-debug-dump-structure", {
    taskId: dump.taskId,
    hasTraceContext: dump.traceContext !== undefined,
    recentLogCount: dump.recentLogs.length,
    hasStateSnapshots: dump.stateSnapshots !== undefined,
    eventTailCount: dump.eventTail.length,
    hasProviderStatus: dump.providerStatus !== undefined,
    hasBackpressure: dump.backpressure !== undefined,
    hasContextSummary: dump.contextSummary !== undefined,
    hasDispatchSummary: dump.dispatchSummary !== undefined,
    warningCount: dump.warnings.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics buildIncidentTimelineReport has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-timeline-");

  const dbPath = `${workspace}/diag-timeline.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const service = new DiagnosticsService(inspect, health, logger);

  const taskId = "diag_timeline_task_001";
  const executionId = "diag_timeline_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "timeline-trace" });

  const report = service.buildIncidentTimelineReport(taskId);

  // Verify top-level structure
  assert.ok(report, "Report should exist");
  assert.ok(report.taskId === taskId, "Task ID should match");
  assert.ok(report.traceSummary, "Should have traceSummary");
  assert.ok(report.window, "Should have window");
  assert.ok(report.summary, "Should have summary");
  assert.ok(report.warnings, "Should have warnings");
  assert.ok(Array.isArray(report.candidateRootCauses), "Root causes should be array");
  assert.ok(Array.isArray(report.entries), "Entries should be array");

  // Verify summary counts
  assert.ok(typeof report.summary.totalEntries === "number", "Total entries should be number");
  assert.ok(typeof report.summary.eventCount === "number", "Event count should be number");
  assert.ok(typeof report.summary.dispatchCount === "number", "Dispatch count should be number");
  assert.ok(typeof report.summary.stepOutputCount === "number", "Step output count should be number");
  assert.ok(typeof report.summary.approvalCount === "number", "Approval count should be number");
  assert.ok(typeof report.summary.artifactCount === "number", "Artifact count should be number");
  assert.ok(typeof report.summary.logCount === "number", "Log count should be number");

  assertGolden("diagnostics-incident-timeline-structure", {
    taskId: report.taskId,
    hasTraceSummary: report.traceSummary !== undefined,
    hasWindow: report.window !== undefined,
    hasSummary: report.summary !== undefined,
    totalEntries: report.summary.totalEntries,
    eventCount: report.summary.eventCount,
    dispatchCount: report.summary.dispatchCount,
    stepOutputCount: report.summary.stepOutputCount,
    hasWarnings: report.warnings !== undefined,
    rootCauseCount: report.candidateRootCauses.length,
    entryCount: report.entries.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics buildMinimalReproBundle has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-repro-");

  const dbPath = `${workspace}/diag-repro.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const service = new DiagnosticsService(inspect, health, logger);

  const taskId = "diag_repro_task_001";
  const executionId = "diag_repro_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "repro-trace" });

  const bundle = service.buildMinimalReproBundle(taskId);

  // Verify top-level structure
  assert.ok(bundle, "Bundle should exist");
  assert.ok(bundle.taskId === taskId, "Task ID should match");
  assert.ok(typeof bundle.sensitivityWarning === "string", "Sensitivity warning should be string");
  assert.ok(bundle.taskInputJson !== undefined, "Should have taskInputJson");
  assert.ok(bundle.workflowState !== undefined, "Should have workflowState");
  assert.ok(bundle.taskResult !== undefined, "Should have taskResult");
  assert.ok(Array.isArray(bundle.relevantMessages), "Relevant messages should be array");
  assert.ok(Array.isArray(bundle.toolUsage), "Tool usage should be array");
  assert.ok(Array.isArray(bundle.sanitizedArtifacts), "Sanitized artifacts should be array");
  assert.ok(Array.isArray(bundle.fileLocks), "File locks should be array");
  assert.ok(bundle.configSubset, "Should have configSubset");
  assert.ok(bundle.providerStatus, "Should have providerStatus");
  assert.ok(Array.isArray(bundle.dispatchDecisions), "Dispatch decisions should be array");

  assertGolden("diagnostics-minimal-repro-structure", {
    taskId: bundle.taskId,
    hasSensitivityWarning: bundle.sensitivityWarning.length > 0,
    hasTaskInputJson: bundle.taskInputJson !== undefined,
    hasWorkflowState: bundle.workflowState !== null,
    hasTaskResult: bundle.taskResult !== null,
    relevantMessageCount: bundle.relevantMessages.length,
    toolUsageCount: bundle.toolUsage.length,
    sanitizedArtifactCount: bundle.sanitizedArtifacts.length,
    fileLockCount: bundle.fileLocks.length,
    hasConfigSubset: bundle.configSubset !== undefined,
    hasProviderStatus: bundle.providerStatus !== undefined,
    dispatchDecisionCount: bundle.dispatchDecisions.length,
  });

  db.close();
  cleanupPath(workspace);
});
