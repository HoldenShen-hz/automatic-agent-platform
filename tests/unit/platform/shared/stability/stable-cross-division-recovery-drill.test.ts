/**
 * Unit tests for Stable Cross Division Recovery Drill Module.
 *
 * Tests scenarios:
 * - Cross division overview
 * - Cross division replay matrix
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableCrossDivisionRecoveryDrill,
  writeStableCrossDivisionRecoveryDrillReport,
} from "../../../../../src/platform/shared/stability/stable-cross-division-recovery-drill.js";

function createTempDir(): string {
  return join("/tmp", `cross-division-test-${Date.now()}-${Math.random().toString(16).slice(2)}`);
}

test("runStableCrossDivisionRecoveryDrill executes all two scenarios successfully [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

    if (report.totalScenarios !== 2) {
      throw new Error(`Expected 2 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 2) {
      throw new Error(`Expected 2 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cross_division_overview scenario passes [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "cross_division_overview");

    if (!scenario) {
      throw new Error("Missing cross_division_overview scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("cross_division_replay_matrix scenario passes [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "cross_division_replay_matrix");

    if (!scenario) {
      throw new Error("Missing cross_division_replay_matrix scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableCrossDivisionRecoveryDrillReport writes valid JSON [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });
    writeStableCrossDivisionRecoveryDrillReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 2) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 2) {
      throw new Error("Report should have 2 passed scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

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

test("report outputDir matches options [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("each scenario has durationMs greater than zero [stable-cross-division-recovery-drill]", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableCrossDivisionRecoveryDrill({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
