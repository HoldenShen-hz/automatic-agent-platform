/**
 * Unit tests for Stable DB Writability Rehearsal Module.
 *
 * Tests scenarios:
 * - Health and doctor fail-close when DB is not writable
 * - Multi-step admission rejects new work in read-only mode
 * - Dispatch blocks claims without dropping pending ticket in read-only mode
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableDbWritabilityRehearsal,
  writeStableDbWritabilityRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-db-writability-rehearsal.js";

function createTempDir(): string {
  return join("/tmp", `db-writability-test-${Date.now()}`);
}

test("runStableDbWritabilityRehearsal executes all three scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir });

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

test("health_and_doctor_fail_close_when_db_is_not_writable scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "health_and_doctor_fail_close_when_db_is_not_writable",
    );

    if (!scenario) {
      throw new Error("Missing health_and_doctor_fail_close_when_db_is_not_writable scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("multi_step_admission_rejects_new_work_in_read_only_mode scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "multi_step_admission_rejects_new_work_in_read_only_mode",
    );

    if (!scenario) {
      throw new Error("Missing multi_step_admission_rejects_new_work_in_read_only_mode scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode",
    );

    if (!scenario) {
      throw new Error(
        "Missing dispatch_blocks_claims_without_dropping_pending_ticket_in_read_only_mode scenario",
      );
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableDbWritabilityRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableDbWritabilityRehearsal({ outputDir });
    writeStableDbWritabilityRehearsalReport(reportPath, report);

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
    const report = await runStableDbWritabilityRehearsal({ outputDir });

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
    const report = await runStableDbWritabilityRehearsal({ outputDir });

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
    const report = await runStableDbWritabilityRehearsal({ outputDir });

    for (const scenario of report.scenarios) {
      if (scenario.durationMs <= 0) {
        throw new Error(`Scenario ${scenario.scenarioId} should have durationMs > 0`);
      }
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
