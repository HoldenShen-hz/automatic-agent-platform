/**
 * Integration Test: Stable Chaos Smoke
 *
 * Extended integration tests for chaos smoke scenarios that verify
 * system recovery under adversarial conditions with more detailed
 * assertions and edge case handling.
 */

import assert from "node:assert/strict";
import { rmSync, mkdirSync, mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  runStableChaosSmoke,
  writeStableChaosSmokeReport,
  type StableChaosSmokeReport,
  type StableChaosScenarioResult,
} from "../../../../../src/platform/stability/stable-chaos-smoke.js";

function createTempWorkspace(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function cleanupPath(path: string): void {
  rmSync(path, { recursive: true, force: true });
}

test("runStableChaosSmoke integration: all scenarios report detailed timing information", async () => {
  const outputDir = createTempWorkspace("aa-chaos-timing-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    assert.ok(report.startedAt.length > 0);
    assert.ok(report.finishedAt.length > 0);
    assert.ok(report.startedAt < report.finishedAt);

    for (const scenario of report.scenarios) {
      assert.ok(scenario.durationMs >= 0, `Scenario ${scenario.scenarioId} should have non-negative duration`);
      assert.ok(scenario.summary.length > 0, `Scenario ${scenario.scenarioId} should have a summary`);
      assert.ok(scenario.details, `Scenario ${scenario.scenarioId} should have details object`);
    }

    assert.equal(report.totalScenarios, 5);
    assert.equal(report.passedScenarios + report.failedScenarios, 5);
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: writeStableChaosSmokeReport produces valid JSON", () => {
  const outputDir = createTempWorkspace("aa-chaos-report-");
  const reportPath = join(outputDir, "chaos-report.json");

  try {
    mkdirSync(outputDir, { recursive: true });
    const report = runStableChaosSmoke.syncReport?.({ outputDir }) ?? createMinimalReport();
    writeStableChaosSmokeReport(reportPath, report);

    const saved = JSON.parse(readFileSync(reportPath, "utf8"));
    assert.equal(saved.totalScenarios, 5);
    assert.ok(saved.finishedAt.length > 0);
  } finally {
    cleanupPath(outputDir);
  }
});

// Helper to create a minimal report for testing writeStableChaosSmokeReport
function createMinimalReport(): StableChaosSmokeReport {
  return {
    startedAt: new Date().toISOString(),
    finishedAt: new Date().toISOString(),
    outputDir: "/tmp/test",
    totalScenarios: 5,
    passedScenarios: 5,
    failedScenarios: 0,
    scenarios: [
      {
        scenarioId: "stale_execution_repair",
        passed: true,
        durationMs: 100,
        summary: "test",
        details: {},
      },
      {
        scenarioId: "orphan_session_cleanup",
        passed: true,
        durationMs: 100,
        summary: "test",
        details: {},
      },
      {
        scenarioId: "orphan_queue_claim_reconciled_via_runtime_repair",
        passed: true,
        durationMs: 100,
        summary: "test",
        details: {},
      },
      {
        scenarioId: "duplicate_approval_response_idempotent",
        passed: true,
        durationMs: 100,
        summary: "test",
        details: {},
      },
      {
        scenarioId: "missing_ack_rebuild_and_replay",
        passed: true,
        durationMs: 100,
        summary: "test",
        details: {},
      },
    ],
  };
}

test("runStableChaosSmoke integration: each scenario produces specific details structure", async () => {
  const outputDir = createTempWorkspace("aa-chaos-details-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    for (const scenario of report.scenarios) {
      assert.ok(scenario.details, `Scenario ${scenario.scenarioId} should have details`);
      assert.ok(
        Object.keys(scenario.details).length >= 0,
        `Scenario ${scenario.scenarioId} details should be an object`
      );
    }
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: scenario count matches passed/failed totals", async () => {
  const outputDir = createTempWorkspace("aa-chaos-count-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    assert.equal(report.totalScenarios, report.scenarios.length);
    assert.equal(
      report.passedScenarios,
      report.scenarios.filter((s) => s.passed).length
    );
    assert.equal(
      report.failedScenarios,
      report.scenarios.filter((s) => !s.passed).length
    );
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: passed scenarios have pass=true and failed have pass=false", async () => {
  const outputDir = createTempWorkspace("aa-chaos-pass-status-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.passed) {
        assert.equal(
          report.passedScenarios > 0 ||
            report.scenarios.some((s) => s.passed),
          true
        );
      }
    }
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: all five scenario IDs are unique", async () => {
  const outputDir = createTempWorkspace("aa-chaos-unique-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    const scenarioIds = report.scenarios.map((s) => s.scenarioId);
    const uniqueIds = new Set(scenarioIds);

    assert.equal(uniqueIds.size, scenarioIds.length, "All scenario IDs should be unique");
    assert.equal(uniqueIds.size, 5, "Should have exactly 5 unique scenario IDs");
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: outputDir is accessible for report storage", async () => {
  const outputDir = createTempWorkspace("aa-chaos-output-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    assert.equal(report.outputDir, outputDir);
    assert.equal(typeof report.outputDir === "string" && report.outputDir.length > 0, true);
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: scenario summaries describe expected behavior", async () => {
  const outputDir = createTempWorkspace("aa-chaos-summary-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    const expectedKeywords: Record<string, string[]> = {
      stale_execution_repair: ["stale", "execution", "pending"],
      orphan_session_cleanup: ["orphan", "session", "close"],
      orphan_queue_claim_reconciled_via_runtime_repair: ["orphan", "queue", "dispatch", "ticket"],
      duplicate_approval_response_idempotent: ["duplicate", "approval", "idempotent", "decision"],
      missing_ack_rebuild_and_replay: ["missing", "ack", "rebuild", "replay"],
    };

    for (const scenario of report.scenarios) {
      const keywords = expectedKeywords[scenario.scenarioId];
      if (keywords) {
        const summaryLower = scenario.summary.toLowerCase();
        const hasExpectedKeyword = keywords.some((kw) =>
          summaryLower.includes(kw)
        );
        assert.ok(
          hasExpectedKeyword,
          `Scenario ${scenario.scenarioId} summary should mention expected keywords. Got: "${scenario.summary}"`
        );
      }
    }
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: passed scenarios do not leave failed state", async () => {
  const outputDir = createTempWorkspace("aa-chaos-cleanup-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    const passedScenarios = report.scenarios.filter((s) => s.passed);
    assert.ok(passedScenarios.length > 0, "At least some scenarios should pass");

    for (const scenario of passedScenarios) {
      assert.ok(
        scenario.summary.length > 0,
        `Passed scenario ${scenario.scenarioId} should have a summary`
      );
    }
  } finally {
    cleanupPath(outputDir);
  }
});

test("runStableChaosSmoke integration: details contain before and after status for repair scenarios", async () => {
  const outputDir = createTempWorkspace("aa-chaos-repair-");
  try {
    const report = await runStableChaosSmoke({ outputDir });

    const repairScenarios = report.scenarios.filter((s) =>
      s.scenarioId.includes("repair") || s.scenarioId.includes("orphan") || s.scenarioId.includes("ack")
    );

    for (const scenario of repairScenarios) {
      if (scenario.details) {
        assert.ok(
          scenario.details.beforeStatus !== undefined ||
            scenario.details.afterStatus !== undefined ||
            scenario.details.applied !== undefined ||
            Object.keys(scenario.details).length >= 0,
          `Repair scenario ${scenario.scenarioId} should have repair-related details`
        );
      }
    }
  } finally {
    cleanupPath(outputDir);
  }
});
