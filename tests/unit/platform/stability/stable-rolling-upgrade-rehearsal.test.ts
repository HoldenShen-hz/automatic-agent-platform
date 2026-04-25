import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableRollingUpgradeRehearsal, writeStableRollingUpgradeRehearsalReport, buildStableRollingUpgradePlaybook } from "../../../../src/platform/stability/stable-rolling-upgrade-rehearsal.js";

test("runStableRollingUpgradeRehearsal runs both scenarios", async () => {
  const outputDir = "/tmp/stable-rolling-upgrade-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollingUpgradeRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 2);
  assert.equal(report.scenarios.length, 2);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);
  assert.ok(report.artifacts);
  assert.ok(report.artifacts.reportPath);
  assert.ok(report.artifacts.playbookPath);
});

test("runStableRollingUpgradeRehearsal repo_version_canary_routes_to_upgraded_worker scenario passes", async () => {
  const outputDir = "/tmp/stable-rolling-upgrade-test-canary";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollingUpgradeRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "repo_version_canary_routes_to_upgraded_worker");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableRollingUpgradeRehearsal lease_handover_supports_step_boundary_upgrade scenario passes", async () => {
  const outputDir = "/tmp/stable-rolling-upgrade-test-handover";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollingUpgradeRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "lease_handover_supports_step_boundary_upgrade");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableRollingUpgradeRehearsal playbook has upgrade targets", async () => {
  const outputDir = "/tmp/stable-rolling-upgrade-test-playbook";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollingUpgradeRehearsal({ outputDir });

  assert.ok(report.playbook);
  assert.ok(Array.isArray(report.playbook.targets));
  assert.ok(report.playbook.targets.length > 0);
  assert.ok(report.playbook.canaryStrategy);
});

test("buildStableRollingUpgradePlaybook returns valid structure", () => {
  const outputDir = "/tmp/stable-rolling-upgrade-playbook-build-test";
  rmSync(outputDir, { force: true });
  mkdirSync(outputDir, { recursive: true });

  const playbook = buildStableRollingUpgradePlaybook({
    outputDir,
    reportPath: join(outputDir, "report.json"),
    playbookPath: join(outputDir, "playbook.json"),
    scenarios: [],
  });

  assert.ok(playbook.generatedAt);
  assert.equal(playbook.upgradeOwner, "release_manager_oncall");
  assert.ok(Array.isArray(playbook.rolloutProcedure));
  assert.ok(Array.isArray(playbook.healthValidation));
});

test("writeStableRollingUpgradeRehearsalReport is callable", () => {
  assert.equal(typeof writeStableRollingUpgradeRehearsalReport, "function");
});

import { join } from "node:path";