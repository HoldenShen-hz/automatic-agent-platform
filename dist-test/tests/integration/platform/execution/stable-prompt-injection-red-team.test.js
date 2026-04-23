import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStablePromptInjectionRedTeam, writeStablePromptInjectionRedTeamReport, } from "../../../../src/platform/shared/stability/stable-prompt-injection-red-team.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable prompt injection red-team writes a reusable report artifact", async () => {
    const workspace = createTempWorkspace("aa-prompt-red-team-");
    try {
        const report = await runStablePromptInjectionRedTeam({ outputDir: workspace });
        const reportPath = join(workspace, "stable-prompt-injection-report.json");
        writeStablePromptInjectionRedTeamReport(reportPath, report);
        assert.equal(report.totalScenarios, 5);
        assert.equal(report.failedScenarios, 0);
        assert.equal(report.passedScenarios, 5);
        assert.equal(report.artifacts.reportPath, reportPath);
        assert.equal(existsSync(reportPath), true);
        assert.ok(report.scenarios.every((scenario) => scenario.passed));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "instruction_override_secret_exfiltration" &&
            scenario.redactionCount > 0 &&
            scenario.actualRisk === "high"));
        assert.ok(report.scenarios.some((scenario) => scenario.scenarioId === "benign_runtime_control" && scenario.actualRisk === "none"));
        const persisted = JSON.parse(readFileSync(reportPath, "utf8"));
        assert.equal(persisted.failedScenarios, 0);
        assert.ok(persisted.scenarios.some((scenario) => scenario.scenarioId === "system_prompt_dump_request" && scenario.actualRisk === "high"));
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-prompt-injection-red-team.test.js.map