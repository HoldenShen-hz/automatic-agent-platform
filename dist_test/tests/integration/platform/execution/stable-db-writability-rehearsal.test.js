import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableDbWritabilityRehearsal, writeStableDbWritabilityRehearsalReport, } from "../../../../src/platform/shared/stability/stable-db-writability-rehearsal.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable DB writability rehearsal validates read-only health, admission fail-close, and dispatch blocking", async () => {
    const workspace = createTempWorkspace("aa-stable-db-writability-");
    try {
        const report = await runStableDbWritabilityRehearsal({
            outputDir: workspace,
        });
        const outputFile = join(workspace, "stable-db-writability-report.json");
        writeStableDbWritabilityRehearsalReport(outputFile, report);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.totalScenarios, 3);
        assert.ok(report.scenarios.every((scenario) => scenario.passed));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "health_and_doctor_fail_close_when_db_is_not_writable"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode"));
        assert.equal(existsSync(outputFile), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-db-writability-rehearsal.test.js.map