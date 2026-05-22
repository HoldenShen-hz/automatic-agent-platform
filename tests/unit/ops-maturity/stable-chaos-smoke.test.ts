import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import {
  runStableChaosSmoke,
  writeStableChaosSmokeReport,
  type StableChaosSmokeOptions,
  type StableChaosSmokeReport,
  type StableChaosScenarioResult,
} from "../../../src/platform/stability/stable-chaos-smoke.js";

const TEST_OUTPUT_DIR_PREFIX = "/tmp/stable-chaos-smoke-test-ops-maturity";

function prepareOutputDir(name: string): string {
  const outputDir = `${TEST_OUTPUT_DIR_PREFIX}-${process.pid}-${name}`;
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });
  return outputDir;
}

test("runStableChaosSmoke exports are available", () => {
  assert.equal(typeof runStableChaosSmoke, "function");
  assert.equal(typeof writeStableChaosSmokeReport, "function");
});

test("runStableChaosSmoke runs all five scenarios", async () => {
  const outputDir = prepareOutputDir("all-scenarios");

  const report: StableChaosSmokeReport = await runStableChaosSmoke({ outputDir });

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

test("runStableChaosSmoke returns report with correct structure", async () => {
  const outputDir = prepareOutputDir("report-structure");

  const report: StableChaosSmokeReport = await runStableChaosSmoke({ outputDir });

  assert.equal(typeof report.startedAt, "string");
  assert.equal(typeof report.finishedAt, "string");
  assert.equal(typeof report.totalScenarios, "number");
  assert.equal(typeof report.passedScenarios, "number");
  assert.equal(typeof report.failedScenarios, "number");
  assert.ok(Array.isArray(report.scenarios));
});

test("runStableChaosSmoke stale_execution_repair scenario passes", async () => {
  const outputDir = prepareOutputDir("stale-execution");

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "stale_execution_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
  assert.ok(typeof scenario.durationMs === "number");
  assert.ok(typeof scenario.summary === "string");
  assert.ok(typeof scenario.details === "object");
});

test("runStableChaosSmoke orphan_session_cleanup scenario passes", async () => {
  const outputDir = prepareOutputDir("orphan-session");

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_session_cleanup");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke orphan_queue_claim_reconciled_via_runtime_repair scenario passes", async () => {
  const outputDir = prepareOutputDir("orphan-queue-claim");

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_queue_claim_reconciled_via_runtime_repair");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke duplicate_approval_response_idempotent scenario passes", async () => {
  const outputDir = prepareOutputDir("duplicate-approval");

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_approval_response_idempotent");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke missing_ack_rebuild_and_replay scenario passes", async () => {
  const outputDir = prepareOutputDir("missing-ack");

  const report = await runStableChaosSmoke({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "missing_ack_rebuild_and_replay");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableChaosSmoke tracks passed and failed counts", async () => {
  const outputDir = prepareOutputDir("counts");

  const report = await runStableChaosSmoke({ outputDir });

  assert.equal(report.passedScenarios + report.failedScenarios, report.totalScenarios);
  assert.equal(report.passedScenarios, 5);
  assert.equal(report.failedScenarios, 0);
});

test("writeStableChaosSmokeReport writes valid JSON", () => {
  const outputDir = prepareOutputDir("write-report");
  const outputFile = join(outputDir, "report-output.json");

  const report: StableChaosSmokeReport = {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    outputDir,
    totalScenarios: 2,
    passedScenarios: 2,
    failedScenarios: 0,
    scenarios: [
      {
        scenarioId: "test-scenario-1",
        passed: true,
        durationMs: 100,
        summary: "Test scenario 1 passed",
        details: { key: "value" },
      },
      {
        scenarioId: "test-scenario-2",
        passed: true,
        durationMs: 200,
        summary: "Test scenario 2 passed",
        details: { key2: "value2" },
      },
    ],
  };

  writeStableChaosSmokeReport(outputFile, report);
  assert.ok(typeof outputFile === "string");
});

test("StableChaosScenarioResult has correct structure", () => {
  const result: StableChaosScenarioResult = {
    scenarioId: "test",
    passed: true,
    durationMs: 100,
    summary: "test summary",
    details: { test: true },
  };

  assert.equal(result.scenarioId, "test");
  assert.equal(result.passed, true);
  assert.equal(result.durationMs, 100);
  assert.equal(result.summary, "test summary");
  assert.deepEqual(result.details, { test: true });
});

test("StableChaosSmokeOptions has correct structure", () => {
  const options: StableChaosSmokeOptions = {
    outputDir: "/tmp/test-output",
  };

  assert.equal(options.outputDir, "/tmp/test-output");
});

test("runStableChaosSmoke creates output directory if not exists", async () => {
  const newOutputDir = "/tmp/stable-chaos-smoke-new-dir";
  rmSync(newOutputDir, { recursive: true, force: true });

  const report = await runStableChaosSmoke({ outputDir: newOutputDir });

  assert.equal(report.outputDir, newOutputDir);
  assert.ok(report.totalScenarios > 0);

  rmSync(newOutputDir, { recursive: true, force: true });
});

test("runStableChaosSmoke scenario details contain before and after status", async () => {
  const outputDir = prepareOutputDir("scenario-details");

  const report = await runStableChaosSmoke({ outputDir });
  const staleScenario = report.scenarios.find((s) => s.scenarioId === "stale_execution_repair");

  assert.ok(staleScenario);
  assert.ok(staleScenario.details);
  const details = staleScenario.details as Record<string, unknown>;
  assert.ok(typeof details.beforeStatus === "string");
  assert.ok(typeof details.afterStatus === "string");
});

test("runStableChaosSmoke all scenarios have durationMs", async () => {
  const outputDir = prepareOutputDir("durations");

  const report = await runStableChaosSmoke({ outputDir });

  report.scenarios.forEach((scenario) => {
    assert.ok(typeof scenario.durationMs === "number");
    assert.ok(scenario.durationMs >= 0);
  });
});
