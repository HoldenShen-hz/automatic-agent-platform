import assert from "node:assert/strict";
import test from "node:test";
import { buildStableMaintenancePlaybook } from "../../../../../src/platform/shared/stability/stable-maintenance-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("buildStableMaintenancePlaybook produces maintenance ownership, drain policy, and targets", () => {
    const workspace = createTempWorkspace("aa-maintenance-playbook-");
    try {
        const reportPath = `${workspace}/stable-maintenance-report.json`;
        const playbookPath = `${workspace}/stable-maintenance-playbook.json`;
        const playbook = buildStableMaintenancePlaybook({
            outputDir: workspace,
            reportPath,
            playbookPath,
            scenarios: [
                {
                    scenarioId: "draining_worker_rejects_new_dispatches",
                    passed: true,
                    durationMs: 1,
                    summary: "draining workers stop taking new work",
                    details: {},
                },
                {
                    scenarioId: "step_boundary_handover_preserves_execution_lineage",
                    passed: true,
                    durationMs: 1,
                    summary: "handover preserves lineage during maintenance",
                    details: {},
                },
            ],
        });
        assert.equal(playbook.maintenanceOwner, "runtime_reliability_oncall");
        assert.equal(playbook.reportPath, reportPath);
        assert.equal(playbook.playbookPath, playbookPath);
        assert.match(playbook.maintenanceWindow, /step-boundary handover/i);
        assert.equal(playbook.drainPolicy.length >= 3, true);
        assert.equal(playbook.replacementReadinessChecks.length >= 4, true);
        assert.equal(playbook.handoverProcedure.length >= 4, true);
        assert.equal(playbook.healthValidation.length >= 4, true);
        assert.equal(playbook.rollbackTriggers.length >= 3, true);
        assert.equal(playbook.auditRequirements.length >= 4, true);
        assert.deepEqual(playbook.targets.map((target) => target.targetId), ["maintenance_window", "worker_pool", "active_leases", "dispatch_policy"]);
        assert.equal(playbook.targets.every((target) => target.healthValidation.length >= 2), true);
        assert.equal(playbook.runtimeVersionSnapshot.schemaVersion.upToDate, true);
        assert.equal(playbook.scenarioEvidence.every((scenario) => scenario.passed), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableMaintenancePlaybook handles failed scenario in evidence", () => {
    const workspace = createTempWorkspace("aa-maintenance-failed-");
    try {
        const playbook = buildStableMaintenancePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "draining_worker_rejects_new_dispatches",
                    passed: false,
                    durationMs: 5,
                    summary: "draining workers still accepting new dispatches",
                    details: { error: "dispatch_leak" },
                },
                {
                    scenarioId: "step_boundary_handover_preserves_execution_lineage",
                    passed: true,
                    durationMs: 1,
                    summary: "handover works correctly",
                    details: {},
                },
            ],
        });
        // Failed scenario should be recorded with passed: false
        const failedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "draining_worker_rejects_new_dispatches");
        assert.ok(failedScenario);
        assert.equal(failedScenario.passed, false);
        // Passed scenario should still be recorded correctly
        const passedScenario = playbook.scenarioEvidence.find((s) => s.scenarioId === "step_boundary_handover_preserves_execution_lineage");
        assert.ok(passedScenario);
        assert.equal(passedScenario.passed, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("buildStableMaintenancePlaybook handles all scenarios failing", () => {
    const workspace = createTempWorkspace("aa-maintenance-all-fail-");
    try {
        const playbook = buildStableMaintenancePlaybook({
            outputDir: workspace,
            reportPath: `${workspace}/report.json`,
            playbookPath: `${workspace}/playbook.json`,
            scenarios: [
                {
                    scenarioId: "draining_worker_rejects_new_dispatches",
                    passed: false,
                    durationMs: 1,
                    summary: "failed immediately",
                    details: {},
                },
                {
                    scenarioId: "step_boundary_handover_preserves_execution_lineage",
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
        assert.equal(playbook.drainPolicy.length >= 3, true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-maintenance-rehearsal.test.js.map