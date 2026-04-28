/**
 * Stability Integration Tests
 *
 * Tests various stability rehearsal scenarios including:
 * - Lease handover under various conditions
 * - Queue delivery reliability
 * - Event replay capabilities
 * - Database writability under stress
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableLeaseRehearsal,
  writeStableLeaseRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-lease-rehearsal.js";
import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-queue-delivery-rehearsal.js";
import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-event-replay-rehearsal.js";
import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-db-writability-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("stable lease rehearsal validates step-boundary handover and recovery", async () => {
  const workspace = createTempWorkspace("aa-stable-lease-");

  try {
    const report = await runStableLeaseRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-lease-report.json");
    writeStableLeaseRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 2);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);

    // Verify lease handover scenario exists by ID
    const handoverScenario = report.scenarios.find((s) =>
      s.scenarioId.includes("lease_handover")
    );
    assert.ok(handoverScenario !== undefined, "Should have lease handover scenario");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable queue delivery rehearsal validates message queue reliability", async () => {
  const workspace = createTempWorkspace("aa-stable-queue-");

  try {
    const report = await runStableQueueDeliveryRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-queue-delivery-report.json");
    writeStableQueueDeliveryRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);

    // Verify delivery scenario exists by ID pattern
    const deliveryScenario = report.scenarios.find((s) =>
      s.scenarioId.includes("delivery") || s.scenarioId.includes("queue")
    );
    assert.ok(deliveryScenario !== undefined, "Should have queue delivery scenario");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable event replay rehearsal validates event sourcing and reconstruction", async () => {
  const workspace = createTempWorkspace("aa-stable-event-replay-");

  try {
    const report = await runStableEventReplayRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-event-replay-report.json");
    writeStableEventReplayRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);

    // Verify event replay scenario by ID pattern
    const replayScenario = report.scenarios.find((s) =>
      s.scenarioId.includes("replay") || s.scenarioId.includes("event")
    );
    assert.ok(replayScenario !== undefined, "Should have event replay scenario");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable db writability rehearsal validates database write reliability", async () => {
  const workspace = createTempWorkspace("aa-stable-db-writability-");

  try {
    const report = await runStableDbWritabilityRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-db-writability-report.json");
    writeStableDbWritabilityRehearsalReport(outputFile, report);

    assert.equal(report.failedScenarios, 0);
    assert.ok(report.totalScenarios >= 1);
    assert.ok(report.scenarios.every((scenario) => scenario.passed));
    assert.equal(existsSync(outputFile), true);

    // Verify database writability scenario by ID pattern
    const dbScenario = report.scenarios.find((s) =>
      s.scenarioId === "health_and_doctor_fail_close_when_db_is_not_writable"
      || s.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode"
      || s.scenarioId === "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode"
    );
    assert.ok(dbScenario !== undefined, "Should have db writability scenario");
  } finally {
    cleanupPath(workspace);
  }
});

test("stable lease rehearsal report contains valid artifacts", async () => {
  const workspace = createTempWorkspace("aa-stable-lease-artifacts-");

  try {
    const report = await runStableLeaseRehearsal({
      outputDir: workspace,
    });
    const outputFile = join(workspace, "stable-lease-report.json");
    writeStableLeaseRehearsalReport(outputFile, report);

    // Verify report structure
    assert.ok(report.startedAt.length > 0, "Should have startedAt timestamp");
    assert.ok(report.finishedAt.length > 0, "Should have finishedAt timestamp");

    // Verify all scenarios have required fields
    for (const scenario of report.scenarios) {
      assert.ok(scenario.scenarioId.length > 0, "Scenario should have id");
      assert.ok(typeof scenario.passed === "boolean", "Scenario should have passed boolean");
      assert.ok(scenario.summary.length > 0, "Scenario should have summary");
    }
  } finally {
    cleanupPath(workspace);
  }
});

test("stable queue delivery report validates scenario count", async () => {
  const workspace = createTempWorkspace("aa-stable-queue-governance-");

  try {
    const report = await runStableQueueDeliveryRehearsal({
      outputDir: workspace,
    });

    // Verify at least 1 scenario ran
    assert.ok(report.totalScenarios >= 1, "Should have at least 1 scenario");
    assert.ok(report.passedScenarios >= 1, "Should have at least 1 passed scenario");
    assert.equal(report.failedScenarios, 0, "Should have 0 failed scenarios");
  } finally {
    cleanupPath(workspace);
  }
});
