import assert from "node:assert/strict";
import test from "node:test";
import { buildStableRollingUpgradePlaybook } from "../../../../../src/platform/shared/stability/stable-rolling-upgrade-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("buildStableRollingUpgradePlaybook produces upgrade ownership, guardrails, and targets", () => {
    const workspace = createTempWorkspace("aa-upgrade-playbook-");
    try {
        const reportPath = `${workspace}/stable-rolling-upgrade-report.json`;
        const playbookPath = `${workspace}/stable-rolling-upgrade-playbook.json`;
        const playbook = buildStableRollingUpgradePlaybook({
            outputDir: workspace,
            reportPath,
            playbookPath,
            scenarios: [
                {
                    scenarioId: "repo_version_canary_routes_to_upgraded_worker",
                    passed: true,
                    durationMs: 1,
                    summary: "canary routing selects the upgraded worker",
                    details: {},
                },
                {
                    scenarioId: "lease_handover_supports_step_boundary_upgrade",
                    passed: true,
                    durationMs: 1,
                    summary: "handover preserves lineage during upgrade",
                    details: {},
                },
            ],
        });
        assert.equal(playbook.upgradeOwner, "release_manager_oncall");
        assert.equal(playbook.reportPath, reportPath);
        assert.equal(playbook.playbookPath, playbookPath);
        assert.match(playbook.compatibilityWindow, /N\/N-1/);
        assert.equal(playbook.prechecks.length >= 4, true);
        assert.equal(playbook.rolloutProcedure.length >= 4, true);
        assert.equal(playbook.healthValidation.length >= 4, true);
        assert.equal(playbook.rollbackTriggers.length >= 3, true);
        assert.equal(playbook.auditRequirements.length >= 4, true);
        assert.deepEqual(playbook.targets.map((target) => target.targetId), ["coordinator_release", "worker_pool", "active_leases", "dispatch_policy"]);
        assert.equal(playbook.targets.every((target) => target.healthValidation.length >= 2), true);
        assert.equal(playbook.runtimeVersionSnapshot.schemaVersion.upToDate, true);
        assert.equal(playbook.scenarioEvidence.every((scenario) => scenario.passed), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableRollingUpgradePlaybook handles failed scenario in evidence", () => {
    const workspace = createTempWorkspace("aa-upgrade-failed-");
    try {
        const playbook = buildStableRollingUpgradePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "repo_version_canary_routes_to_upgraded_worker",
                    passed: false,
                    durationMs: 3,
                    summary: "canary routing failed - upgraded worker not found",
                    details: { error: "worker_not_found" },
                },
                {
                    scenarioId: "lease_handover_supports_step_boundary_upgrade",
                    passed: true,
                    durationMs: 1,
                    summary: "handover works correctly",
                    details: {},
                },
            ],
        });
        // Failed scenario should be recorded with passed: false
        const failedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "repo_version_canary_routes_to_upgraded_worker");
        assert.ok(failedScenario);
        assert.equal(failedScenario.passed, false);
        // Passed scenario should still be recorded
        const passedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "lease_handover_supports_step_boundary_upgrade");
        assert.ok(passedScenario);
        assert.equal(passedScenario.passed, true);
        // Targets should still be complete despite partial failure
        assert.equal(playbook.targets.length >= 4, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableRollingUpgradePlaybook handles all scenarios failing", () => {
    const workspace = createTempWorkspace("aa-upgrade-all-fail-");
    try {
        const playbook = buildStableRollingUpgradePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "repo_version_canary_routes_to_upgraded_worker",
                    passed: false,
                    durationMs: 1,
                    summary: "failed immediately",
                    details: {},
                },
                {
                    scenarioId: "lease_handover_supports_step_boundary_upgrade",
                    passed: false,
                    durationMs: 1,
                    summary: "failed immediately",
                    details: {},
                },
            ],
        });
        // All scenarios should be marked as failed
        assert.ok(playbook.scenarioEvidence.every((s) => s.passed === false));
        // But playbook structure should still be complete
        assert.equal(playbook.targets.length >= 4, true);
        assert.equal(playbook.rollbackTriggers.length >= 3, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-rolling-upgrade-rehearsal.test.js.map