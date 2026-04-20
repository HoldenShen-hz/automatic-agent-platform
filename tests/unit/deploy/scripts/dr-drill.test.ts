import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync, mkdirSync, writeFileSync, rmSync } from "fs";
import { join } from "path";

const DR_CONFIG_PATH = "config/dr/default.json";
const DR_SCRIPT_PATH = "deploy/scripts/dr-drill.sh";

interface DRConfig {
  rtoSeconds: number;
  rpoSeconds: number;
  backupRetentionDays: number;
  backupSchedule: string;
  drillSchedule: string;
  components: string[];
  alertThresholds: {
    rtoBreachMinutes: number;
    rpoBreachMinutes: number;
    backupFailureCount: number;
  };
  retentionPolicy: {
    dailyBackups: number;
    weeklyBackups: number;
    monthlyBackups: number;
  };
}

test("DR config exists and is valid JSON", () => {
  assert.ok(
    existsSync(DR_CONFIG_PATH),
    `DR config should exist at ${DR_CONFIG_PATH}`
  );

  const content = readFileSync(DR_CONFIG_PATH, "utf-8");
  const config = JSON.parse(content) as DRConfig;

  assert.equal(typeof config.rtoSeconds, "number");
  assert.equal(typeof config.rpoSeconds, "number");
});

test("DR config has valid RTO/RPO thresholds", () => {
  const content = readFileSync(DR_CONFIG_PATH, "utf-8");
  const config = JSON.parse(content) as DRConfig;

  assert.ok(config.rtoSeconds > 0, "RTO must be positive");
  assert.ok(config.rpoSeconds > 0, "RPO must be positive");
  assert.ok(
    config.rtoSeconds >= config.rpoSeconds,
    "RTO should be >= RPO (RTO is typically larger)"
  );
});

test("DR config has valid backup retention policy", () => {
  const content = readFileSync(DR_CONFIG_PATH, "utf-8");
  const config = JSON.parse(content) as DRConfig;

  assert.ok(config.backupRetentionDays > 0, "backupRetentionDays must be positive");
  assert.ok(config.retentionPolicy.dailyBackups > 0);
  assert.ok(config.retentionPolicy.weeklyBackups > 0);
  assert.ok(config.retentionPolicy.monthlyBackups > 0);
});

test("DR config has valid schedules", () => {
  const content = readFileSync(DR_CONFIG_PATH, "utf-8");
  const config = JSON.parse(content) as DRConfig;

  // Cron format: minute hour day month weekday (each can be * or number)
  assert.match(config.backupSchedule, /^[\d\*]+\s+[\d\*]+\s+[\d\*]+\s+[\d\*]+\s+[\d\*]+$/);
  assert.match(config.drillSchedule, /^[\d\*]+\s+[\d\*]+\s+[\d\*]+\s+[\d\*]+\s+[\d\*]+$/);
});

test("DR config has all required components", () => {
  const content = readFileSync(DR_CONFIG_PATH, "utf-8");
  const config = JSON.parse(content) as DRConfig;

  const requiredComponents = ["events", "truth", "projections"];
  for (const comp of requiredComponents) {
    assert.ok(
      config.components.includes(comp),
      `Component '${comp}' should be in config.components`
    );
  }
});

test("DR script exists and is executable", () => {
  assert.ok(existsSync(DR_SCRIPT_PATH), `DR script should exist at ${DR_SCRIPT_PATH}`);

  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");
  assert.ok(content.includes("#!/bin/bash"), "Script should have bash shebang");
  assert.ok(
    content.includes("set -euo pipefail"),
    "Script should use strict error handling"
  );
});

test("DR script supports --help option", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("--help"), "Script should support --help");
  assert.ok(
    content.includes("full") && content.includes("incremental") && content.includes("verify"),
    "Script should document all modes"
  );
});

test("DR script implements backup and restore phases", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("backup_event_store"), "Should have event store backup");
  assert.ok(content.includes("backup_truth_store"), "Should have truth store backup");
  assert.ok(content.includes("backup_projections"), "Should have projections backup");
  assert.ok(content.includes("perform_restore"), "Should have restore function");
  assert.ok(content.includes("verify_data_integrity"), "Should have verification");
});

test("DR script implements RTO/RPO verification", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("verify_rto_rpo"), "Should have RTO/RPO verification");
  assert.ok(content.includes("rto_rpo_report"), "Should generate RTO/RPO report");
  assert.ok(content.includes("rtoCompliance"), "Should track RTO compliance");
  assert.ok(content.includes("rpoCompliance"), "Should track RPO compliance");
});

test("DR script generates drill report", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("drill_report.json"), "Should generate drill report");
  assert.ok(content.includes("generate_drill_report"), "Should have report generation function");
  assert.ok(content.includes("SUMMARY.txt"), "Should generate human-readable summary");
});

test("DR script loads config from environment variables", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("DR_RTO_SECONDS"), "Should use DR_RTO_SECONDS env var");
  assert.ok(content.includes("DR_RPO_SECONDS"), "Should use DR_RPO_SECONDS env var");
  assert.ok(content.includes("DR_CONFIG_DIR"), "Should use DR_CONFIG_DIR env var");
  assert.ok(content.includes("DR_OUTPUT_DIR"), "Should use DR_OUTPUT_DIR env var");
});

test("DR script supports component filtering", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("--component"), "Should support --component flag");
  assert.ok(content.includes("events"), "Should support events component");
  assert.ok(content.includes("truth"), "Should support truth component");
  assert.ok(content.includes("projections"), "Should support projections component");
});

test("DR script generates timestamped output directories", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("date"), "Should use date for timestamps");
  assert.ok(content.includes("TIMESTAMP"), "Should generate TIMESTAMP variable");
});

test("DR script has colored output for logging", () => {
  const content = readFileSync(DR_SCRIPT_PATH, "utf-8");

  assert.ok(content.includes("log_info"), "Should have info logging");
  assert.ok(content.includes("log_success"), "Should have success logging");
  assert.ok(content.includes("log_warn"), "Should have warning logging");
  assert.ok(content.includes("log_error"), "Should have error logging");
  assert.ok(content.includes("RED="), "Should have RED color");
  assert.ok(content.includes("GREEN="), "Should have GREEN color");
});

test("DR workflow exists for CI", () => {
  const workflowPath = ".github/workflows/dr-validation.yml";
  assert.ok(existsSync(workflowPath), "DR validation workflow should exist");

  const content = readFileSync(workflowPath, "utf-8");

  // Check workflow structure (YAML format, not JSON)
  assert.ok(content.includes("name: DR Validation"), "Should have correct workflow name");
  assert.ok(content.includes("schedule:"), "Should have schedule trigger");
  assert.ok(content.includes("workflow_dispatch:"), "Should support manual trigger");
  assert.ok(content.includes("dr-drill:"), "Should have dr-drill job");
});

test("DR workflow runs monthly on 15th", () => {
  const content = readFileSync(".github/workflows/dr-validation.yml", "utf-8");

  assert.ok(content.includes("0 3 15 * *"), "Should schedule for 3 AM on 15th");
});

test("DR workflow uploads DR reports as artifacts", () => {
  const content = readFileSync(".github/workflows/dr-validation.yml", "utf-8");

  assert.ok(content.includes("actions/upload-artifact"), "Should upload artifacts");
  assert.ok(content.includes("dr-reports"), "Should upload DR reports");
  assert.ok(content.includes("retention-days: 90"), "Should have 90 day retention");
});

test("DR workflow checks RTO/RPO compliance", () => {
  const content = readFileSync(".github/workflows/dr-validation.yml", "utf-8");

  assert.ok(content.includes("rtoCompliance"), "Should check RTO compliance");
  assert.ok(content.includes("rpoCompliance"), "Should check RPO compliance");
});
