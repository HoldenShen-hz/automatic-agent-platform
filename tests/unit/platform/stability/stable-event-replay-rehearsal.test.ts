import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableEventReplayRehearsal, writeStableEventReplayRehearsalReport } from "../../../../src/platform/stability/stable-event-replay-rehearsal.js";

test("runStableEventReplayRehearsal runs the failed_consumer_ack_replay scenario", async () => {
  const outputDir = "/tmp/stable-event-replay-test";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableEventReplayRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 1);
  assert.equal(report.scenarios.length, 1);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);
});

test("runStableEventReplayRehearsal failed_consumer_ack_replay scenario passes", async () => {
  const outputDir = "/tmp/stable-event-replay-test-scenario";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableEventReplayRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "failed_consumer_ack_replay");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.ok(scenario.durationMs >= 0);
  assert.ok(scenario.summary.length > 0);
});

test("runStableEventReplayRehearsal scenario has details object", async () => {
  const outputDir = "/tmp/stable-event-replay-test-details";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableEventReplayRehearsal({ outputDir });
  const scenario = report.scenarios[0]!;

  assert.ok(scenario.details);
  assert.ok(scenario.details.firstAttempt);
  assert.ok(scenario.details.secondAttempt);
});

test("writeStableEventReplayRehearsalReport is callable", () => {
  assert.equal(typeof writeStableEventReplayRehearsalReport, "function");
});
