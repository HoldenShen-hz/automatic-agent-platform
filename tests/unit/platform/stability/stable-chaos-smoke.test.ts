import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableChaosSmoke, writeStableChaosSmokeReport } from "../../../../src/platform/stability/stable-chaos-smoke.js";

test("runStableChaosSmoke runs all five scenarios", async () => {
  const outputDir = "/tmp/stable-chaos-smoke-test";
  rmSync(outputDir, { force: true });
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
  const outputDir = "/tmp/stable-chaos-smoke-test-stale";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "stale_execution_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke orphan_session_cleanup scenario passes", async () => {
  const outputDir = "/tmp/stable-chaos-smoke-test-session";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_session_cleanup");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke orphan_queue_claim_reconciled_via_runtime_repair scenario passes", async () => {
  const outputDir = "/tmp/stable-chaos-smoke-test-orphan-queue";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_queue_claim_reconciled_via_runtime_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke duplicate_approval_response_idempotent scenario passes", async () => {
  const outputDir = "/tmp/stable-chaos-smoke-test-approval";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_approval_response_idempotent");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke missing_ack_rebuild_and_replay scenario passes", async () => {
  const outputDir = "/tmp/stable-chaos-smoke-test-ack";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "missing_ack_rebuild_and_replay");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("writeStableChaosSmokeReport is callable", () => {
  assert.equal(typeof writeStableChaosSmokeReport, "function");
});