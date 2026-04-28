import { describe, it } from "node:test";
import assert from "node:assert";
import { RUNTIME_PHYSICAL_SCHEMA_SQL } from "../../../../../src/platform/state-evidence/truth/runtime-physical-schema.js";

describe("runtime-physical-schema", () => {
  describe("RUNTIME_PHYSICAL_SCHEMA_SQL", () => {
    it("should export a non-empty SQL string", () => {
      assert.ok(RUNTIME_PHYSICAL_SCHEMA_SQL, "SQL schema should be defined");
      assert.ok(RUNTIME_PHYSICAL_SCHEMA_SQL.length > 0, "SQL schema should not be empty");
    });

    it("should contain task_drafts table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS task_drafts"),
        "Should contain task_drafts table definition"
      );
    });

    it("should contain confirmed_task_specs table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS confirmed_task_specs"),
        "Should contain confirmed_task_specs table definition"
      );
    });

    it("should contain harness_runs table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS harness_runs"),
        "Should contain harness_runs table definition"
      );
    });

    it("should contain runtime_event_log table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS runtime_event_log"),
        "Should contain runtime_event_log table definition"
      );
    });

    it("should contain runtime_outbox table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS runtime_outbox"),
        "Should contain runtime_outbox table definition"
      );
    });

    it("should contain budget_ledgers table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS budget_ledgers"),
        "Should contain budget_ledgers table definition"
      );
    });

    it("should contain node_runs table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS node_runs"),
        "Should contain node_runs table definition"
      );
    });

    it("should contain runtime_audit_refs table", () => {
      assert.ok(
        RUNTIME_PHYSICAL_SCHEMA_SQL.includes("CREATE TABLE IF NOT EXISTS runtime_audit_refs"),
        "Should contain runtime_audit_refs table definition"
      );
    });

    it("should have proper SQL structure with semicolons", () => {
      const semicolonCount = (RUNTIME_PHYSICAL_SCHEMA_SQL.match(/;/g) || []).length;
      assert.ok(semicolonCount > 10, "SQL schema should contain multiple statements");
    });
  });
});