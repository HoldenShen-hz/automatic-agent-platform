/**
 * Unit tests for Stable Queue Delivery Rehearsal Module.
 *
 * Tests scenarios:
 * - Queue replay rebuilds dispatchable ticket
 * - Duplicate delivery blocked and reconciled
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableQueueDeliveryRehearsal,
  writeStableQueueDeliveryRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-queue-delivery-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `queue-delivery-test-${Date.now()}`);
}

test("runStableQueueDeliveryRehearsal executes all two scenarios successfully [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });

    if (report.totalScenarios !== 2) {
      throw new Error(`Expected 2 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 2) {
      throw new Error(`Expected 2 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("queue_replay_rebuilds_dispatchable_ticket scenario passes [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "queue_replay_rebuilds_dispatchable_ticket");

    if (!scenario) {
      throw new Error("Missing queue_replay_rebuilds_dispatchable_ticket scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("duplicate_delivery_blocked_and_reconciled scenario passes [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_delivery_blocked_and_reconciled");

    if (!scenario) {
      throw new Error("Missing duplicate_delivery_blocked_and_reconciled scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableQueueDeliveryRehearsalReport writes valid JSON [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });
    writeStableQueueDeliveryRehearsalReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 2) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 2) {
      throw new Error("Report should have 2 passed scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });

    if (!report.startedAt) {
      throw new Error("Missing startedAt");
    }
    if (!report.finishedAt) {
      throw new Error("Missing finishedAt");
    }
    if (report.startedAt >= report.finishedAt) {
      throw new Error("startedAt should be before finishedAt");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report outputDir matches options [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("each scenario has durationMs greater than zero [stable-queue-delivery-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableQueueDeliveryRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
