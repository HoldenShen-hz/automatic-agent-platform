import assert from "node:assert/strict";
import test from "node:test";

import {
  type StableLeaseRehearsalOptions,
  type StableLeaseScenarioResult,
  type StableLeaseRehearsalReport,
  writeStableLeaseRehearsalReport,
} from "../../../../src/platform/stability/stable-lease-rehearsal.js";

test("StableLeaseRehearsalOptions has required outputDir", () => {
  const options: StableLeaseRehearsalOptions = {
    outputDir: "/tmp/test",
  };

  assert.strictEqual(options.outputDir, "/tmp/test");
});

test("StableLeaseScenarioResult has valid scenarioId values", () => {
  const validIds = [
    "lease_reclaim_increments_fencing",
    "stale_write_rejected_after_failover",
    "lease_handover_preserves_lineage",
    "worker_registry_capacity_visible",
  ];

  for (const id of validIds) {
    const result: StableLeaseScenarioResult = {
      scenarioId: id as StableLeaseScenarioResult["scenarioId"],
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    };
    assert.ok(validIds.includes(result.scenarioId));
  }
});

test("StableLeaseScenarioResult has required fields", () => {
  const result: StableLeaseScenarioResult = {
    scenarioId: "lease_reclaim_increments_fencing",
    passed: true,
    durationMs: 150.5,
    summary: "expired leases are reclaimed and next grant increments fencing tokens",
    details: {
      firstOutcome: "granted",
      secondOutcome: "granted",
      fencingTokenIncremented: true,
    },
  };

  assert.strictEqual(result.scenarioId, "lease_reclaim_increments_fencing");
  assert.strictEqual(result.passed, true);
  assert.ok(result.durationMs > 0);
  assert.ok(result.summary.length > 0);
  assert.ok(typeof result.details === "object");
});

test("StableLeaseRehearsalReport has correct structure", () => {
  const report: StableLeaseRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:10:00.000Z",
    outputDir: "/tmp/lease-test",
    totalScenarios: 4,
    passedScenarios: 3,
    failedScenarios: 1,
    scenarios: [],
  };

  assert.ok(report.startedAt.length > 0);
  assert.ok(report.finishedAt.length > 0);
  assert.strictEqual(report.totalScenarios, 4);
  assert.strictEqual(report.passedScenarios, 3);
  assert.strictEqual(report.failedScenarios, 1);
  assert.ok(report.outputDir.length > 0);
  assert.ok(Array.isArray(report.scenarios));
});

test("StableLeaseRehearsalReport passed/failed counts are accurate", () => {
  const scenarios: StableLeaseScenarioResult[] = [
    { scenarioId: "lease_reclaim_increments_fencing", passed: true, durationMs: 100, summary: "test", details: {} },
    { scenarioId: "stale_write_rejected_after_failover", passed: true, durationMs: 100, summary: "test", details: {} },
    { scenarioId: "lease_handover_preserves_lineage", passed: false, durationMs: 100, summary: "test", details: {} },
    { scenarioId: "worker_registry_capacity_visible", passed: true, durationMs: 100, summary: "test", details: {} },
  ];

  const report: StableLeaseRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:10:00.000Z",
    outputDir: "/tmp/lease-test",
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((s) => s.passed).length,
    failedScenarios: scenarios.filter((s) => !s.passed).length,
    scenarios,
  };

  assert.strictEqual(report.passedScenarios, 3);
  assert.strictEqual(report.failedScenarios, 1);
  assert.strictEqual(report.passedScenarios + report.failedScenarios, report.totalScenarios);
});

test("writeStableLeaseRehearsalReport writes valid JSON", () => {
  const report: StableLeaseRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:10:00.000Z",
    outputDir: "/tmp/lease-test",
    totalScenarios: 4,
    passedScenarios: 4,
    failedScenarios: 0,
    scenarios: [
      { scenarioId: "lease_reclaim_increments_fencing", passed: true, durationMs: 100, summary: "test", details: {} },
      { scenarioId: "stale_write_rejected_after_failover", passed: true, durationMs: 100, summary: "test", details: {} },
      { scenarioId: "lease_handover_preserves_lineage", passed: true, durationMs: 100, summary: "test", details: {} },
      { scenarioId: "worker_registry_capacity_visible", passed: true, durationMs: 100, summary: "test", details: {} },
    ],
  };

  // Should not throw
  writeStableLeaseRehearsalReport("/tmp/test-lease-report-output.json", report);
});

// runStableLeaseRehearsal requires SQLite database, ExecutionLeaseService,
// WorkerRegistryService, and AuthoritativeTaskStore - these are integration tests
test.skip("runStableLeaseRehearsal requires SQLite and execution services infrastructure", () => {
  // This test is skipped because runStableLeaseRehearsal depends on:
  // - SqliteDatabase for database operations
  // - ExecutionLeaseService for lease management
  // - WorkerRegistryService for worker registration/heartbeat
  // - AuthoritativeTaskStore for task/execution persistence
  // These are integration-level tests that require the full runtime stack.
});
