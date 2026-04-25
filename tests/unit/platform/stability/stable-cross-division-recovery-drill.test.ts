import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableCrossDivisionRecoveryDrill, writeStableCrossDivisionRecoveryDrillReport } from "../../../../src/platform/stability/stable-cross-division-recovery-drill.js";

test("runStableCrossDivisionRecoveryDrill runs both scenarios", async () => {
  const outputDir = "/tmp/stable-cross-division-recovery-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

  assert.equal(report.totalScenarios, 2);
  assert.equal(report.scenarios.length, 2);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("cross_division_overview"));
  assert.ok(scenarioIds.includes("cross_division_replay_matrix"));
});

test("runStableCrossDivisionRecoveryDrill cross_division_overview scenario passes", async () => {
  const outputDir = "/tmp/stable-cross-division-recovery-test-overview";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableCrossDivisionRecoveryDrill({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "cross_division_overview");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.ok(scenario.durationMs >= 0);
  assert.ok(scenario.summary.length > 0);
  assert.ok(scenario.details);
});

test("runStableCrossDivisionRecoveryDrill cross_division_replay_matrix scenario passes", async () => {
  const outputDir = "/tmp/stable-cross-division-recovery-test-replay";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableCrossDivisionRecoveryDrill({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "cross_division_replay_matrix");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableCrossDivisionRecoveryDrill passedScenarios count is correct", async () => {
  const outputDir = "/tmp/stable-cross-division-recovery-test-count";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
});

test("writeStableCrossDivisionRecoveryDrillReport is callable", () => {
  assert.equal(typeof writeStableCrossDivisionRecoveryDrillReport, "function");
});