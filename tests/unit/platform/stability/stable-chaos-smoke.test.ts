import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, rmSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

import { runStableChaosSmoke, writeStableChaosSmokeReport, type StableChaosSmokeReport } from "../../../../src/platform/stability/stable-chaos-smoke.js";

test("runStableChaosSmoke runs all five scenarios", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });

  assert.equal(report.totalScenarios, 5);
  assert.equal(report.scenarios.length, 5);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("stale_execution_repair"));
  assert.ok(scenarioIds.includes("orphan_session_cleanup"));
  assert.ok(scenarioIds.includes("orphan_queue_claim_reconciled_via_runtime_repair"));
  assert.ok(scenarioIds.includes("duplicate_approval_response_idempotent"));
  assert.ok(scenarioIds.includes("missing_ack_rebuild_and_replay"));
});

test("runStableChaosSmoke stale_execution_repair scenario passes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-stale-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "stale_execution_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke orphan_session_cleanup scenario passes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-session-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_session_cleanup");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke orphan_queue_claim_reconciled_via_runtime_repair scenario passes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-orphan-queue-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_queue_claim_reconciled_via_runtime_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke duplicate_approval_response_idempotent scenario passes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-approval-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_approval_response_idempotent");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke missing_ack_rebuild_and_replay scenario passes", async () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-test-ack-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "missing_ack_rebuild_and_replay");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("writeStableChaosSmokeReport writes report to file", () => {
  const outputDir = mkdtempSync(join(tmpdir(), "stable-chaos-smoke-report-test-"));
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report: StableChaosSmokeReport = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    outputDir,
    totalScenarios: 0,
    passedScenarios: 0,
    failedScenarios: 0,
    scenarios: [],
  };

  const outputFile = join(outputDir, "report.json");
  writeStableChaosSmokeReport(outputFile, report);

  // Verify file was written
  assert.ok(existsSync(outputFile), "Report file should be written");
});
