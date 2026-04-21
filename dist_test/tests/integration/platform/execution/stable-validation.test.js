import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { runStableValidation } from "../../../../src/platform/shared/stability/stable-runtime-validator.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("stable runtime validator produces a repeatable baseline report", async () => {
    const workspace = createTempWorkspace("aa-stable-validate-");
    try {
        const report = await runStableValidation({
            outputDir: workspace,
            iterations: 2,
        });
        assert.equal(report.iterations, 2);
        assert.equal(report.totalRuns, 14);
        assert.equal(report.failedRuns, 0);
        assert.equal(report.passedRuns, 14);
        assert.equal(report.integrityFailures, 0);
        assert.equal(report.backupFailures, 0);
        assert.ok(report.averageDurationMs >= 0);
        assert.ok(report.maxDurationMs >= report.averageDurationMs);
        assert.equal(report.baselineComparison.status, "baseline_created");
        assert.equal(report.baselineComparison.baselineCreated, true);
        assert.equal(report.artifacts.reportPath, join(workspace, "stable-validation-report.json"));
        assert.equal(report.artifacts.baselinePath, join(workspace, "stable-validation-baseline.json"));
        assert.equal(report.artifacts.inventoryPath, join(workspace, "golden-task-inventory.json"));
        assert.equal(existsSync(report.artifacts.reportPath), true);
        assert.equal(existsSync(report.artifacts.baselinePath), true);
        assert.equal(existsSync(report.artifacts.inventoryPath), true);
        assert.equal(report.caseSummaries.length, 7);
        const persistedReport = JSON.parse(readFileSync(report.artifacts.reportPath, "utf8"));
        const persistedInventory = JSON.parse(readFileSync(report.artifacts.inventoryPath, "utf8"));
        const persistedBaseline = JSON.parse(readFileSync(report.artifacts.baselinePath, "utf8"));
        assert.equal(persistedReport.baselineComparison.status, "baseline_created");
        assert.equal(persistedReport.baselineComparison.baselineCreated, true);
        assert.equal(persistedReport.artifacts.reportPath, report.artifacts.reportPath);
        assert.equal(persistedReport.artifacts.baselinePath, report.artifacts.baselinePath);
        assert.equal(persistedReport.artifacts.inventoryPath, report.artifacts.inventoryPath);
        assert.equal(persistedReport.caseSummaries.length, report.caseSummaries.length);
        assert.equal(persistedInventory.totalCases, report.caseSummaries.length);
        assert.deepEqual(persistedInventory.missingRequiredClasses, []);
        assert.equal(persistedBaseline.totalRuns, report.totalRuns);
        assert.equal(persistedBaseline.failedRuns, report.failedRuns);
        assert.equal(persistedBaseline.caseSummaries.length, report.caseSummaries.length);
    }
    finally {
        cleanupPath(workspace);
    }
});
test("stable runtime validator stays green when reusing the same output directory", async () => {
    const workspace = createTempWorkspace("aa-stable-validate-reuse-");
    try {
        const firstReport = await runStableValidation({
            outputDir: workspace,
            iterations: 1,
        });
        const secondReport = await runStableValidation({
            outputDir: workspace,
            iterations: 1,
        });
        assert.equal(firstReport.failedRuns, 0);
        assert.equal(firstReport.passedRuns, 7);
        assert.equal(firstReport.baselineComparison.baselineCreated, true);
        assert.equal(secondReport.failedRuns, 0);
        assert.equal(secondReport.passedRuns, 7);
        assert.equal(secondReport.integrityFailures, 0);
        assert.equal(secondReport.backupFailures, 0);
        assert.equal(secondReport.artifacts.reportPath, firstReport.artifacts.reportPath);
        assert.equal(secondReport.artifacts.baselinePath, firstReport.artifacts.baselinePath);
        assert.equal(secondReport.artifacts.inventoryPath, firstReport.artifacts.inventoryPath);
        assert.equal(secondReport.baselineComparison.baselineCreated, false);
        assert.equal(secondReport.baselineComparison.regressionDetected, false);
        assert.equal(secondReport.baselineComparison.failedRunsDelta, 0);
        assert.equal(secondReport.baselineComparison.integrityFailuresDelta, 0);
        assert.equal(secondReport.baselineComparison.backupFailuresDelta, 0);
        assert.equal(existsSync(secondReport.artifacts.reportPath), true);
        assert.equal(existsSync(secondReport.artifacts.baselinePath), true);
        assert.equal(existsSync(secondReport.artifacts.inventoryPath), true);
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=stable-validation.test.js.map