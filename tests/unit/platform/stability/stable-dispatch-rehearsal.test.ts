import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableDispatchRehearsal, writeStableDispatchRehearsalReport } from "../../../../src/platform/stability/stable-dispatch-rehearsal.js";

test("runStableDispatchRehearsal runs all four scenarios", async () => {
  const outputDir = "/tmp/stable-dispatch-rehearsal-test";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 4);
  assert.equal(report.scenarios.length, 4);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);

  const scenarioIds = report.scenarios.map((s) => s.scenarioId);
  assert.ok(scenarioIds.includes("dispatch_claims_capable_worker"));
  assert.ok(scenarioIds.includes("dispatch_balances_affinity_against_hotspot_load"));
  assert.ok(scenarioIds.includes("dispatch_respects_dispatch_after"));
  assert.ok(scenarioIds.includes("dispatch_reports_no_worker_for_capability_gap"));
});

test("runStableDispatchRehearsal scenarios have required fields", async () => {
  const outputDir = "/tmp/stable-dispatch-rehearsal-test-fields";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchRehearsal({ outputDir });

  for (const scenario of report.scenarios) {
    assert.ok(typeof scenario.scenarioId === "string");
    assert.ok(typeof scenario.passed === "boolean");
    assert.ok(typeof scenario.durationMs === "number");
    assert.ok(typeof scenario.summary === "string");
    assert.ok(typeof scenario.details === "object");
  }
});

test("runStableDispatchRehearsal dispatch_claims_capable_worker scenario passes", async () => {
  const outputDir = "/tmp/stable-dispatch-rehearsal-test-capable";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableDispatchRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "dispatch_claims_capable_worker");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("writeStableDispatchRehearsalReport is callable", () => {
  assert.equal(typeof writeStableDispatchRehearsalReport, "function");
});
