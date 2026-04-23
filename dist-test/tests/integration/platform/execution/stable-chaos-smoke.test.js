import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableChaosSmoke, writeStableChaosSmokeReport, } from "../../../../src/platform/shared/stability/stable-chaos-smoke.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable chaos smoke covers core recovery and idempotency scenarios", async () => {
    const workspace = createTempWorkspace("aa-chaos-smoke-");
    try {
        const report = await runStableChaosSmoke({
            outputDir: workspace,
        });
        const reportPath = join(workspace, "stable-chaos-report.json");
        writeStableChaosSmokeReport(reportPath, report);
        assert.equal(report.totalScenarios, 5);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.passedScenarios, 5);
        assert.ok(report.scenarios.every((scenario) => scenario.passed));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "stale_execution_repair"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "orphan_session_cleanup"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "orphan_queue_claim_reconciled_via_runtime_repair"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "duplicate_approval_response_idempotent"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "missing_ack_rebuild_and_replay"));
        assert.equal(existsSync(reportPath), true);
        const persisted = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(persisted.failedScenarios, 0);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-chaos-smoke.test.js.map