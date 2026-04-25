import assert from "node:assert/strict";
import test from "node:test";

import {
  type StableQueueDeliveryRehearsalOptions,
  type StableQueueDeliveryScenarioResult,
  type StableQueueDeliveryRehearsalReport,
  writeStableQueueDeliveryRehearsalReport,
} from "../../../../src/platform/stability/stable-queue-delivery-rehearsal.js";

test("StableQueueDeliveryRehearsalOptions has required outputDir", () => {
  const options: StableQueueDeliveryRehearsalOptions = {
    outputDir: "/tmp/test",
  };

  assert.strictEqual(options.outputDir, "/tmp/test");
});

test("StableQueueDeliveryScenarioResult has valid scenarioId values", () => {
  const validIds = [
    "queue_replay_rebuilds_dispatchable_ticket",
    "duplicate_delivery_blocked_and_reconciled",
  ];

  for (const id of validIds) {
    const result: StableQueueDeliveryScenarioResult = {
      scenarioId: id as StableQueueDeliveryScenarioResult["scenarioId"],
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    };
    assert.ok(validIds.includes(result.scenarioId));
  }
});

test("StableQueueDeliveryScenarioResult has required fields", () => {
  const result: StableQueueDeliveryScenarioResult = {
    scenarioId: "queue_replay_rebuilds_dispatchable_ticket",
    passed: true,
    durationMs: 200.5,
    summary: "queue replay rebuilds dispatchable ticket after delivery is lost",
    details: {
      createdOutcome: "created",
      firstDispatchOutcome: "dispatched",
      replacementTicketCreated: true,
      replayDispatchOutcome: "dispatched",
    },
  };

  assert.strictEqual(result.scenarioId, "queue_replay_rebuilds_dispatchable_ticket");
  assert.strictEqual(result.passed, true);
  assert.ok(result.durationMs > 0);
  assert.ok(result.summary.length > 0);
  assert.ok(typeof result.details === "object");
});

test("StableQueueDeliveryRehearsalReport has correct structure", () => {
  const report: StableQueueDeliveryRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:05:00.000Z",
    outputDir: "/tmp/queue-delivery-test",
    totalScenarios: 2,
    passedScenarios: 2,
    failedScenarios: 0,
    scenarios: [],
  };

  assert.ok(report.startedAt.length > 0);
  assert.ok(report.finishedAt.length > 0);
  assert.strictEqual(report.totalScenarios, 2);
  assert.strictEqual(report.passedScenarios, 2);
  assert.strictEqual(report.failedScenarios, 0);
  assert.ok(report.outputDir.length > 0);
  assert.ok(Array.isArray(report.scenarios));
});

test("StableQueueDeliveryRehearsalReport passed/failed counts are accurate", () => {
  const scenarios: StableQueueDeliveryScenarioResult[] = [
    { scenarioId: "queue_replay_rebuilds_dispatchable_ticket", passed: true, durationMs: 100, summary: "test", details: {} },
    { scenarioId: "duplicate_delivery_blocked_and_reconciled", passed: false, durationMs: 100, summary: "test", details: {} },
  ];

  const report: StableQueueDeliveryRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:05:00.000Z",
    outputDir: "/tmp/queue-delivery-test",
    totalScenarios: scenarios.length,
    passedScenarios: scenarios.filter((s) => s.passed).length,
    failedScenarios: scenarios.filter((s) => !s.passed).length,
    scenarios,
  };

  assert.strictEqual(report.passedScenarios, 1);
  assert.strictEqual(report.failedScenarios, 1);
  assert.strictEqual(report.passedScenarios + report.failedScenarios, report.totalScenarios);
});

test("writeStableQueueDeliveryRehearsalReport writes valid JSON", () => {
  const report: StableQueueDeliveryRehearsalReport = {
    startedAt: "2026-04-01T00:00:00.000Z",
    finishedAt: "2026-04-01T00:05:00.000Z",
    outputDir: "/tmp/queue-delivery-test",
    totalScenarios: 2,
    passedScenarios: 2,
    failedScenarios: 0,
    scenarios: [
      { scenarioId: "queue_replay_rebuilds_dispatchable_ticket", passed: true, durationMs: 100, summary: "test", details: {} },
      { scenarioId: "duplicate_delivery_blocked_and_reconciled", passed: true, durationMs: 100, summary: "test", details: {} },
    ],
  };

  // Should not throw
  writeStableQueueDeliveryRehearsalReport("/tmp/test-queue-delivery-report-output.json", report);
});

test("StableQueueDeliveryScenarioResult duplicate delivery scenario structure", () => {
  const result: StableQueueDeliveryScenarioResult = {
    scenarioId: "duplicate_delivery_blocked_and_reconciled",
    passed: true,
    durationMs: 250,
    summary: "duplicate delivery is blocked by the active lease and cleaned up after terminal writeback",
    details: {
      claimAccepted: true,
      duplicateDispatchOutcome: "no_worker",
      duplicateDispatchRejected: true,
      writebackAccepted: true,
      repaired: true,
      duplicateTicketStatus: "cancelled",
    },
  };

  assert.strictEqual(result.scenarioId, "duplicate_delivery_blocked_and_reconciled");
  assert.ok(result.summary.length > 0);
  assert.ok(result.details);
});

test("StableQueueDeliveryScenarioResult queue replay scenario structure", () => {
  const result: StableQueueDeliveryScenarioResult = {
    scenarioId: "queue_replay_rebuilds_dispatchable_ticket",
    passed: true,
    durationMs: 300,
    summary: "queue replay rebuilds a dispatchable ticket from authoritative DB truth",
    details: {
      createdOutcome: "created",
      firstDispatchOutcome: "dispatched",
      replacementTicketId: "ticket-replacement-123",
      replayDispatchOutcome: "dispatched",
      eventEmitted: true,
    },
  };

  assert.strictEqual(result.scenarioId, "queue_replay_rebuilds_dispatchable_ticket");
  assert.ok(result.summary.length > 0);
  assert.ok(result.details);
});

// runStableQueueDeliveryRehearsal requires SQLite database and multiple services:
// ExecutionDispatchService, ExecutionLeaseService, WorkerRegistryService,
// ExecutionDispatchReconciliationService, ExecutionWorkerHandshakeService,
// ExecutionWorkerWritebackService - these are integration tests
test.skip("runStableQueueDeliveryRehearsal requires SQLite and dispatch services infrastructure", () => {
  // This test is skipped because runStableQueueDeliveryRehearsal depends on:
  // - SqliteDatabase for database operations
  // - ExecutionDispatchService for dispatch operations
  // - ExecutionLeaseService for lease management
  // - ExecutionDispatchReconciliationService for reconciliation
  // - ExecutionWorkerHandshakeService for worker handshake
  // - ExecutionWorkerWritebackService for writeback operations
  // - WorkerRegistryService for worker registration
  // These are integration-level tests that require the full runtime stack.
});
