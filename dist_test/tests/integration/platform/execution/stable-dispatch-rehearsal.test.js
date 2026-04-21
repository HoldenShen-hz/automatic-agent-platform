import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableDispatchRehearsal, writeStableDispatchRehearsalReport, } from "../../../../src/platform/shared/stability/stable-dispatch-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable dispatch rehearsal validates ticket creation, hotspot load shedding, delayed dispatch, and capability gating", async () => {
    const workspace = createTempWorkspace("aa-stable-dispatch-");
    try {
        const report = await runStableDispatchRehearsal({
            outputDir: workspace,
        });
        const reportPath = join(workspace, "stable-dispatch-report.json");
        writeStableDispatchRehearsalReport(reportPath, report);
        assert.equal(report.totalScenarios, 4);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.passedScenarios, 4);
        assert.ok(report.scenarios.every((scenario) => scenario.passed));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_claims_capable_worker"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_balances_affinity_against_hotspot_load"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_respects_dispatch_after"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_reports_no_worker_for_capability_gap"));
        assert.equal(existsSync(reportPath), true);
        const persisted = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(persisted.failedScenarios, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-dispatch-rehearsal.test.js.map