/**
 * Unit tests for Stable Worker Writeback Rehearsal Module.
 *
 * Tests scenarios:
 * - Worker writeback completes execution
 * - Duplicate writeback rejected
 * - Stale fencing writeback rejected
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableWorkerWritebackRehearsal,
  writeStableWorkerWritebackRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-worker-writeback-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `worker-writeback-test-${Date.now()}`);
}

test("runStableWorkerWritebackRehearsal executes all three scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });

    if (report.totalScenarios !== 3) {
      throw new Error(`Expected 3 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 3) {
      throw new Error(`Expected 3 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("worker_writeback_completes_execution scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "worker_writeback_completes_execution");

    if (!scenario) {
      throw new Error("Missing worker_writeback_completes_execution scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("duplicate_writeback_rejected scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "duplicate_writeback_rejected");

    if (!scenario) {
      throw new Error("Missing duplicate_writeback_rejected scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("stale_fencing_writeback_rejected scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "stale_fencing_writeback_rejected");

    if (!scenario) {
      throw new Error("Missing stale_fencing_writeback_rejected scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableWorkerWritebackRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });
    writeStableWorkerWritebackRehearsalReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 3) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 3) {
      throw new Error("Report should have 3 passed scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });

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
    const report = await runStableWorkerWritebackRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("each scenario has durationMs greater than zero", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableWorkerWritebackRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
