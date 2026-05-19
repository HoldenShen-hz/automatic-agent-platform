/**
 * Unit tests for Stable Dispatch Rehearsal Module.
 *
 * Tests scenarios:
 * - dispatch_claims_capable_worker
 * - dispatch_balances_affinity_against_hotspot_load
 * - dispatch_respects_dispatch_after
 * - dispatch_reports_no_worker_for_capability_gap
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableDispatchRehearsal, writeStableDispatchRehearsalReport, } from "../../../../../src/platform/shared/stability/stable-dispatch-rehearsal.js";
function createTempDir() {
    return join("/tmp", `dispatch-rehearsal-test-${Date.now()}`);
}
test("runStableDispatchRehearsal executes all four scenarios successfully", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        if (report.totalScenarios !== 4) {
            throw new Error(`Expected 4 scenarios, got ${report.totalScenarios}`);
        }
        if (report.passedScenarios !== 4) {
            throw new Error(`Expected 4 passed scenarios, got ${report.passedScenarios}`);
        }
        if (report.failedScenarios !== 0) {
            throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("dispatch_claims_capable_worker scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "dispatch_claims_capable_worker");
        if (!scenario) {
            throw new Error("Missing dispatch_claims_capable_worker scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("dispatch_balances_affinity_against_hotspot_load scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "dispatch_balances_affinity_against_hotspot_load");
        if (!scenario) {
            throw new Error("Missing dispatch_balances_affinity_against_hotspot_load scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("dispatch_respects_dispatch_after scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "dispatch_respects_dispatch_after");
        if (!scenario) {
            throw new Error("Missing dispatch_respects_dispatch_after scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("dispatch_reports_no_worker_for_capability_gap scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "dispatch_reports_no_worker_for_capability_gap");
        if (!scenario) {
            throw new Error("Missing dispatch_reports_no_worker_for_capability_gap scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("writeStableDispatchRehearsalReport writes valid JSON", async () => {
    const outputDir = createTempDir();
    const reportPath = join(outputDir, "report.json");
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        writeStableDispatchRehearsalReport(reportPath, report);
        const { readFileSync } = await import("node:fs");
        const content = readFileSync(reportPath, "utf8");
        const parsed = JSON.parse(content);
        if (parsed.totalScenarios !== 4) {
            throw new Error("Report missing totalScenarios");
        }
        if (parsed.passedScenarios !== 4) {
            throw new Error("Report should have 4 passed scenarios");
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("report contains valid startedAt and finishedAt timestamps", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        if (!report.startedAt) {
            throw new Error("Missing startedAt");
        }
        if (!report.finishedAt) {
            throw new Error("Missing finishedAt");
        }
        if (report.startedAt >= report.finishedAt) {
            throw new Error("startedAt should be before finishedAt");
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("report outputDir matches options", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableDispatchRehearsal({ outputDir });
        if (report.outputDir !== outputDir) {
            throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=stable-dispatch-rehearsal.test.js.map