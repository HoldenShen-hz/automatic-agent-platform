/**
 * Unit tests for the Stable Chaos Smoke Test Module.
 *
 * Tests the chaos smoke drill scenarios:
 * - Stale execution repair
 * - Orphan session cleanup
 * - Orphan queue claim reconciliation
 * - Duplicate approval idempotency
 * - Missing ACK rebuild and replay
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableChaosSmoke,
  writeStableChaosSmokeReport,
} from "../../../../../src/platform/shared/stability/stable-chaos-smoke.js";

function createTempDir(): string {
  const dir = join("/tmp", `chaos-smoke-test-${Date.now()}`);
  return dir;
}

test("runStableChaosSmoke executes all five scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });

    if (report.totalScenarios !== 5) {
      throw new Error(`Expected 5 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 5) {
      throw new Error(`Expected 5 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("stale_execution_repair scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "stale_execution_repair");

    if (!scenario) {
      throw new Error("Missing stale_execution_repair scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("orphan_session_cleanup scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_session_cleanup");

    if (!scenario) {
      throw new Error("Missing orphan_session_cleanup scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("orphan_queue_claim_reconciled_via_runtime_repair scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "orphan_queue_claim_reconciled_via_runtime_repair",
    );

    if (!scenario) {
      throw new Error("Missing orphan_queue_claim_reconciled_via_runtime_repair scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("duplicate_approval_response_idempotent scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_approval_response_idempotent");

    if (!scenario) {
      throw new Error("Missing duplicate_approval_response_idempotent scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("missing_ack_rebuild_and_replay scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "missing_ack_rebuild_and_replay");

    if (!scenario) {
      throw new Error("Missing missing_ack_rebuild_and_replay scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableChaosSmokeReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableChaosSmoke({ outputDir });
    writeStableChaosSmokeReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 5) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 5) {
      throw new Error("Report should have 5 passed scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });

    if (!report.startedAt) {
      throw new Error("Missing startedAt");
    }
    if (!report.finishedAt) {
      throw new Error("Missing finishedAt");
    }
    if (report.startedAt >= report.finishedAt) {
      throw new Error("startedAt should be before finishedAt");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report outputDir matches options", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableChaosSmoke({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
