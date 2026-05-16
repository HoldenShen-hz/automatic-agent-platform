import { describe, it } from "node:test";
import assert from "node:assert";
import { RUNTIME_PHYSICAL_SCHEMA_SQL } from "../../../../../src/platform/five-plane-state-evidence/truth/runtime-physical-schema.js";

const CORE_TABLES_REQUIRING_AUDIT_AND_SOFT_DELETE = [
  "task_drafts",
  "confirmed_task_specs",
  "request_envelopes",
  "harness_runs",
  "plan_graph_bundles",
  "graph_patches",
  "node_runs",
  "node_attempts",
  "node_attempt_receipts",
  "side_effect_records",
  "budget_ledgers",
  "budget_reservations",
  "budget_settlements",
  "mission_records",
  "mission_memberships",
  "mission_context_snapshots",
  "run_version_locks",
  "artifact_version_lock_sets",
  "decision_input_bundles",
  "harness_decisions",
  "human_responsibility_records"
] as const;

const IMMUTABLE_OR_SYSTEM_TABLES = [
  "mission_event_sequences",
  "runtime_event_log",
  "runtime_outbox",
  "runtime_audit_refs"
] as const;

function getTableBlock(tableName: string): string {
  const escapedName = tableName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`CREATE TABLE IF NOT EXISTS ${escapedName} \\(([\\s\\S]*?)\\n\\);`);
  const match = RUNTIME_PHYSICAL_SCHEMA_SQL.match(pattern);
  assert.ok(match, `Should contain ${tableName} table definition`);
  return match[1];
}

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

    it("should add audit and soft-delete columns to core runtime tables", () => {
      for (const tableName of CORE_TABLES_REQUIRING_AUDIT_AND_SOFT_DELETE) {
        const tableBlock = getTableBlock(tableName);
        assert.ok(tableBlock.includes("created_by"), `${tableName} should include created_by`);
        assert.ok(tableBlock.includes("updated_at"), `${tableName} should include updated_at`);
        assert.ok(tableBlock.includes("updated_by"), `${tableName} should include updated_by`);
        assert.ok(tableBlock.includes("archived_at"), `${tableName} should include archived_at`);
        assert.ok(tableBlock.includes("archived_by"), `${tableName} should include archived_by`);
        assert.ok(tableBlock.includes("is_deleted"), `${tableName} should include is_deleted`);
        assert.ok(tableBlock.includes("deleted_at"), `${tableName} should include deleted_at`);
        assert.ok(tableBlock.includes("deleted_by"), `${tableName} should include deleted_by`);
      }
    });

    it("should keep immutable or system tables exempt from soft-delete columns", () => {
      for (const tableName of IMMUTABLE_OR_SYSTEM_TABLES) {
        const tableBlock = getTableBlock(tableName);
        assert.ok(!tableBlock.includes("is_deleted"), `${tableName} should stay append-only/system-managed`);
        assert.ok(!tableBlock.includes("deleted_at"), `${tableName} should stay append-only/system-managed`);
        assert.ok(!tableBlock.includes("deleted_by"), `${tableName} should stay append-only/system-managed`);
      }
    });

    it("should have proper SQL structure with semicolons", () => {
      const semicolonCount = (RUNTIME_PHYSICAL_SCHEMA_SQL.match(/;/g) || []).length;
      assert.ok(semicolonCount > 10, "SQL schema should contain multiple statements");
    });
  });
});
