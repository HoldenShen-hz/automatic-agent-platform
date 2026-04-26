import assert from "node:assert/strict";
import test from "node:test";
import { rmSync, mkdirSync } from "node:fs";

import { runStableRollbackRehearsal, writeStableRollbackRehearsalReport, buildStableRollbackPlaybook } from "../../../../src/platform/stability/stable-rollback-rehearsal.js";

test("runStableRollbackRehearsal runs both scenarios", async () => {
  const outputDir = "/tmp/stable-rollback-test";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollbackRehearsal({ outputDir });

  assert.equal(report.totalScenarios, 2);
  assert.equal(report.scenarios.length, 2);
  assert.ok(report.startedAt);
  assert.ok(report.finishedAt);
  assert.equal(report.outputDir, outputDir);
  assert.ok(report.artifacts);
  assert.ok(report.artifacts.reportPath);
  assert.ok(report.artifacts.playbookPath);
});

test("runStableRollbackRehearsal runtime_repair_rehearsal scenario passes", async () => {
  const outputDir = "/tmp/stable-rollback-test-repair";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollbackRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "runtime_repair_rehearsal");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableRollbackRehearsal manual_takeover_rehearsal scenario passes", async () => {
  const outputDir = "/tmp/stable-rollback-test-takeover";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollbackRehearsal({ outputDir });
  const scenario = report.scenarios.find((s) => s.scenarioId === "manual_takeover_rehearsal");

  assert.ok(scenario);
  assert.equal(scenario.passed, true);
});

test("runStableRollbackRehearsal playbook has rollback targets", async () => {
  const outputDir = "/tmp/stable-rollback-test-playbook";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const report = await runStableRollbackRehearsal({ outputDir });

  assert.ok(report.playbook);
  assert.ok(Array.isArray(report.playbook.targets));
  assert.ok(report.playbook.targets.length > 0);
  assert.ok(Array.isArray(report.playbook.rollbackEntryPoints));
});

test("buildStableRollbackPlaybook returns valid structure", () => {
  const outputDir = "/tmp/stable-rollback-playbook-build-test";
  rmSync(outputDir, { recursive: true, force: true });
  mkdirSync(outputDir, { recursive: true });

  const playbook = buildStableRollbackPlaybook({
    outputDir,
    reportPath: join(outputDir, "report.json"),
    playbookPath: join(outputDir, "playbook.json"),
    scenarios: [],
  });

  assert.ok(playbook.generatedAt);
  assert.equal(playbook.rollbackOwner, "release_manager_oncall");
  assert.ok(Array.isArray(playbook.rollbackEntryPoints));
  assert.ok(Array.isArray(playbook.healthValidation));
});

test("writeStableRollbackRehearsalReport is callable", () => {
  assert.equal(typeof writeStableRollbackRehearsalReport, "function");
});

import { join } from "node:path";
