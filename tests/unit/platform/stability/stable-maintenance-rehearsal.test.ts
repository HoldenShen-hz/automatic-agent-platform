import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStableMaintenancePlaybook,
  REQUIRED_STABLE_MAINTENANCE_TARGETS,
  type StableMaintenanceScenarioResult,
} from "../../../../src/platform/stability/stable-maintenance-rehearsal.js";

test("REQUIRED_STABLE_MAINTENANCE_TARGETS contains expected targets", () => {
  assert.ok(REQUIRED_STABLE_MAINTENANCE_TARGETS.length > 0);
  assert.ok(REQUIRED_STABLE_MAINTENANCE_TARGETS.includes("maintenance_window"));
  assert.ok(REQUIRED_STABLE_MAINTENANCE_TARGETS.includes("worker_pool"));
  assert.ok(REQUIRED_STABLE_MAINTENANCE_TARGETS.includes("active_leases"));
  assert.ok(REQUIRED_STABLE_MAINTENANCE_TARGETS.includes("dispatch_policy"));
});

test("buildStableMaintenancePlaybook returns valid playbook structure", () => {
  const scenarios: StableMaintenanceScenarioResult[] = [
    {
      scenarioId: "draining_worker_rejects_new_dispatches",
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    },
    {
      scenarioId: "step_boundary_handover_preserves_execution_lineage",
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    },
  ];

  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios,
  });

  assert.ok(playbook.generatedAt.length > 0);
  assert.strictEqual(typeof playbook.maintenanceOwner, "string");
  assert.ok(playbook.maintenanceWindow.length > 0);
});

test("buildStableMaintenancePlaybook includes drain policy", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.drainPolicy));
  assert.ok(playbook.drainPolicy.length > 0);
});

test("buildStableMaintenancePlaybook includes replacement readiness checks", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.replacementReadinessChecks));
  assert.ok(playbook.replacementReadinessChecks.length > 0);
});

test("buildStableMaintenancePlaybook includes handover procedure", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.handoverProcedure));
  assert.ok(playbook.handoverProcedure.length > 0);
});

test("buildStableMaintenancePlaybook includes health validation steps", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.healthValidation));
  assert.ok(playbook.healthValidation.length > 0);
});

test("buildStableMaintenancePlaybook includes rollback triggers", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.rollbackTriggers));
  assert.ok(playbook.rollbackTriggers.length > 0);
});

test("buildStableMaintenancePlaybook includes audit requirements", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.auditRequirements));
  assert.ok(playbook.auditRequirements.length > 0);
});

test("buildStableMaintenancePlaybook includes scenario evidence", () => {
  const scenarios: StableMaintenanceScenarioResult[] = [
    {
      scenarioId: "draining_worker_rejects_new_dispatches",
      passed: true,
      durationMs: 100,
      summary: "drain works correctly",
      details: {},
    },
    {
      scenarioId: "step_boundary_handover_preserves_execution_lineage",
      passed: false,
      durationMs: 100,
      summary: "handover failed",
      details: {},
    },
  ];

  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios,
  });

  assert.equal(playbook.scenarioEvidence.length, scenarios.length);
  assert.equal(playbook.scenarioEvidence[0]!.scenarioId, "draining_worker_rejects_new_dispatches");
  assert.strictEqual(playbook.scenarioEvidence[0]!.passed, true);
  assert.equal(playbook.scenarioEvidence[1]!.scenarioId, "step_boundary_handover_preserves_execution_lineage");
  assert.strictEqual(playbook.scenarioEvidence[1]!.passed, false);
});

test("buildStableMaintenancePlaybook includes all required targets", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.targets));
  assert.equal(playbook.targets.length, REQUIRED_STABLE_MAINTENANCE_TARGETS.length);

  for (const targetId of REQUIRED_STABLE_MAINTENANCE_TARGETS) {
    const target = playbook.targets.find((t) => t.targetId === targetId);
    assert.ok(target, `playbook should include target: ${targetId}`);
  }
});

test("buildStableMaintenancePlaybook target includes guardrails and health validation", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  for (const target of playbook.targets) {
    assert.ok(Array.isArray(target.guardrails));
    assert.ok(target.guardrails.length > 0);
    assert.ok(Array.isArray(target.healthValidation));
    assert.ok(target.healthValidation.length > 0);
    assert.ok(target.currentVersion !== undefined);
    assert.ok(target.targetVersion !== undefined);
  }
});

test("buildStableMaintenancePlaybook includes runtime version snapshot", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(playbook.runtimeVersionSnapshot);
  // Runtime version snapshot should have at least one version field
  const hasVersion =
    playbook.runtimeVersionSnapshot.buildCommit !== null ||
    playbook.runtimeVersionSnapshot.applicationVersion !== null ||
    playbook.runtimeVersionSnapshot.configVersion !== null;
  assert.ok(hasVersion, "runtime version snapshot should have at least one version");
});

test("buildStableMaintenancePlaybook paths are correctly set", () => {
  const playbook = buildStableMaintenancePlaybook({
    outputDir: "/tmp/maintenance-test",
    reportPath: "/tmp/maintenance-test/report.json",
    playbookPath: "/tmp/maintenance-test/playbook.json",
    scenarios: [],
  });

  assert.equal(playbook.reportPath, "/tmp/maintenance-test/report.json");
  assert.equal(playbook.playbookPath, "/tmp/maintenance-test/playbook.json");
});
