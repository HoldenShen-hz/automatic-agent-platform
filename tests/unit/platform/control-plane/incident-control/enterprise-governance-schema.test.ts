import test from "node:test";
import assert from "node:assert/strict";

// We can't easily import parseCsvEnv since it's not exported separately.
// This test validates the SQL schema constant exists and has expected structure.
import { ENTERPRISE_GOVERNANCE_DDL } from "../../../../../src/platform/five-plane-control-plane/incident-control/enterprise-governance-schema.js";

test("ENTERPRISE_GOVERNANCE_DDL contains incident_handoff_records table", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE TABLE IF NOT EXISTS incident_handoff_records"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains enterprise_governance_reports table", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE TABLE IF NOT EXISTS enterprise_governance_reports"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains handoff_id primary key", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("handoff_id TEXT PRIMARY KEY"));
});

test("ENTERPRISE_GOVERNANCE_DDL contains foreign key constraint", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("FOREIGN KEY(task_id) REFERENCES tasks(id)"));
});

test("ENTERPRISE_GOVERNANCE_DDL creates indexes", () => {
  assert.ok(ENTERPRISE_GOVERNANCE_DDL.includes("CREATE INDEX IF NOT EXISTS"));
});
