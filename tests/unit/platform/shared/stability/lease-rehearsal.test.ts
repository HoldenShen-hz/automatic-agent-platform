/**
 * Unit tests for the Stable Lease Rehearsal Module.
 *
 * Tests the lease rehearsal drill scenarios:
 * - Lease reclaim increments fencing tokens
 * - Stale writes rejected after failover
 * - Lease handover preserves lineage
 * - Worker registry capacity visibility
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableLeaseRehearsal,
  writeStableLeaseRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-lease-rehearsal.js";

function createTempDir(): string {
  const dir = join("/tmp", `lease-rehearsal-test-${Date.now()}`);
  return dir;
}

test("runStableLeaseRehearsal executes all four scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });

    if (report.totalScenarios !== 4) {
      throw new Error(`Expected 4 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios !== 4) {
      throw new Error(`Expected 4 passed scenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios !== 0) {
      throw new Error(`Expected 0 failed scenarios, got ${report.failedScenarios}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("lease_reclaim_increments_fencing scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "lease_reclaim_increments_fencing");

    if (!scenario) {
      throw new Error("Missing lease_reclaim_increments_fencing scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
    if (scenario.durationMs <= 0) {
      throw new Error("Expected positive duration");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("stale_write_rejected_after_failover scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "stale_write_rejected_after_failover");

    if (!scenario) {
      throw new Error("Missing stale_write_rejected_after_failover scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("lease_handover_preserves_lineage scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "lease_handover_preserves_lineage");

    if (!scenario) {
      throw new Error("Missing lease_handover_preserves_lineage scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("worker_registry_capacity_visible scenario passes", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });
    const scenario = report.scenarios.find((s) => s.scenarioId === "worker_registry_capacity_visible");

    if (!scenario) {
      throw new Error("Missing worker_registry_capacity_visible scenario");
    }
    if (!scenario.passed) {
      throw new Error(`Scenario failed: ${scenario.summary}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableLeaseRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableLeaseRehearsal({ outputDir });
    writeStableLeaseRehearsalReport(reportPath, report);

    // Verify file was created with content
    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content);

    if (parsed.totalScenarios !== 4) {
      throw new Error("Report missing totalScenarios");
    }
    if (parsed.passedScenarios !== 4) {
      throw new Error("Report missing passedScenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableLeaseRehearsal({ outputDir });

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
    const report = await runStableLeaseRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
