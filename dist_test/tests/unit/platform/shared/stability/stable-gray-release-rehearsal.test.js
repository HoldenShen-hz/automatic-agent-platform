import assert from "node:assert/strict";
import test from "node:test";
import { buildStableGrayReleasePlaybook } from "../../../../../src/platform/shared/stability/stable-gray-release-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("buildStableGrayReleasePlaybook produces gray cohorts, rollback switches, and guardrails", () => {
    const workspace = createTempWorkspace("aa-gray-playbook-");
    try {
        const reportPath = `${workspace}/stable-gray-release-report.json`;
        const playbookPath = `${workspace}/stable-gray-release-playbook.json`;
        const playbook = buildStableGrayReleasePlaybook({
            outputDir: workspace,
            reportPath,
            playbookPath,
            scenarios: [
                {
                    scenarioId: "gray_cohort_routes_only_to_canary_worker_group",
                    passed: true,
                    durationMs: 1,
                    summary: "gray cohort routing is isolated",
                    details: {},
                },
                {
                    scenarioId: "gray_rollback_switch_restores_stable_routing",
                    passed: true,
                    durationMs: 1,
                    summary: "rollback returns traffic to stable pool",
                    details: {},
                },
            ],
        });
        assert.equal(playbook.rolloutOwner, "release_manager_oncall");
        assert.equal(playbook.reportPath, reportPath);
        assert.equal(playbook.playbookPath, playbookPath);
        assert.equal(playbook.grayTargetKind, "division_and_partner_ring");
        assert.equal(playbook.cohorts.length >= 2, true);
        assert.equal(playbook.featureFlagPlan.length >= 3, true);
        assert.equal(playbook.canaryWorkerPolicy.length >= 3, true);
        assert.equal(playbook.healthValidation.length >= 4, true);
        assert.equal(playbook.rollbackSwitches.length >= 3, true);
        assert.equal(playbook.auditRequirements.length >= 4, true);
        assert.deepEqual(playbook.targets.map((target) => target.targetId), ["feature_flag_bundle", "gray_target_registry", "canary_workers", "rollback_switches"]);
        assert.equal(playbook.targets.every((target) => target.healthValidation.length >= 2), true);
        assert.equal(playbook.runtimeVersionSnapshot.schemaVersion.upToDate, true);
        assert.equal(playbook.scenarioEvidence.every((scenario) => scenario.passed), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableGrayReleasePlaybook handles failed scenario in evidence", () => {
    const workspace = createTempWorkspace("aa-gray-failed-");
    try {
        const playbook = buildStableGrayReleasePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "gray_cohort_routes_only_to_canary_worker_group",
                    passed: false,
                    durationMs: 5,
                    summary: "gray cohort routing leaked to stable workers",
                    details: { error: "route_leak_detected" },
                },
                {
                    scenarioId: "gray_rollback_switch_restores_stable_routing",
                    passed: true,
                    durationMs: 1,
                    summary: "rollback works correctly",
                    details: {},
                },
            ],
        });
        // Failed scenario should be recorded in evidence with passed: false
        const failedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "gray_cohort_routes_only_to_canary_worker_group");
        assert.ok(failedScenario);
        assert.equal(failedScenario.passed, false);
        // Passed scenario should still be recorded correctly
        const passedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "gray_rollback_switch_restores_stable_routing");
        assert.ok(passedScenario);
        assert.equal(passedScenario.passed, true);
        // All targets should still have required fields even after partial failure
        assert.equal(playbook.targets.length >= 4, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableGrayReleasePlaybook handles all scenarios failing", () => {
    const workspace = createTempWorkspace("aa-gray-all-fail-");
    try {
        const playbook = buildStableGrayReleasePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "gray_cohort_routes_only_to_canary_worker_group",
                    passed: false,
                    durationMs: 1,
                    summary: "failed immediately",
                    details: {},
                },
                {
                    scenarioId: "gray_rollback_switch_restores_stable_routing",
                    passed: false,
                    durationMs: 1,
                    summary: "failed immediately",
                    details: {},
                },
            ],
        });
        // All scenarios should be marked as failed in evidence
        assert.ok(playbook.scenarioEvidence.every((s) => s.passed === false));
        // But playbook should still be complete
        assert.equal(playbook.targets.length >= 4, true);
        assert.equal(playbook.cohorts.length >= 2, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-gray-release-rehearsal.test.js.map