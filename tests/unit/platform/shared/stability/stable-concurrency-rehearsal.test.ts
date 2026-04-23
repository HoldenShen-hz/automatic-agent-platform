/**
 * Unit tests for Stable Concurrency Rehearsal Module.
 *
 * Tests scenarios:
 * - Expired lock released
 * - Active execution conflict fail-closed
 * - Competing write transactions fail-closed
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableConcurrencyRehearsal,
  writeStableConcurrencyRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-concurrency-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `concurrency-test-${Date.now()}`);
}

test("runStableConcurrencyRehearsal executes all three scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableConcurrencyRehearsal({ outputDir });

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

test("expired_lock_released scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableConcurrencyRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "expired_lock_released");

    if (!scenario) {
      throw new Error("Missing expired_lock_released scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("active_execution_conflict_fail_closed scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableConcurrencyRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "active_execution_conflict_fail_closed");

    if (!scenario) {
      throw new Error("Missing active_execution_conflict_fail_closed scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("competing_write_transactions_fail_closed scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableConcurrencyRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "competing_write_transactions_fail_closed");

    if (!scenario) {
      throw new Error("Missing competing_write_transactions_fail_closed scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableConcurrencyRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableConcurrencyRehearsal({ outputDir });
    writeStableConcurrencyRehearsalReport(reportPath, report);

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
    const report = await runStableConcurrencyRehearsal({ outputDir });

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
    const report = await runStableConcurrencyRehearsal({ outputDir });

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
    const report = await runStableConcurrencyRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
