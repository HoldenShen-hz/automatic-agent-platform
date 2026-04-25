import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableWorkerWritebackRehearsal, writeStableWorkerWritebackRehearsalReport } from "../../../../src/platform/stability/stable-worker-writeback-rehearsal.js";

test("runStableWorkerWritebackRehearsal runs all three scenarios", async () => {
  const outputDir = "/tmp/stable-worker-writeback-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerWritebackRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 3);
  assert.equal(report.scenarios.length, 3);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("worker_writeback_completes_execution"));
  assert.ok(scenarioIds.includes("duplicate_writeback_rejected"));
  assert.ok(scenarioIds.includes("stale_fencing_writeback_rejected"));
});

test("runStableWorkerWritebackRehearsal worker_writeback_completes_execution scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-writeback-test-complete";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerWritebackRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "worker_writeback_completes_execution");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableWorkerWritebackRehearsal duplicate_writeback_rejected scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-writeback-test-duplicate";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerWritebackRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_writeback_rejected");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableWorkerWritebackRehearsal stale_fencing_writeback_rejected scenario passes", async () => {
  const outputDir = "/tmp/stable-worker-writeback-test-stale";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableWorkerWritebackRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "stale_fencing_writeback_rejected");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("writeStableWorkerWritebackRehearsalReport is callable", () => {
  assert.equal(typeof writeStableWorkerWritebackRehearsalReport, "function");
});