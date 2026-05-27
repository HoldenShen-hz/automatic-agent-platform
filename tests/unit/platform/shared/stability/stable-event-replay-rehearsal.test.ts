/**
 * Unit tests for Stable Event Replay Rehearsal Module.
 *
 * Tests scenario:
 * - Failed consumer ack replay
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableEventReplayRehearsal,
  writeStableEventReplayRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-event-replay-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `event-replay-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test("runStableEventReplayRehearsal executes the scenario successfully [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });

    if (report.totalScenarios !== 1) {
      throw new Error(`Expected 1 scenario, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 1) {
      throw new Error(`Expected 1 passed scenario, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("failed_consumer_ack_replay scenario passes [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "failed_consumer_ack_replay");

    if (!scenario) {
      throw new Error("Missing failed_consumer_ack_replay scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableEventReplayRehearsalReport writes valid JSON [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });
    writeStableEventReplayRehearsalReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 1) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 1) {
      throw new Error("Report should have 1 passed scenario");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });

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

test("report outputDir matches options [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("scenario has durationMs greater than zero [stable-event-replay-rehearsal]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableEventReplayRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
