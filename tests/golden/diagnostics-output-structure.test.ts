/**
 * Golden Test: Diagnostics Service Output Structure
 *
 * Verifies diagnostics service builds snapshots with expected structure
 * for task diagnostics, debug dumps, and incident timelines.
 */

import test from "node:test";
import assert from "node:assert/strict";

import { SqliteDatabase } from "../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { DiagnosticsService } from "../../src/platform/shared/observability/diagnostics-service.js";
import { HealthService } from "../../src/platform/shared/observability/health-service.js";
import { InspectService } from "../../src/platform/shared/observability/inspect-service.js";
import { StructuredLogger } from "../../src/platform/shared/observability/structured-logger.js";
import { ObservabilityRetentionService } from "../../src/platform/shared/observability/observability-retention-service.js";
import { seedTaskAndExecution } from "../helpers/seed.js";
import { cleanupPath, createTempWorkspace } from "../helpers/fs.js";
import { assertGolden } from "../helpers/golden.js";
import { newId } from "../../src/platform/contracts/types/ids.js";

test("golden: diagnostics task snapshot has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-snapshot-");

  const dbPath = `${workspace}/diag-snapshot.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "diag_snapshot_task_001";
  const executionId = "diag_snapshot_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "diag-trace" });

  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const retention = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(inspect, health, logger, retention);

  const snapshot = diagnostics.buildTaskSnapshot(taskId);

  // Verify top-level structure
  assert.ok(snapshot, "Snapshot should exist");
  assert.equal(snapshot.taskId, taskId, "Task ID should match");
  assert.ok(snapshot.traceSummary, "Trace summary should exist");
  assert.ok(snapshot.inspect, "Inspect view should exist");
  assert.ok(Array.isArray(snapshot.timeline), "Timeline should be array");
  assert.ok(Array.isArray(snapshot.recentLogs), "Recent logs should be array");
  assert.ok(snapshot.health, "Health should exist");
  assert.ok(snapshot.systemInfo, "System info should exist");
  assert.ok(snapshot.contextSummary, "Context summary should exist");

  assertGolden("diagnostics-task-snapshot", {
    taskId: snapshot.taskId,
    hasTraceSummary: snapshot.traceSummary !== null,
    hasInspect: snapshot.inspect !== null,
    timelineCount: snapshot.timeline.length,
    logCount: snapshot.recentLogs.length,
    contextSummary: {
      messageCount: snapshot.contextSummary.messageCount,
      hasRemoteRouting: snapshot.contextSummary.remoteRouting !== null,
      hasLeaseHandover: snapshot.contextSummary.leaseHandover !== null,
    },
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics debug dump has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-debug-");

  const dbPath = `${workspace}/diag-debug.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "diag_debug_task_001";
  const executionId = "diag_debug_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "debug-trace" });

  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const retention = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(inspect, health, logger, retention);

  const dump = diagnostics.buildDebugDump(taskId);

  // Verify structure
  assert.ok(dump, "Debug dump should exist");
  assert.equal(dump.taskId, taskId);
  assert.ok(dump.traceId !== undefined, "Should have traceId field");
  assert.ok(dump.traceContext, "Trace context should exist");
  assert.ok(dump.stateSnapshots, "State snapshots should exist");
  assert.ok(Array.isArray(dump.eventTail), "Event tail should be array");
  assert.ok(dump.providerStatus, "Provider status should exist");
  assert.ok(dump.backpressure, "Backpressure should exist");
  assert.ok(Array.isArray(dump.warnings), "Warnings should be array");
  assert.ok(dump.warningSummary, "Warning summary should exist");

  assertGolden("diagnostics-debug-dump", {
    taskId: dump.taskId,
    hasTraceId: dump.traceId !== null,
    stateSnapshots: {
      hasTaskStatus: dump.stateSnapshots.taskStatus !== null,
      hasExecutionStatus: dump.stateSnapshots.executionStatus !== null,
    },
    eventTailCount: dump.eventTail.length,
    warningCount: dump.warnings.length,
    hasWarningSummary: dump.warningSummary !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics incident timeline has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-timeline-");

  const dbPath = `${workspace}/diag-timeline.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "diag_timeline_task_001";
  const executionId = "diag_timeline_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "timeline-trace" });

  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const retention = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(inspect, health, logger, retention);

  const timeline = diagnostics.buildIncidentTimelineReport(taskId);

  // Verify structure
  assert.ok(timeline, "Timeline should exist");
  assert.equal(timeline.taskId, taskId);
  assert.ok(timeline.traceSummary, "Trace summary should exist");
  assert.ok(timeline.window, "Window should exist");
  assert.ok(timeline.summary, "Summary should exist");
  assert.ok(timeline.warnings, "Warnings should exist");
  assert.ok(Array.isArray(timeline.entries), "Entries should be array");
  assert.ok(Array.isArray(timeline.candidateRootCauses), "Root causes should be array");

  assertGolden("diagnostics-incident-timeline", {
    taskId: timeline.taskId,
    window: {
      hasStartedAt: timeline.window.startedAt !== null,
      hasEndedAt: timeline.window.endedAt !== null,
    },
    summary: {
      totalEntries: timeline.summary.totalEntries,
      eventCount: timeline.summary.eventCount,
      dispatchCount: timeline.summary.dispatchCount,
      hasHighestSeverity: timeline.summary.highestSeverity !== null,
    },
    entriesCount: timeline.entries.length,
    rootCausesCount: timeline.candidateRootCauses.length,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics minimal repro bundle has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-repro-");

  const dbPath = `${workspace}/diag-repro.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "diag_repro_task_001";
  const executionId = "diag_repro_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "repro-trace" });

  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const retention = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(inspect, health, logger, retention);

  const bundle = diagnostics.buildMinimalReproBundle(taskId);

  // Verify structure
  assert.ok(bundle, "Bundle should exist");
  assert.equal(bundle.taskId, taskId);
  assert.ok(bundle.sensitivityWarning, "Should have sensitivity warning");
  assert.ok(bundle.taskInputJson !== undefined, "Task input should exist");
  assert.ok(Array.isArray(bundle.relevantMessages), "Relevant messages should be array");
  assert.ok(Array.isArray(bundle.toolUsage), "Tool usage should be array");
  assert.ok(Array.isArray(bundle.sanitizedArtifacts), "Sanitized artifacts should be array");
  assert.ok(bundle.configSubset, "Config subset should exist");
  assert.ok(bundle.providerStatus, "Provider status should exist");

  assertGolden("diagnostics-minimal-repro", {
    taskId: bundle.taskId,
    hasSensitivityWarning: bundle.sensitivityWarning.length > 0,
    messageCount: bundle.relevantMessages.length,
    toolUsageCount: bundle.toolUsage.length,
    artifactCount: bundle.sanitizedArtifacts.length,
    hasConfigSubset: bundle.configSubset !== null,
  });

  db.close();
  cleanupPath(workspace);
});

test("golden: diagnostics remote timeline has expected structure", () => {
  const workspace = createTempWorkspace("aa-golden-diag-remote-");

  const dbPath = `${workspace}/diag-remote.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);

  const taskId = "diag_remote_task_001";
  const executionId = "diag_remote_exec_001";
  seedTaskAndExecution(db, store, { taskId, executionId, traceId: "remote-trace" });

  const inspect = new InspectService(store);
  const health = new HealthService(db, store);
  const logger = new StructuredLogger({ retentionLimit: 50 });
  const retention = new ObservabilityRetentionService(db);
  const diagnostics = new DiagnosticsService(inspect, health, logger, retention);

  const remoteTimeline = diagnostics.buildRemoteTimelineReport(taskId);

  // Verify structure
  assert.ok(remoteTimeline, "Remote timeline should exist");
  assert.equal(remoteTimeline.taskId, taskId);
  assert.ok(remoteTimeline.traceSummary, "Trace summary should exist");
  assert.ok(typeof remoteTimeline.totalEntries === "number", "Total entries should be number");
  assert.ok(typeof remoteTimeline.totalRemoteLogs === "number", "Total remote logs should be number");
  assert.ok(Array.isArray(remoteTimeline.entries), "Entries should be array");
  assert.ok(Array.isArray(remoteTimeline.remoteWorkerIds), "Worker IDs should be array");

  assertGolden("diagnostics-remote-timeline", {
    taskId: remoteTimeline.taskId,
    totalEntries: remoteTimeline.totalEntries,
    totalRemoteLogs: remoteTimeline.totalRemoteLogs,
    entriesCount: remoteTimeline.entries.length,
    workerIdCount: remoteTimeline.remoteWorkerIds.length,
  });

  db.close();
  cleanupPath(workspace);
});
