import assert from "node:assert/strict";
import test from "node:test";

import {
  buildStableGrayReleasePlaybook,
  REQUIRED_STABLE_GRAY_RELEASE_TARGETS,
  type StableGrayReleaseScenarioResult,
} from "../../../../src/platform/stability/stable-gray-release-rehearsal.js";

test("REQUIRED_STABLE_GRAY_RELEASE_TARGETS contains expected targets", () => {
  assert.ok(REQUIRED_STABLE_GRAY_RELEASE_TARGETS.length > 0);
  assert.ok(REQUIRED_STABLE_GRAY_RELEASE_TARGETS.includes("feature_flag_bundle"));
  assert.ok(REQUIRED_STABLE_GRAY_RELEASE_TARGETS.includes("gray_target_registry"));
  assert.ok(REQUIRED_STABLE_GRAY_RELEASE_TARGETS.includes("canary_workers"));
  assert.ok(REQUIRED_STABLE_GRAY_RELEASE_TARGETS.includes("rollback_switches"));
});

test("buildStableGrayReleasePlaybook returns valid playbook structure", () => {
  const scenarios: StableGrayReleaseScenarioResult[] = [
    {
      scenarioId: "gray_cohort_routes_only_to_canary_worker_group",
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    },
    {
      scenarioId: "gray_rollback_switch_restores_stable_routing",
      passed: true,
      durationMs: 100,
      summary: "test summary",
      details: {},
    },
  ];

  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios,
  });

  assert.ok(playbook.generatedAt.length > 0);
  assert.strictEqual(typeof playbook.rolloutOwner, "string");
  assert.strictEqual(playbook.grayTargetKind, "division_and_partner_ring");
});

test("buildStableGrayReleasePlaybook includes cohorts", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.cohorts));
  assert.ok(playbook.cohorts.length > 0);

  const cohort = playbook.cohorts[0];
  assert.ok(cohort.cohortId.length > 0);
  assert.ok(["division", "tenant_group"].includes(cohort.cohortKind));
  assert.strictEqual(typeof cohort.targetRef, "string");
  assert.ok(Array.isArray(cohort.featureFlags));
});

test("buildStableGrayReleasePlaybook includes feature flag plan", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.featureFlagPlan));
  assert.ok(playbook.featureFlagPlan.length > 0);
});

test("buildStableGrayReleasePlaybook includes canary worker policy", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.canaryWorkerPolicy));
  assert.ok(playbook.canaryWorkerPolicy.length > 0);
});

test("buildStableGrayReleasePlaybook includes health validation steps", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.healthValidation));
  assert.ok(playbook.healthValidation.length > 0);
});

test("buildStableGrayReleasePlaybook includes rollback switches", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.rollbackSwitches));
  assert.ok(playbook.rollbackSwitches.length > 0);
});

test("buildStableGrayReleasePlaybook includes audit requirements", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.auditRequirements));
  assert.ok(playbook.auditRequirements.length > 0);
});

test("buildStableGrayReleasePlaybook includes scenario evidence", () => {
  const scenarios: StableGrayReleaseScenarioResult[] = [
    {
      scenarioId: "gray_cohort_routes_only_to_canary_worker_group",
      passed: true,
      durationMs: 100,
      summary: "cohort routes correctly",
      details: {},
    },
    {
      scenarioId: "gray_rollback_switch_restores_stable_routing",
      passed: false,
      durationMs: 100,
      summary: "rollback failed",
      details: {},
    },
  ];

  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios,
  });

  assert.equal(playbook.scenarioEvidence.length, scenarios.length);
  assert.equal(playbook.scenarioEvidence[0]!.scenarioId, "gray_cohort_routes_only_to_canary_worker_group");
  assert.strictEqual(playbook.scenarioEvidence[0]!.passed, true);
  assert.equal(playbook.scenarioEvidence[1]!.scenarioId, "gray_rollback_switch_restores_stable_routing");
  assert.strictEqual(playbook.scenarioEvidence[1]!.passed, false);
});

test("buildStableGrayReleasePlaybook includes all required targets", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  assert.ok(Array.isArray(playbook.targets));
  assert.equal(playbook.targets.length, REQUIRED_STABLE_GRAY_RELEASE_TARGETS.length);

  for (const targetId of REQUIRED_STABLE_GRAY_RELEASE_TARGETS) {
    const target = playbook.targets.find((t) => t.targetId === targetId);
    assert.ok(target, `playbook should include target: ${targetId}`);
    assert.strictEqual(target!.owner, playbook.rolloutOwner);
  }
});

test("buildStableGrayReleasePlaybook target includes guardrails and health validation", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/test",
    reportPath: "/tmp/test/report.json",
    playbookPath: "/tmp/test/playbook.json",
    scenarios: [],
  });

  for (const target of playbook.targets) {
    assert.ok(Array.isArray(target.rolloutGuardrails));
    assert.ok(target.rolloutGuardrails.length > 0);
    assert.ok(Array.isArray(target.healthValidation));
    assert.ok(target.healthValidation.length > 0);
    assert.ok(target.currentVersion !== undefined);
    assert.ok(target.targetVersion !== undefined);
  }
});

test("buildStableGrayReleasePlaybook includes runtime version snapshot", () => {
  const playbook = buildStableGrayReleasePlaybook({
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

test("buildStableGrayReleasePlaybook paths are correctly set", () => {
  const playbook = buildStableGrayReleasePlaybook({
    outputDir: "/tmp/gray-test",
    reportPath: "/tmp/gray-test/report.json",
    playbookPath: "/tmp/gray-test/playbook.json",
    scenarios: [],
  });

  assert.equal(playbook.reportPath, "/tmp/gray-test/report.json");
  assert.equal(playbook.playbookPath, "/tmp/gray-test/playbook.json");
});
