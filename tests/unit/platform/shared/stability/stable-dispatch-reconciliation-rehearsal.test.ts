/**
 * Unit tests for Stable Dispatch Reconciliation Rehearsal Module.
 *
 * Tests scenarios:
 * - Orphan claim requeued
 * - Terminal execution ticket cancelled
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDispatchReconciliationRehearsal,
  writeStableDispatchReconciliationRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-dispatch-reconciliation-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `dispatch-reconciliation-test-${Date.now()}`);
}

test("runStableDispatchReconciliationRehearsal executes all two scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });

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

test("orphan_claim_requeued scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "orphan_claim_requeued");

    if (!scenario) {
      throw new Error("Missing orphan_claim_requeued scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("terminal_execution_ticket_cancelled scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "terminal_execution_ticket_cancelled");

    if (!scenario) {
      throw new Error("Missing terminal_execution_ticket_cancelled scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableDispatchReconciliationRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });
    writeStableDispatchReconciliationRehearsalReport(reportPath, report);

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

test("report contains valid startedAt and finishedAt timestamps", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });

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
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });

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
    const report = await runStableDispatchReconciliationRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
