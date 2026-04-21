/**
 * Unit tests for the Stable Worker Handshake Rehearsal Module.
 *
 * Tests the worker handshake drill scenarios:
 * - Worker claim consumes ticket
 * - Worker heartbeat renews lease
 * - Stale fencing handshake rejected
 */
import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { runStableWorkerHandshakeRehearsal, writeStableWorkerHandshakeRehearsalReport, } from "../../../../../src/platform/shared/stability/stable-worker-handshake-rehearsal.js";
function createTempDir() {
    const dir = join("/tmp", `worker-handshake-test-${Date.now()}`);
    return dir;
}
test("runStableWorkerHandshakeRehearsal executes all three scenarios successfully", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        if (report.totalScenarios !== 3) {
            throw new Error(`Expected 3 scenarios, got ${report.totalScenarios}`);
        }
        if (report.passedScenarios !== 3) {
            throw new Error(`Expected 3 passed scenarios, got ${report.passedScenarios}`);
        }
        if (report.failedScenarios !== 0) {
            throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("worker_claim_consumes_ticket scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "worker_claim_consumes_ticket");
        if (!scenario) {
            throw new Error("Missing worker_claim_consumes_ticket scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("worker_heartbeat_renews_lease scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "worker_heartbeat_renews_lease");
        if (!scenario) {
            throw new Error("Missing worker_heartbeat_renews_lease scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("stale_fencing_handshake_rejected scenario passes", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        const scenario = report.scenarios.find((s) => s.scenarioId === "stale_fencing_handshake_rejected");
        if (!scenario) {
            throw new Error("Missing stale_fencing_handshake_rejected scenario");
        }
        if (!scenario.passed) {
            throw new Error(`Scenario failed: ${scenario.summary}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("writeStableWorkerHandshakeRehearsalReport writes valid JSON", async () => {
    const outputDir = createTempDir();
    const reportPath = join(outputDir, "report.json");
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        writeStableWorkerHandshakeRehearsalReport(reportPath, report);
        const { readFileSync } = await import("node:fs");
        const content = readFileSync(reportPath, "utf8");
        const parsed = JSON.parse(content);
        if (parsed.totalScenarios !== 3) {
            throw new Error("Report missing totalScenarios");
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("report contains valid startedAt and finishedAt timestamps", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        if (!report.startedAt) {
            throw new Error("Missing startedAt");
        }
        if (!report.finishedAt) {
            throw new Error("Missing finishedAt");
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
test("report outputDir matches options", async () => {
    const outputDir = createTempDir();
    try {
        const report = await runStableWorkerHandshakeRehearsal({ outputDir });
        if (report.outputDir !== outputDir) {
            throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
        }
    }
    finally {
        rmSync(outputDir, { recursive: true, force: true });
    }
});
//# sourceMappingURL=worker-handshake-rehearsal.test.js.map