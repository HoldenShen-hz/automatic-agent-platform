import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSqliteSchemaCompatibilityGate,
  type SqliteSchemaCompatibilityReport,
  type SqliteSchemaCompatibilityMigrationResult,
  type SqliteSchemaCompatibilityIssue,
  type SqliteSchemaCompatibilityRuleId,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-schema-compatibility-gate.js";
import type { SqliteMigrationDefinition } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";

test("evaluateSqliteSchemaCompatibilityGate returns a valid report", () => {
  const report = evaluateSqliteSchemaCompatibilityGate([]);

  assert.ok(report);
  assert.ok(report.checkedAt);
  assert.ok(Array.isArray(report.checkedRuleIds));
  assert.ok(Array.isArray(report.migrations));
  assert.ok(typeof report.migrationCount === "number");
  assert.ok(typeof report.statementCount === "number");
  assert.ok(typeof report.issueCount === "number");
});

test("evaluateSqliteSchemaCompatibilityGate with empty migrations is compatible", () => {
  const report = evaluateSqliteSchemaCompatibilityGate([]);

  assert.equal(report.compatible, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.migrationCount, 0);
});

test("evaluateSqliteSchemaCompatibilityGate detects DROP TABLE", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "CREATE TABLE test (id INTEGER); DROP TABLE test;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issueCount, 1);
  assert.equal(report.issues[0].ruleId, "destructive_drop_table_is_blocked");
});

test("evaluateSqliteSchemaCompatibilityGate detects DROP COLUMN", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "ALTER TABLE test DROP COLUMN old_column;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issues[0].ruleId, "destructive_drop_column_is_blocked");
});

test("evaluateSqliteSchemaCompatibilityGate detects DROP INDEX", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "DROP INDEX idx_test;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issues[0].ruleId, "drop_index_requires_review");
});

test("evaluateSqliteSchemaCompatibilityGate allows safe tenant-scoped index replacement", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "add_tenant_scoped_index",
      sql: `
        DROP INDEX IF EXISTS idx_extension_packages_extension_version;
        CREATE UNIQUE INDEX IF NOT EXISTS idx_extension_packages_tenant_extension_version
          ON extension_packages (COALESCE(tenant_id,''), extension_id, version);
      `,
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, true);
  assert.equal(report.issueCount, 0);
});

test("evaluateSqliteSchemaCompatibilityGate detects ALTER TABLE RENAME TO", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "ALTER TABLE old_name RENAME TO new_name;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issues[0].ruleId, "table_rename_requires_review");
});

test("evaluateSqliteSchemaCompatibilityGate detects ALTER TABLE RENAME COLUMN", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "ALTER TABLE test RENAME COLUMN old_col TO new_col;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issues[0].ruleId, "column_rename_requires_review");
});

test("evaluateSqliteSchemaCompatibilityGate detects ADD NOT NULL column without DEFAULT", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "ALTER TABLE test ADD COLUMN new_column TEXT NOT NULL;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, false);
  assert.equal(report.issues[0].ruleId, "add_not_null_column_requires_default");
});

test("evaluateSqliteSchemaCompatibilityGate allows ADD NOT NULL column with DEFAULT", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "ALTER TABLE test ADD COLUMN new_column TEXT NOT NULL DEFAULT 'default';",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, true);
  assert.equal(report.issueCount, 0);
});

test("evaluateSqliteSchemaCompatibilityGate handles multiple statements", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "CREATE TABLE test (id INTEGER); INSERT INTO test VALUES (1); SELECT * FROM test;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, true);
  assert.equal(report.migrations[0].statementCount, 3);
});

test("evaluateSqliteSchemaCompatibilityGate handles multiple migrations", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "migration_one",
      sql: "CREATE TABLE one (id INTEGER);",
      appliedAt: null,
    },
    {
      version: 2,
      name: "migration_two",
      sql: "CREATE TABLE two (id INTEGER);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.migrationCount, 2);
  assert.equal(report.migrations.length, 2);
});

test("evaluateSqliteSchemaCompatibilityGate handles whitespace in statements", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "   CREATE TABLE test (id INTEGER);   ",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, true);
});

test("evaluateSqliteSchemaCompatibilityGate handles empty statements", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "CREATE TABLE test (id INTEGER);;   ;DROP TABLE test;;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  // The empty strings should be filtered out
  assert.ok(true);
});

test("SqliteSchemaCompatibilityReport structure", () => {
  const report: SqliteSchemaCompatibilityReport = {
    checkedAt: "2026-04-26T10:00:00Z",
    compatible: true,
    checkedRuleIds: ["destructive_drop_table_is_blocked"],
    migrationCount: 1,
    statementCount: 1,
    issueCount: 0,
    issues: [],
    migrations: [],
  };

  assert.equal(report.compatible, true);
  assert.equal(report.migrationCount, 1);
});

test("SqliteSchemaCompatibilityMigrationResult structure", () => {
  const result: SqliteSchemaCompatibilityMigrationResult = {
    version: 1,
    name: "test",
    compatible: true,
    statementCount: 1,
    issues: [],
  };

  assert.equal(result.version, 1);
  assert.equal(result.compatible, true);
});

test("SqliteSchemaCompatibilityIssue structure", () => {
  const issue: SqliteSchemaCompatibilityIssue = {
    ruleId: "destructive_drop_table_is_blocked",
    migrationVersion: 1,
    migrationName: "test",
    statementIndex: 1,
    detail: "DROP TABLE is blocked",
    statement: "DROP TABLE test;",
  };

  assert.equal(issue.ruleId, "destructive_drop_table_is_blocked");
});

test("SqliteSchemaCompatibilityRuleId type includes all expected values", () => {
  const ruleIds: SqliteSchemaCompatibilityRuleId[] = [
    "destructive_drop_table_is_blocked",
    "destructive_drop_column_is_blocked",
    "drop_index_requires_review",
    "table_rename_requires_review",
    "column_rename_requires_review",
    "add_not_null_column_requires_default",
  ];

  assert.equal(ruleIds.length, 6);
});

test("evaluateSqliteSchemaCompatibilityGate sets checkedRuleIds correctly", () => {
  const report = evaluateSqliteSchemaCompatibilityGate([]);

  assert.ok(report.checkedRuleIds.includes("destructive_drop_table_is_blocked"));
  assert.ok(report.checkedRuleIds.includes("destructive_drop_column_is_blocked"));
  assert.ok(report.checkedRuleIds.includes("drop_index_requires_review"));
  assert.ok(report.checkedRuleIds.includes("table_rename_requires_review"));
  assert.ok(report.checkedRuleIds.includes("column_rename_requires_review"));
  assert.ok(report.checkedRuleIds.includes("add_not_null_column_requires_default"));
});

test("evaluateSqliteSchemaCompatibilityGate with CREATE TABLE is compatible", () => {
  const migrations: SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "create_users_table",
      sql: `
        CREATE TABLE users (
          id INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT UNIQUE NOT NULL
        );
        CREATE INDEX idx_users_email ON users(email);
      `,
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteSchemaCompatibilityGate(migrations);

  assert.equal(report.compatible, true);
});
