/**
 * Unit tests for Health and Backpressure Contract Types
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
} from "../../../../../src/platform/contracts/types/health.js";

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

// ─────────────────────────────────────────────────────────────────────────────
// BackpressureHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// QueueGovernanceHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// WorkerHealthSummary Tests
// ─────────────────────────────────────────────────────────────────────────────

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

// ─────────────────────────────────────────────────────────────────────────────
// Findings Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createNoOpHealthReportProvider returns empty findings", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();

  assert.ok(Array.isArray(report.findings));
  assert.strictEqual(report.findings.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// HealthReportProvider Interface Tests
// ─────────────────────────────────────────────────────────────────────────────

test("createNoOpHealthReportProvider returns object implementing HealthReportProvider", () => {
  const provider = createNoOpHealthReportProvider();

  // TypeScript compile-time check - if this compiles, the interface is satisfied
  const _check: HealthReportProvider = provider;
  assert.ok(_check !== null && _check !== undefined);
});

test("createNoOpHealthReportProvider getReport returns HealthStatusReport", () => {
  const provider = createNoOpHealthReportProvider();
  const report = provider.getReport();

  // TypeScript compile-time check - if this compiles, the interface is satisfied
  const _check: HealthStatusReport = report;
  assert.ok(_check !== null && _check !== undefined);
});

// ─────────────────────────────────────────────────────────────────────────────
// Multiple Calls Tests
// ─────────────────────────────────────────────────────────────────────────────

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
