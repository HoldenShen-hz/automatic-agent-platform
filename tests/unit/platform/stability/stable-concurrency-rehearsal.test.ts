import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runStableConcurrencyRehearsal, writeStableConcurrencyRehearsalReport } from "../../../../src/platform/stability/stable-concurrency-rehearsal.js";

test("runStableConcurrencyRehearsal runs all three scenarios and reports passing results", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-concurrency-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableConcurrencyRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.equal(report.passedScenarios + report.failedScenarios, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("expired_lock_released"));
  assert.ok(scenarioIds.includes("active_execution_conflict_fail_closed"));
  assert.ok(scenarioIds.includes("competing_write_transactions_fail_closed"));

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios, "Scenario counts must sum to total");
  assert.equal(report.passedScenarios, report.totalScenarios, "All scenarios should pass when this test runs");
  assert.equal(report.passedScenarios, 3);

  for (const scenario of report.scenarios) {
    assert.equal(scenario.passed, true, `Scenario ${scenario.scenarioId} should pass`);
    assert.ok(scenario.durationMs >= 0, `Scenario ${scenario.scenarioId} should have valid duration`);
  }
});

test("writeStableConcurrencyRehearsalReport writes JSON file", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-concurrency-write-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const outputFile = join(outputDir, "report.json");
  const report = {
    startedAt: "2026-05-05T00:00:00.000Z",
    finishedAt: "2026-05-05T00:00:01.000Z",
    outputDir,
    totalScenarios: 3,
    passedScenarios: 3,
    failedScenarios: 0,
    scenarios: [],
  };

  writeStableConcurrencyRehearsalReport(outputFile, report);

  const saved = JSON.parse(readFileSync(outputFile, "utf8")) as typeof report;
  assert.equal(saved.outputDir, outputDir);
  assert.equal(saved.passedScenarios, 3);
});
