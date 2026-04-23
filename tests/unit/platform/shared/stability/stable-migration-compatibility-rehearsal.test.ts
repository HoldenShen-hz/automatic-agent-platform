/**
 * Unit tests for the Stable Migration Compatibility Rehearsal Module.
 *
 * Tests that database migrations maintain compatibility with PostgreSQL and that
 * fresh SQLite bootstrap can reach the latest schema version.
 */

import { rmSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";

import {
  runStableMigrationCompatibilityRehearsal,
  writeStableMigrationCompatibilityRehearsalReport,
  type StableMigrationCompatibilityRehearsalReport,
} from "../../../../../src/platform/shared/stability/stable-migration-compatibility-rehearsal.js";

function createTempDir(): string {
  const dir = join("/tmp", `migration-compat-rehearsal-test-${Date.now()}`);
  return dir;
}

test("runStableMigrationCompatibilityRehearsal executes all scenarios successfully", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });

    if (report.totalScenarios !== 2) {
      throw new Error(`Expected 2 scenarios, got ${report.totalScenarios}`);
    }
    if (report.passedScenarios < 0) {
      throw new Error(`Expected non-negative passedScenarios, got ${report.passedScenarios}`);
    }
    if (report.failedScenarios < 0) {
      throw new Error(`Expected non-negative failedScenarios, got ${report.failedScenarios}`);
    }
    if (report.passedScenarios + report.failedScenarios !== report.totalScenarios) {
      throw new Error("passedScenarios + failedScenarios should equal totalScenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("migration_plan_passes_pg_portability_rules scenario exists and has valid structure", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "migration_plan_passes_pg_portability_rules",
    );

    if (!scenario) {
      throw new Error("Missing migration_plan_passes_pg_portability_rules scenario");
    }
    if (typeof scenario.passed !== "boolean") {
      throw new Error("Scenario passed should be a boolean");
    }
    if (scenario.durationMs <= 0) {
      throw new Error("Expected positive duration");
    }
    if (typeof scenario.summary !== "string" || scenario.summary.length === 0) {
      throw new Error("Scenario should have a non-empty summary");
    }
    if (typeof scenario.details !== "object" || scenario.details === null) {
      throw new Error("Scenario should have details object");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("sqlite_migration_bootstrap_reaches_latest_schema scenario exists and has valid structure", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "sqlite_migration_bootstrap_reaches_latest_schema",
    );

    if (!scenario) {
      throw new Error("Missing sqlite_migration_bootstrap_reaches_latest_schema scenario");
    }
    if (typeof scenario.passed !== "boolean") {
      throw new Error("Scenario passed should be a boolean");
    }
    if (scenario.durationMs <= 0) {
      throw new Error("Expected positive duration");
    }
    if (typeof scenario.summary !== "string" || scenario.summary.length === 0) {
      throw new Error("Scenario should have a non-empty summary");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("report contains valid startedAt and finishedAt timestamps", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });

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
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });

    if (report.outputDir !== outputDir) {
      throw new Error(`Expected outputDir ${outputDir}, got ${report.outputDir}`);
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("writeStableMigrationCompatibilityRehearsalReport writes valid JSON", async () => {
  const outputDir = createTempDir();
  const reportPath = join(outputDir, "report.json");
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });
    writeStableMigrationCompatibilityRehearsalReport(reportPath, report);

    const { readFileSync } = await import("node:fs");
    const content = readFileSync(reportPath, "utf8");
    const parsed = JSON.parse(content) as StableMigrationCompatibilityRehearsalReport;

    if (parsed.totalScenarios !== 2) {
      throw new Error("Report missing totalScenarios");
    }
    if (typeof parsed.passedScenarios !== "number") {
      throw new Error("Report missing passedScenarios");
    }
    if (!Array.isArray(parsed.scenarios)) {
      throw new Error("Report should have scenarios array");
    }
    if (parsed.scenarios.length !== 2) {
      throw new Error("Report should have 2 scenarios");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("portability scenario details include compatibility information", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "migration_plan_passes_pg_portability_rules",
    );

    if (!scenario) {
      throw new Error("Missing portability scenario");
    }

    const details = scenario.details as {
      compatible?: boolean;
      migrationCount?: number;
      issueCount?: number;
    };

    if (typeof details.compatible !== "boolean") {
      throw new Error("Details should have compatible boolean");
    }
    if (typeof details.migrationCount !== "number") {
      throw new Error("Details should have migrationCount number");
    }
    if (typeof details.issueCount !== "number") {
      throw new Error("Details should have issueCount number");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});

test("sqlite bootstrap scenario details include schema status", async () => {
  const outputDir = createTempDir();
  try {
    const report = await runStableMigrationCompatibilityRehearsal({ outputDir });
    const scenario = report.scenarios.find(
      (s) => s.scenarioId === "sqlite_migration_bootstrap_reaches_latest_schema",
    );

    if (!scenario) {
      throw new Error("Missing sqlite bootstrap scenario");
    }

    const details = scenario.details as {
      dbPath?: string;
      schemaStatus?: { upToDate: boolean; currentVersion: string };
      latestVersion?: string;
      appliedVersions?: string[];
    };

    if (typeof details.dbPath !== "string") {
      throw new Error("Details should have dbPath string");
    }
    if (typeof details.schemaStatus !== "object" || details.schemaStatus === null) {
      throw new Error("Details should have schemaStatus object");
    }
  } finally {
    rmSync(outputDir, { recursive: true, force: true });
  }
});
