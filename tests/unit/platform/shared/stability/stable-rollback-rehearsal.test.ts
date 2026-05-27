import assert from "node:assert/strict";
import test from "node:test";

import {
  REQUIRED_STABLE_ROLLBACK_TARGETS,
  buildStableRollbackPlaybook,
} from "../../../../../src/platform/shared/stability/stable-rollback-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("buildStableRollbackPlaybook covers required rollback targets, owners, and evidence [stable-rollback-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-stable-rollback-playbook-");

  try {
    const reportPath = `${workspace}/stable-rollback-report.json`;
    const playbookPath = `${workspace}/stable-rollback-playbook.json`;
    const playbook = buildStableRollbackPlaybook({
      outputDir: workspace,
      reportPath,
      playbookPath,
      scenarios: [
        {
          scenarioId: "runtime_repair_rehearsal",
          passed: true,
          durationMs: 12,
          summary: "runtime repair passes",
          details: {},
        },
        {
          scenarioId: "manual_takeover_rehearsal",
          passed: true,
          durationMs: 18,
          summary: "manual takeover passes",
          details: {},
        },
      ],
    });

    assert.equal(playbook.rollbackOwner, "release_manager_oncall");
    assert.equal(playbook.reportPath, reportPath);
    assert.equal(playbook.playbookPath, playbookPath);
    assert.equal(playbook.prechecks.length >= 4, true);
    assert.equal(playbook.healthValidation.length >= 4, true);
    assert.equal(playbook.auditRequirements.length >= 4, true);
    assert.deepEqual(
      playbook.targets.map((target) => target.targetId),
      [...REQUIRED_STABLE_ROLLBACK_TARGETS],
    );
    assert.ok(playbook.targets.every((target) => target.rollbackOwner === "release_manager_oncall"));
    assert.ok(playbook.targets.every((target) => target.rollbackSteps.length >= 2));
    assert.ok(playbook.targets.every((target) => target.healthValidation.length >= 2));
    assert.ok(playbook.targets.every((target) => target.auditRequirements.length >= 1));
    assert.ok(playbook.scenarioEvidence.every((scenario) => scenario.passed));
    assert.equal(playbook.runtimeVersionSnapshot.schemaVersion.upToDate, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("buildStableRollbackPlaybook handles failed scenario and records it in evidence [stable-rollback-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-stable-rollback-failed-");

  try {
    const playbook = buildStableRollbackPlaybook({
      outputDir: workspace,
      reportPath: `${workspace}/report.json`,
      playbookPath: `${workspace}/playbook.json`,
      scenarios: [
        {
          scenarioId: "runtime_repair_rehearsal",
          passed: false,
          durationMs: 5,
          summary: "runtime repair failed - database locked",
          details: { error: "SQLITE_BUSY" },
        },
        {
          scenarioId: "manual_takeover_rehearsal",
          passed: true,
          durationMs: 18,
          summary: "manual takeover passes",
          details: {},
        },
      ],
    });

    // Failed scenario should be recorded in evidence
    const failedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "runtime_repair_rehearsal");
    assert.ok(failedScenario);
    assert.equal(failedScenario!.passed, false);

    // Passed scenario should still be recorded
    const passedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "manual_takeover_rehearsal");
    assert.ok(passedScenario);
    assert.equal(passedScenario!.passed, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("buildStableRollbackPlaybook handles all scenarios failing [stable-rollback-rehearsal]", () => {
  const workspace = createTempWorkspace("aa-stable-rollback-all-fail-");

  try {
    const playbook = buildStableRollbackPlaybook({
      outputDir: workspace,
      reportPath: `${workspace}/report.json`,
      playbookPath: `${workspace}/playbook.json`,
      scenarios: [
        {
          scenarioId: "runtime_repair_rehearsal",
          passed: false,
          durationMs: 1,
          summary: "failed immediately",
          details: {},
        },
        {
          scenarioId: "manual_takeover_rehearsal",
          passed: false,
          durationMs: 2,
          summary: "failed immediately",
          details: {},
        },
      ],
    });

    // All scenarios should be marked as failed in evidence
    assert.ok(playbook.scenarioEvidence.every((s) => s.passed === false));
  } finally {
    cleanupPath(workspace);
  }
});
