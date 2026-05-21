/**
 * Unit tests for Health Contract Types
 *
 * @see src/platform/contracts/types/health.ts
 */

import assert from "node:assert/strict";
import test from "node:test";
import {
  createNoOpHealthReportProvider,
  type HealthReportProvider,
  type HealthStatusReport,
  type HealthStatusLevel,
  type DegradationMode,
  type QueueGovernanceHealthSummary,
  type BackpressureHealthSummary,
  type WorkerHealthSummary,
} from "../../../../../src/platform/contracts/types/health.js";

// ─────────────────────────────────────────────────────────────────────────────
// HealthStatusLevel Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HealthStatusLevel has correct values", () => {
  const levels: HealthStatusLevel[] = ["ok", "degraded", "overloaded", "unhealthy"];

  assert.equal(levels.length, 4);
  assert.ok(levels.includes("ok"));
  assert.ok(levels.includes("degraded"));
  assert.ok(levels.includes("overloaded"));
  assert.ok(levels.includes("unhealthy"));
});

// ─────────────────────────────────────────────────────────────────────────────
// DegradationMode Tests
// ─────────────────────────────────────────────────────────────────────────────

test("DegradationMode has correct values", () => {
  const modes: DegradationMode[] = [
    "none",
    "queue_only",
    "fast_only",
    "pause_non_critical",
    "read_only_operations_only",
  ];

  assert.equal(modes.length, 5);
  assert.ok(modes.includes("none"));
  assert.ok(modes.includes("queue_only"));
  assert.ok(modes.includes("fast_only"));
  assert.ok(modes.includes("pause_non_critical"));
  assert.ok(modes.includes("read_only_operations_only"));
});

// ─────────────────────────────────────────────────────────────────────────────
// QueueGovernanceHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

test("QueueGovernanceHealthSummary structure is correct", () => {
  const summary: QueueGovernanceHealthSummary = {
    backlogSize: 10,
    dispatchableBacklogSize: 5,
    claimedBacklogSize: 3,
    oldestWaitSeconds: 120,
    oldestClaimAgeSeconds: 60,
    queueNames: ["default", "priority"],
    starvationDetected: false,
  };

  assert.equal(summary.backlogSize, 10);
  assert.equal(summary.dispatchableBacklogSize, 5);
  assert.equal(summary.claimedBacklogSize, 3);
  assert.equal(summary.oldestWaitSeconds, 120);
  assert.equal(summary.oldestClaimAgeSeconds, 60);
  assert.deepEqual(summary.queueNames, ["default", "priority"]);
  assert.equal(summary.starvationDetected, false);
});

test("QueueGovernanceHealthSummary allows null age values", () => {
  const summary: QueueGovernanceHealthSummary = {
    backlogSize: 0,
    dispatchableBacklogSize: 0,
    claimedBacklogSize: 0,
    oldestWaitSeconds: null,
    oldestClaimAgeSeconds: null,
    queueNames: [],
    starvationDetected: false,
  };

  assert.equal(summary.oldestWaitSeconds, null);
  assert.equal(summary.oldestClaimAgeSeconds, null);
  assert.deepEqual(summary.queueNames, []);
});

test("QueueGovernanceHealthSummary allows empty queue names", () => {
  const summary: QueueGovernanceHealthSummary = {
    backlogSize: 0,
    dispatchableBacklogSize: 0,
    claimedBacklogSize: 0,
    oldestWaitSeconds: null,
    oldestClaimAgeSeconds: null,
    queueNames: [],
    starvationDetected: false,
  };

  assert.ok(Array.isArray(summary.queueNames));
  assert.equal(summary.queueNames.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// BackpressureHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

test("BackpressureHealthSummary structure is correct", () => {
  const summary: BackpressureHealthSummary = {
    status: "ok",
    degradationMode: "none",
    tier1AckBacklog: 5,
    queueGovernance: {
      backlogSize: 10,
      dispatchableBacklogSize: 5,
      claimedBacklogSize: 3,
      oldestWaitSeconds: 120,
      oldestClaimAgeSeconds: 60,
      queueNames: ["default"],
      starvationDetected: false,
    },
  };

  assert.equal(summary.status, "ok");
  assert.equal(summary.degradationMode, "none");
  assert.equal(summary.tier1AckBacklog, 5);
  assert.ok("queueGovernance" in summary);
});

test("BackpressureHealthSummary with degraded status", () => {
  const summary: BackpressureHealthSummary = {
    status: "degraded",
    degradationMode: "queue_only",
    tier1AckBacklog: 15,
    queueGovernance: {
      backlogSize: 20,
      dispatchableBacklogSize: 15,
      claimedBacklogSize: 5,
      oldestWaitSeconds: 300,
      oldestClaimAgeSeconds: 180,
      queueNames: ["default", "priority"],
      starvationDetected: true,
    },
  };

  assert.equal(summary.status, "degraded");
  assert.equal(summary.degradationMode, "queue_only");
  assert.ok(summary.queueGovernance.starvationDetected);
});

// ─────────────────────────────────────────────────────────────────────────────
// WorkerHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

test("WorkerHealthSummary structure is correct", () => {
  const summary: WorkerHealthSummary = {
    totalWorkers: 10,
    healthyWorkers: 8,
    busyWorkers: 3,
    drainingWorkers: 1,
    degradedWorkers: 1,
    quarantinedWorkers: 0,
    offlineWorkers: 0,
    remoteWorkers: 5,
    remoteConnectedWorkers: 4,
    remoteReconnectingWorkers: 1,
    remoteDegradedSessions: 0,
    remoteFailedSessions: 0,
    remoteViewerOnlyWorkers: 0,
    remoteConsistencyMismatchWorkers: 0,
    remoteWorkspaceSyncConflictWorkers: 0,
    remoteOffsetMissingWorkers: 0,
    staleWorkers: 0,
    staleBusyWorkers: 0,
    loadSkewDetected: false,
    dominantWorkerId: null,
    dominantWorkerShare: null,
    skewedWorkerIds: [],
  };

  assert.equal(summary.totalWorkers, 10);
  assert.equal(summary.healthyWorkers, 8);
  assert.equal(summary.busyWorkers, 3);
  assert.equal(summary.drainingWorkers, 1);
  assert.equal(summary.degradedWorkers, 1);
  assert.equal(summary.quarantinedWorkers, 0);
  assert.equal(summary.offlineWorkers, 0);
  assert.equal(summary.remoteWorkers, 5);
  assert.equal(summary.remoteConnectedWorkers, 4);
  assert.equal(summary.loadSkewDetected, false);
});

test("WorkerHealthSummary with load skew detected", () => {
  const summary: WorkerHealthSummary = {
    totalWorkers: 10,
    healthyWorkers: 10,
    busyWorkers: 5,
    drainingWorkers: 0,
    degradedWorkers: 0,
    quarantinedWorkers: 0,
    offlineWorkers: 0,
    remoteWorkers: 0,
    remoteConnectedWorkers: 0,
    remoteReconnectingWorkers: 0,
    remoteDegradedSessions: 0,
    remoteFailedSessions: 0,
    remoteViewerOnlyWorkers: 0,
    remoteConsistencyMismatchWorkers: 0,
    remoteWorkspaceSyncConflictWorkers: 0,
    remoteOffsetMissingWorkers: 0,
    staleWorkers: 2,
    staleBusyWorkers: 1,
    loadSkewDetected: true,
    dominantWorkerId: "worker-1",
    dominantWorkerShare: 0.6,
    skewedWorkerIds: ["worker-1", "worker-2"],
  };

  assert.equal(summary.loadSkewDetected, true);
  assert.equal(summary.dominantWorkerId, "worker-1");
  assert.equal(summary.dominantWorkerShare, 0.6);
  assert.deepEqual(summary.skewedWorkerIds, ["worker-1", "worker-2"]);
  assert.equal(summary.staleWorkers, 2);
  assert.equal(summary.staleBusyWorkers, 1);
});

test("WorkerHealthSummary all zero workers", () => {
  const summary: WorkerHealthSummary = {
    totalWorkers: 0,
    healthyWorkers: 0,
    busyWorkers: 0,
    drainingWorkers: 0,
    degradedWorkers: 0,
    quarantinedWorkers: 0,
    offlineWorkers: 0,
    remoteWorkers: 0,
    remoteConnectedWorkers: 0,
    remoteReconnectingWorkers: 0,
    remoteDegradedSessions: 0,
    remoteFailedSessions: 0,
    remoteViewerOnlyWorkers: 0,
    remoteConsistencyMismatchWorkers: 0,
    remoteWorkspaceSyncConflictWorkers: 0,
    remoteOffsetMissingWorkers: 0,
    staleWorkers: 0,
    staleBusyWorkers: 0,
    loadSkewDetected: false,
    dominantWorkerId: null,
    dominantWorkerShare: null,
    skewedWorkerIds: [],
  };

  assert.equal(summary.totalWorkers, 0);
  assert.equal(summary.healthyWorkers, 0);
  assert.deepEqual(summary.skewedWorkerIds, []);
  assert.equal(summary.dominantWorkerId, null);
});

// ─────────────────────────────────────────────────────────────────────────────
// HealthStatusReport Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HealthStatusReport structure is correct", () => {
  const report: HealthStatusReport = {
    status: "ok",
    uptimeSeconds: 3600,
    dbWritable: true,
    providerHealth: "healthy",
    providerSuccessRate: 0.98,
    providerRecentCalls: 100,
    activeExecutions: 5,
    queuedTasks: 10,
    eventLoopLagMs: 50,
    memoryRssMb: 512,
    tier1AckBacklog: 2,
    degradationMode: "none",
    backpressure: {
      status: "ok",
      degradationMode: "none",
      tier1AckBacklog: 2,
      queueGovernance: {
        backlogSize: 10,
        dispatchableBacklogSize: 5,
        claimedBacklogSize: 3,
        oldestWaitSeconds: 120,
        oldestClaimAgeSeconds: 60,
        queueNames: ["default"],
        starvationDetected: false,
      },
    },
    queueGovernance: {
      backlogSize: 10,
      dispatchableBacklogSize: 5,
      claimedBacklogSize: 3,
      oldestWaitSeconds: 120,
      oldestClaimAgeSeconds: 60,
      queueNames: ["default"],
      starvationDetected: false,
    },
    workerHealth: {
      totalWorkers: 10,
      healthyWorkers: 8,
      busyWorkers: 3,
      drainingWorkers: 1,
      degradedWorkers: 1,
      quarantinedWorkers: 0,
      offlineWorkers: 0,
      remoteWorkers: 5,
      remoteConnectedWorkers: 4,
      remoteReconnectingWorkers: 1,
      remoteDegradedSessions: 0,
      remoteFailedSessions: 0,
      remoteViewerOnlyWorkers: 0,
      remoteConsistencyMismatchWorkers: 0,
      remoteWorkspaceSyncConflictWorkers: 0,
      remoteOffsetMissingWorkers: 0,
      staleWorkers: 0,
      staleBusyWorkers: 0,
      loadSkewDetected: false,
      dominantWorkerId: null,
      dominantWorkerShare: null,
      skewedWorkerIds: [],
    },
    findings: [],
  };

  assert.equal(report.status, "ok");
  assert.equal(report.uptimeSeconds, 3600);
  assert.equal(report.dbWritable, true);
  assert.equal(report.providerHealth, "healthy");
  assert.equal(report.providerSuccessRate, 0.98);
  assert.equal(report.providerRecentCalls, 100);
  assert.equal(report.activeExecutions, 5);
  assert.equal(report.queuedTasks, 10);
  assert.equal(report.eventLoopLagMs, 50);
  assert.equal(report.memoryRssMb, 512);
  assert.equal(report.degradationMode, "none");
  assert.deepEqual(report.findings, []);
});

test("HealthStatusReport with findings", () => {
  const report: HealthStatusReport = {
    status: "degraded",
    uptimeSeconds: 3600,
    dbWritable: true,
    providerHealth: "degraded",
    providerSuccessRate: 0.75,
    providerRecentCalls: 100,
    activeExecutions: 5,
    queuedTasks: 10,
    eventLoopLagMs: 50,
    memoryRssMb: 512,
    tier1AckBacklog: 2,
    degradationMode: "queue_only",
    backpressure: {
      status: "degraded",
      degradationMode: "queue_only",
      tier1AckBacklog: 2,
      queueGovernance: {
        backlogSize: 10,
        dispatchableBacklogSize: 5,
        claimedBacklogSize: 3,
        oldestWaitSeconds: 120,
        oldestClaimAgeSeconds: 60,
        queueNames: ["default"],
        starvationDetected: false,
      },
    },
    queueGovernance: {
      backlogSize: 10,
      dispatchableBacklogSize: 5,
      claimedBacklogSize: 3,
      oldestWaitSeconds: 120,
      oldestClaimAgeSeconds: 60,
      queueNames: ["default"],
      starvationDetected: false,
    },
    workerHealth: {
      totalWorkers: 10,
      healthyWorkers: 8,
      busyWorkers: 3,
      drainingWorkers: 1,
      degradedWorkers: 1,
      quarantinedWorkers: 0,
      offlineWorkers: 0,
      remoteWorkers: 5,
      remoteConnectedWorkers: 4,
      remoteReconnectingWorkers: 1,
      remoteDegradedSessions: 0,
      remoteFailedSessions: 0,
      remoteViewerOnlyWorkers: 0,
      remoteConsistencyMismatchWorkers: 0,
      remoteWorkspaceSyncConflictWorkers: 0,
      remoteOffsetMissingWorkers: 0,
      staleWorkers: 0,
      staleBusyWorkers: 0,
      loadSkewDetected: false,
      dominantWorkerId: null,
      dominantWorkerShare: null,
      skewedWorkerIds: [],
    },
    findings: ["provider_degraded", "queue_backlog_degraded"],
  };

  assert.equal(report.status, "degraded");
  assert.deepEqual(report.findings, ["provider_degraded", "queue_backlog_degraded"]);
});

// ─────────────────────────────────────────────────────────────────────────────
// createNoOpHealthReportProvider Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createNoOpHealthReportProvider returns HealthReportProvider", () => {
  const provider = createNoOpHealthReportProvider();
  assert.ok(typeof provider === "object");
  assert.ok("getReport" in provider);
});

test("createNoOpHealthReportProvider.getReport is a function", () => {
  const provider = createNoOpHealthReportProvider();
  assert.ok(typeof provider.getReport === "function");
});

test("createNoOpHealthReportProvider returns healthy status", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.status, "ok");
});

test("createNoOpHealthReportProvider returns zero uptime", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.uptimeSeconds, 0);
});

test("createNoOpHealthReportProvider returns dbWritable as true", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.dbWritable, true);
});

test("createNoOpHealthReportProvider returns healthy provider status", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.providerHealth, "healthy");
});

test("createNoOpHealthReportProvider returns 100% success rate", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.providerSuccessRate, 1);
});

test("createNoOpHealthReportProvider returns zero recent calls", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.providerRecentCalls, 0);
});

test("createNoOpHealthReportProvider returns zero active executions", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.activeExecutions, 0);
});

test("createNoOpHealthReportProvider returns zero queued tasks", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.queuedTasks, 0);
});

test("createNoOpHealthReportProvider returns null event loop lag", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.eventLoopLagMs, null);
});

test("createNoOpHealthReportProvider returns zero memory RSS", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.memoryRssMb, 0);
});

test("createNoOpHealthReportProvider returns zero tier1 ack backlog", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.tier1AckBacklog, 0);
});

test("createNoOpHealthReportProvider returns none degradation mode", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.degradationMode, "none");
});

test("createNoOpHealthReportProvider backpressure has ok status", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.backpressure.status, "ok");
});

test("createNoOpHealthReportProvider backpressure has none degradation mode", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.backpressure.degradationMode, "none");
});

test("createNoOpHealthReportProvider backpressure has zero tier1 ack backlog", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  assert.strictEqual(report.backpressure.tier1AckBacklog, 0);
});

test("createNoOpHealthReportProvider backpressure queueGovernance has correct structure", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const qg = report.backpressure.queueGovernance;

  assert.strictEqual(qg.backlogSize, 0);
  assert.strictEqual(qg.dispatchableBacklogSize, 0);
  assert.strictEqual(qg.claimedBacklogSize, 0);
  assert.strictEqual(qg.oldestWaitSeconds, null);
  assert.strictEqual(qg.oldestClaimAgeSeconds, null);
  assert.ok(Array.isArray(qg.queueNames));
  assert.strictEqual(qg.queueNames.length, 0);
  assert.strictEqual(qg.starvationDetected, false);
});

test("createNoOpHealthReportProvider top-level queueGovernance has correct structure", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const qg = report.queueGovernance;

  assert.strictEqual(qg.backlogSize, 0);
  assert.strictEqual(qg.dispatchableBacklogSize, 0);
  assert.strictEqual(qg.claimedBacklogSize, 0);
  assert.strictEqual(qg.oldestWaitSeconds, null);
  assert.strictEqual(qg.oldestClaimAgeSeconds, null);
  assert.ok(Array.isArray(qg.queueNames));
  assert.strictEqual(qg.queueNames.length, 0);
  assert.strictEqual(qg.starvationDetected, false);
});

test("createNoOpHealthReportProvider workerHealth has zero workers", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const wh = report.workerHealth;

  assert.strictEqual(wh.totalWorkers, 0);
  assert.strictEqual(wh.healthyWorkers, 0);
  assert.strictEqual(wh.busyWorkers, 0);
  assert.strictEqual(wh.drainingWorkers, 0);
  assert.strictEqual(wh.degradedWorkers, 0);
  assert.strictEqual(wh.quarantinedWorkers, 0);
  assert.strictEqual(wh.offlineWorkers, 0);
});

test("createNoOpHealthReportProvider workerHealth has zero remote workers", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const wh = report.workerHealth;

  assert.strictEqual(wh.remoteWorkers, 0);
  assert.strictEqual(wh.remoteConnectedWorkers, 0);
  assert.strictEqual(wh.remoteReconnectingWorkers, 0);
  assert.strictEqual(wh.remoteDegradedSessions, 0);
  assert.strictEqual(wh.remoteFailedSessions, 0);
  assert.strictEqual(wh.remoteViewerOnlyWorkers, 0);
  assert.strictEqual(wh.remoteConsistencyMismatchWorkers, 0);
  assert.strictEqual(wh.remoteWorkspaceSyncConflictWorkers, 0);
  assert.strictEqual(wh.remoteOffsetMissingWorkers, 0);
});

test("createNoOpHealthReportProvider workerHealth has no skew detected", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const wh = report.workerHealth;

  assert.strictEqual(wh.loadSkewDetected, false);
  assert.strictEqual(wh.dominantWorkerId, null);
  assert.strictEqual(wh.dominantWorkerShare, null);
  assert.ok(Array.isArray(wh.skewedWorkerIds));
  assert.strictEqual(wh.skewedWorkerIds.length, 0);
});

test("createNoOpHealthReportProvider workerHealth has zero stale workers", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const wh = report.workerHealth;

  assert.strictEqual(wh.staleWorkers, 0);
  assert.strictEqual(wh.staleBusyWorkers, 0);
});

test("createNoOpHealthReportProvider returns empty findings", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();

  assert.ok(Array.isArray(report.findings));
  assert.strictEqual(report.findings.length, 0);
});

test("createNoOpHealthReportProvider returns object implementing HealthReportProvider", () => {
  const provider = createNoOpHealthReportProvider();
  const _check: HealthReportProvider = provider;
  assert.ok(_check !== null && _check !== undefined);
});

test("createNoOpHealthReportProvider getReport returns HealthStatusReport", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();
  const _check: HealthStatusReport = report;
  assert.ok(_check !== null && _check !== undefined);
});

test("createNoOpHealthReportProvider returns consistent report on multiple calls", () => {
  const provider = createNoOpHealthReportProvider();
  const report1 = provider.getReport();
  const report2 = provider.getReport();

  assert.strictEqual(report1.status, report2.status);
  assert.strictEqual(report1.providerHealth, report2.providerHealth);
  assert.strictEqual(report1.workerHealth.totalWorkers, report2.workerHealth.totalWorkers);
});

test("createNoOpHealthReportProvider can be called multiple times without side effects", () => {
  const provider = createNoOpHealthReportProvider();

  for (let i = 0; i < 10; i++) {
    const report = provider.getReport();
    assert.strictEqual(report.status, "ok");
    assert.strictEqual(report.workerHealth.totalWorkers, 0);
  }
});