import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableDbWritabilityRehearsal, writeStableDbWritabilityRehearsalReport } from "../../../../src/platform/stability/stable-db-writability-rehearsal.js";

test("runStableDbWritabilityRehearsal runs all three scenarios", async () => {
  const outputDir = "/tmp/stable-db-writability-test";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbWritabilityRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("health_and_doctor_fail_close_when_db_is_not_writable"));
  assert.ok(scenarioIds.includes("multi_step_admission_rejects_new_work_in_read_only_mode"));
  assert.ok(scenarioIds.includes("dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode"));
});

test("runStableDbWritabilityRehearsal reports pass/fail counts correctly", async () => {
  const outputDir = "/tmp/stable-db-writability-test-counts";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbWritabilityRehearsal({ outputDir });

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
});

test("runStableDbWritabilityRehearsal each scenario has required fields", async () => {
  const outputDir = "/tmp/stable-db-writability-test-fields";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDbWritabilityRehearsal({ outputDir });

  for (const scenario of report.scenarios) {
    assert.ok(typeof scenario.scenarioId === "string");
    assert.ok(typeof scenario.passed === "boolean");
    assert.ok(typeof scenario.durationMs === "number");
    assert.ok(typeof scenario.summary === "string");
    assert.ok(typeof scenario.details === "object");
  }
});

test("writeStableDbWritabilityRehearsalReport is a function", () => {
  assert.equal(typeof writeStableDbWritabilityRehearsalReport, "function");
});
