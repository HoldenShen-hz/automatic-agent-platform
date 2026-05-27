/**
 * Unit tests for Stable DB Queue Disconnect Rehearsal Module.
 *
 * Tests scenarios:
 * - Queue disconnect degrades without silent drop
 * - Missing dispatch ticket rebuilt after queue reconnect
 * - Authoritative writeback failure fails closed until store recovers
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDbQueueDisconnectRehearsal,
  writeStableDbQueueDisconnectRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-db-queue-disconnect-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `db-queue-disconnect-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test("runStableDbQueueDisconnectRehearsal executes all three scenarios successfully [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

    if (report.totalScenarios !== 3) {
      throw new Error(`Expected 3 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 3) {
      throw new Error(`Expected 3 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("queue_disconnect_degrades_without_silent_drop scenario passes [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "queue_disconnect_degrades_without_silent_drop");

    if (!scenario) {
      throw new Error("Missing queue_disconnect_degrades_without_silent_drop scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("missing_dispatch_ticket_rebuilt_after_queue_reconnect scenario passes [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "missing_dispatch_ticket_rebuilt_after_queue_reconnect",
    );

    if (!scenario) {
      throw new Error("Missing missing_dispatch_ticket_rebuilt_after_queue_reconnect scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("authoritative_writeback_failure_fails_closed_until_store_recovers scenario passes [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "authoritative_writeback_failure_fails_closed_until_store_recovers",
    );

    if (!scenario) {
      throw new Error(
        "Missing authoritative_writeback_failure_fails_closed_until_store_recovers scenario",
      );
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableDbQueueDisconnectRehearsalReport writes valid JSON [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });
    writeStableDbQueueDisconnectRehearsalReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 3) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 3) {
      throw new Error("Report should have 3 passed scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

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

test("report outputDir matches options [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("each scenario has durationMs greater than zero [stable-db-queue-disconnect-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbQueueDisconnectRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
