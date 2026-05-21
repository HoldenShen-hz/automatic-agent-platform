import test from "node:test";
import assert from "node:assert/strict";

import {
  ENTERPRISE_GOVERNANCE_DDL,
} from "../../../../../src/platform/shared/enterprise-governance-ddl.js";

test("ENTERPRISE_GOVERNANCE_DDL contains incident_handoff_records table", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE TABLE IF NOT EXISTS incident_handoff_records"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("handoff_id TEXT PRIMARY KEY"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("incident_id TEXT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("environment TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("status TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("shift_owner TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("primary_oncall TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("secondary_oncall TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("severity TEXT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("handoff_json TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("created_at TEXT NOT NULL"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains indexes for incident_handoff_records", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_incident_handoff_environment_created_at"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("ON incident_handoff_records(environment, created_at DESC)"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_incident_handoff_incident_created_at"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("ON incident_handoff_records(incident_id, created_at DESC)"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains enterprise_governance_reports table", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE TABLE IF NOT EXISTS enterprise_governance_reports"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("report_id TEXT PRIMARY KEY"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("task_id TEXT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("environment TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("status TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("shift_owner TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("summary_json TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("report_json TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("generated_at TEXT NOT NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("handoff_id TEXT NOT NULL"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains foreign key constraints", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("FOREIGN KEY(task_id) REFERENCES tasks(id) ON DELETE SET NULL"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("FOREIGN KEY(handoff_id) REFERENCES incident_handoff_records(handoff_id) ON DELETE RESTRICT"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains indexes for enterprise_governance_reports", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_enterprise_governance_environment_generated_at"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("ON enterprise_governance_reports(environment, generated_at DESC)"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE INDEX IF NOT EXISTS idx_enterprise_governance_status_generated_at"));
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("ON enterprise_governance_reports(status, generated_at DESC)"));
});

test("ENTERPRISE_GOVERNANCE_DDL is a non-empty string", () => {
  assert.ok(typeof ENTERPRISE_GOVERNANCE_DDL === "string");
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.length > 0);
});

test("ENTERPRISE_GOVERNANCE_DDL contains valid SQL syntax", () => {
  // Should contain CREATE TABLE statements
  const tableCount = (ENTERPRISE_GOVERNANCE_DDL.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
  assert.strictEqual(tableCount, 2, "Should have exactly 2 CREATE TABLE statements");

  // Should contain INDEX statements
  const indexCount = (ENTERPRISE_GOVERNANCE_DDL.match(/CREATE INDEX IF NOT EXISTS/g) || []).length;
  assert.strictEqual(indexCount, 4, "Should have exactly 4 CREATE INDEX statements");
});