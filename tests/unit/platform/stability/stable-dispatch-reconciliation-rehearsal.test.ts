import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableDispatchReconciliationRehearsal, writeStableDispatchReconciliationRehearsalReport } from "../../../../src/platform/stability/stable-dispatch-reconciliation-rehearsal.js";

test("runStableDispatchReconciliationRehearsal runs all two scenarios", async () => {
  const outputDir = "/tmp/stable-dispatch-reconciliation-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchReconciliationRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 2);
  assert.equal(report.scenarios.length, 2);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("orphan_claim_requeued"));
  assert.ok(scenarioIds.includes("terminal_execution_ticket_cancelled"));
});

test("runStableDispatchReconciliationRehearsal orphan_claim_requeued scenario passes", async () => {
  const outputDir = "/tmp/stable-dispatch-reconciliation-test-orphan";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchReconciliationRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_claim_requeued");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.ok(scenario.durationMs >= 0);
  assert.ok(scenario.summary.length > 0);
});

test("runStableDispatchReconciliationRehearsal terminal_execution_ticket_cancelled scenario passes", async () => {
  const outputDir = "/tmp/stable-dispatch-reconciliation-test-terminal";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchReconciliationRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "terminal_execution_ticket_cancelled");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableDispatchReconciliationRehearsal pass/fail counts are correct", async () => {
  const outputDir = "/tmp/stable-dispatch-reconciliation-test-counts";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchReconciliationRehearsal({ outputDir });

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
});

test("writeStableDispatchReconciliationRehearsalReport is callable", () => {
  assert.equal(typeof writeStableDispatchReconciliationRehearsalReport, "function");
});