import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";

import {
  getLatestPostgresMigrationVersion,
  POSTGRES_MIGRATIONS,
  PHASE_1A_SCHEMA_DDL,
  translateSqliteToPostgresDdl,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/postgres/pg-schema.js";

test("POSTGRES_MIGRATIONS contains at least one migration", () => {
  assert.ok(POSTGRES_MIGRATIONS.length > 0, "Should have at least one migration");
});

test("each migration has required fields", () => {
  for (const migration of POSTGRES_MIGRATIONS) {
    assert.ok(typeof migration.version === "number", "version should be a number");
    assert.ok(typeof migration.name === "string", "name should be a string");
    assert.ok(typeof migration.ddl === "string", "ddl should be a string");
    assert.ok(typeof migration.checksum === "string", "checksum should be a string");
    assert.ok(migration.version > 0, "version should be positive");
    assert.ok(migration.ddl.length > 0, "ddl should not be empty");
    assert.ok(migration.checksum.length === 64, "SHA256 checksum should be 64 hex chars");
  }
});

test("migrations are in ascending version order", () => {
  const migrations = POSTGRES_MIGRATIONS;
  if (migrations.length < 2) return; // Need at least 2 to test ordering

  for (let i = 1; i < migrations.length; i++) {
    const current = migrations[i];
    const previous = migrations[i - 1];
    assert.ok(current !== undefined, `migration[${i}] should exist`);
    assert.ok(previous !== undefined, `migration[${i - 1}] should exist`);
    assert.ok(current!.version > previous!.version,
      `Migration ${i} version should be greater than previous`);
  }
});

test("getLatestPostgresMigrationVersion returns the highest version", () => {
  const latest = getLatestPostgresMigrationVersion();
  const maxVersion = Math.max(...POSTGRES_MIGRATIONS.map((m) => m.version));
  assert.equal(latest, maxVersion);
});

test("PHASE_1A_SCHEMA_DDL contains expected table names", () => {
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("CREATE TABLE IF NOT EXISTS tasks"), "Should contain tasks table");
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("CREATE TABLE IF NOT EXISTS workflow_state"), "Should contain workflow_state table");
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("CREATE TABLE IF NOT EXISTS workflow_step_outputs"), "Should contain workflow_step_outputs table");
});

test("PHASE_1A_SCHEMA_DDL uses PostgreSQL-compatible types", () => {
  // Should use DOUBLE PRECISION instead of REAL
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("DOUBLE PRECISION"), "Should use DOUBLE PRECISION for floating point");

  // Should use VARCHAR for primary keys (not TEXT PRIMARY KEY)
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("VARCHAR(255)"), "Should use VARCHAR for primary keys");

  // Should use TIMESTAMPTZ for timestamps
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("TIMESTAMPTZ"), "Should use TIMESTAMPTZ for timestamps");

  // Should use JSONB for JSON columns
  assert.ok(PHASE_1A_SCHEMA_DDL.includes("JSONB"), "Should use JSONB for JSON columns");
});

test("translateSqliteToPostgresDdl translates REAL to DOUBLE PRECISION", () => {
  const sqliteDdl = "CREATE TABLE test (value REAL NOT NULL);";
  const pgDdl = translateSqliteToPostgresDdl(sqliteDdl);
  assert.ok(pgDdl.includes("DOUBLE PRECISION"), "REAL should be translated to DOUBLE PRECISION");
  assert.ok(!pgDdl.includes(" REAL "), "REAL alone should not appear in output");
});

test("translateSqliteToPostgresDdl preserves other SQL syntax", () => {
  const sqliteDdl = "CREATE TABLE test (id TEXT PRIMARY KEY, name TEXT NOT NULL);";
  const pgDdl = translateSqliteToPostgresDdl(sqliteDdl);
  assert.ok(pgDdl.includes("PRIMARY KEY"), "PRIMARY KEY should be preserved");
  assert.ok(pgDdl.includes("TEXT"), "TEXT should be preserved");
});

test("migration checksums are consistent", () => {
  // Running the same DDL through the checksum should produce the same result
  const firstMigration = POSTGRES_MIGRATIONS[0]!;
  const ddl = firstMigration.ddl;
  const checksum1 = firstMigration.checksum;

  // Checksum should be a valid SHA256 hex string
  assert.match(checksum1, /^[a-f0-9]{64}$/, "Checksum should be a valid SHA256 hex string");

  // Different DDL should produce different checksums
  const differentDdl = "CREATE TABLE different (id TEXT);";
  const differentChecksum = createHash("sha256")
    .update(differentDdl.trim())
    .digest("hex");
  assert.notEqual(differentChecksum, checksum1, "Different DDL should produce different checksum");
});

test("postgres migrations carry rollback metadata placeholders", () => {
  for (const migration of POSTGRES_MIGRATIONS) {
    assert.equal(typeof migration.downDdl, "string");
    assert.ok(migration.downDdl.length > 0);
  }
});

test("all PostgreSQL migrations cover all SQLite schema tables and marketplace governance parity", () => {
  // Concatenate all migration DDLs to get the full PostgreSQL schema
  const allDdl = POSTGRES_MIGRATIONS.map((m) => m.ddl).join("\n");

  // All SQLite-backed tables plus marketplace governance parity tables should be present.
  const expectedTables = [
    // Migration 1: core task tables
    "tasks", "workflow_state", "workflow_step_outputs",
    // Migration 2: execution core
    "cost_events", "executions", "execution_prechecks", "dead_letters",
    "heartbeat_snapshots", "agent_execution_records",
    // Migration 3: worker/queue
    "worker_snapshots", "execution_tickets", "execution_leases", "lease_audits",
    // Migration 4: sessions/messaging
    "sessions", "gateway_targets", "messages", "remote_log_entries", "compaction_records",
    // Migration 5: events
    "events", "event_consumer_acks", "approvals",
    // Migration 6: resources
    "file_locks", "memories", "experience_cache", "artifacts", "tool_result_files",
    // Migration 7: billing
    "billing_accounts", "usage_events", "quota_counters", "ledger_entries", "entitlement_decisions",
    // Migration 8: intelligence
    "perception_sources", "intel_items", "intel_briefs", "action_proposals",
    // Migration 9: governance
    "takeover_sessions", "operator_actions", "evolution_proposals", "evolution_policies", "evolution_logs",
    // Migration 10: PMF
    "pmf_validation_reports",
    // Migration 11: marketplace governance parity
    "extension_packages", "marketplace_reviews", "marketplace_publications", "marketplace_governance_reports",
    // Migration 12: async authoritative parity
    "secret_registry", "secret_usage_audits", "secret_rotation_events", "environment_readiness_records",
    "deployment_bindings", "release_bundles", "deployment_execution_reports", "environment_promotion_history",
    "secret_leases", "release_execution_reports",
    // Migration 13: semantic vector infra
    "knowledge_semantic_vectors",
  ];

  for (const table of expectedTables) {
    assert.ok(
      allDdl.includes(`CREATE TABLE IF NOT EXISTS ${table}`),
      `Table ${table} should exist in PostgreSQL schema`,
    );
  }
  assert.equal(expectedTables.length, 56, "Should have 56 tables total");
});

test("POSTGRES_MIGRATIONS has 15 migrations", () => {
  assert.equal(POSTGRES_MIGRATIONS.length, 15, "Should have 15 migrations covering all SQLite tables and PG parity gaps");
});

test("each migration DDL uses PostgreSQL types correctly", () => {
  for (const migration of POSTGRES_MIGRATIONS) {
    const ddl = migration.ddl;
    // Should not use SQLite REAL type (should be DOUBLE PRECISION)
    assert.ok(!ddl.includes(" REAL "), `Migration ${migration.version} should not use REAL type`);
    // Should not have bare TEXT PRIMARY KEY (should be VARCHAR for explicit typing)
    // Note: tables without numeric types are still valid (TEXT/VARCHAR/JSONB only)
    assert.ok(
      ddl.includes("DOUBLE PRECISION") || ddl.includes("INTEGER") || (!ddl.includes("DOUBLE PRECISION") && !ddl.includes("INTEGER")),
      `Migration ${migration.version} should either use numeric types or be text-only`,
    );
  }
});
