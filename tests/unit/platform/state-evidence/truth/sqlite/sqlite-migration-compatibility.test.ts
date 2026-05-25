import assert from "node:assert/strict";
import test from "node:test";

import {
  evaluateSqliteMigrationCompatibility,
  type SqliteMigrationCompatibilityRuleId,
  type SqliteMigrationCompatibilityIssue,
  type SqliteMigrationCompatibilityReport,
  type SqliteMigrationDefinition,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-compatibility.js";

test("evaluateSqliteMigrationCompatibility returns valid report structure", () => {
  const report = evaluateSqliteMigrationCompatibility([]);

  assert.equal(typeof report.checkedAt, "string");
  assert.equal(typeof report.compatible, "boolean");
  assert.ok(Array.isArray(report.checkedRuleIds));
  assert.equal(typeof report.migrationCount, "number");
  assert.equal(typeof report.statementCount, "number");
  assert.equal(typeof report.issueCount, "number");
  assert.equal(typeof report.warningCount, "number");
  assert.ok(Array.isArray(report.issues));
  assert.ok(Array.isArray(report.warnings));
  assert.ok(Array.isArray(report.migrations));
});

test("evaluateSqliteMigrationCompatibility works with empty migration list", () => {
  const report = evaluateSqliteMigrationCompatibility([]);

  assert.equal(report.migrationCount, 0);
  assert.equal(report.statementCount, 0);
  assert.equal(report.issueCount, 0);
  assert.equal(report.warningCount, 0);
  assert.equal(report.compatible, true);
});

test("evaluateSqliteMigrationCompatibility warns on checksum drift", () => {
  const report = evaluateSqliteMigrationCompatibility([
    {
      version: 1,
      name: "drifted",
      sql: "SELECT 1;",
      checksum: "a".repeat(64),
      appliedChecksum: "b".repeat(64),
    } as any,
  ]);

  assert.equal(report.compatible, true);
  assert.equal(report.warningCount, 1);
  assert.equal(report.warnings[0]?.warningCode, "sqlite_checksum_drift_detected");
});

test("evaluateSqliteMigrationCompatibility detects PRAGMA statements", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test_migration",
      sql: "PRAGMA journal_mode=WAL; CREATE TABLE test (id INTEGER);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  assert.ok(report.issues.length > 0);

  const pragmaIssue = report.issues.find((i) => i.ruleId === "sqlite_runtime_pragmas_stay_outside_migrations");
  assert.ok(pragmaIssue !== undefined);
  assert.equal(pragmaIssue.migrationVersion, 1);
  assert.equal(pragmaIssue.migrationName, "test_migration");
});

test("evaluateSqliteMigrationCompatibility detects OR conflict clauses", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 2,
      name: "insert_migration",
      sql: "INSERT OR REPLACE INTO test VALUES (1, 2);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  const conflictIssue = report.issues.find((i) => i.ruleId === "sqlite_conflict_clauses_are_not_used");
  assert.ok(conflictIssue !== undefined);
});

test("evaluateSqliteMigrationCompatibility detects AUTOINCREMENT", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 3,
      name: "autoincrement_migration",
      sql: "CREATE TABLE items (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  const autoincIssue = report.issues.find((i) => i.ruleId === "sqlite_autoincrement_is_not_used");
  assert.ok(autoincIssue !== undefined);
});

test("evaluateSqliteMigrationCompatibility detects WITHOUT ROWID", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 4,
      name: "without_rowid_migration",
      sql: "CREATE TABLE t1 (a, b PRIMARY KEY) WITHOUT ROWID;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  const rowidIssue = report.issues.find((i) => i.ruleId === "sqlite_without_rowid_is_not_used");
  assert.ok(rowidIssue !== undefined);
});

test("evaluateSqliteMigrationCompatibility detects ATTACH/DETACH", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 5,
      name: "attach_migration",
      sql: "ATTACH DATABASE 'other.db' AS aux;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  const attachIssue = report.issues.find((i) => i.ruleId === "sqlite_attach_detach_is_not_used");
  assert.ok(attachIssue !== undefined);
});

test("evaluateSqliteMigrationCompatibility detects VACUUM", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 6,
      name: "vacuum_migration",
      sql: "VACUUM;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, false);
  const vacuumIssue = report.issues.find((i) => i.ruleId === "sqlite_vacuum_is_not_used");
  assert.ok(vacuumIssue !== undefined);
});

test("evaluateSqliteMigrationCompatibility allows valid SQL", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 7,
      name: "valid_migration",
      sql: "CREATE TABLE valid_table (id INTEGER PRIMARY KEY, name TEXT NOT NULL); CREATE INDEX idx ON valid_table(name);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.compatible, true);
  assert.equal(report.issueCount, 0);
  assert.equal(report.issues.length, 0);
});

test("evaluateSqliteMigrationCompatibility checks all 6 rule IDs", () => {
  const report = evaluateSqliteMigrationCompatibility([]);

  const expectedRuleIds: SqliteMigrationCompatibilityRuleId[] = [
    "sqlite_runtime_pragmas_stay_outside_migrations",
    "sqlite_conflict_clauses_are_not_used",
    "sqlite_autoincrement_is_not_used",
    "sqlite_without_rowid_is_not_used",
    "sqlite_attach_detach_is_not_used",
    "sqlite_vacuum_is_not_used",
  ];

  assert.deepEqual(report.checkedRuleIds, expectedRuleIds);
});

test("SqliteMigrationCompatibilityIssue interface structure", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "test",
      sql: "PRAGMA cache_size=1000;",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  const issue = report.issues[0];
  assert.equal(typeof issue.ruleId, "string");
  assert.equal(typeof issue.migrationVersion, "number");
  assert.equal(typeof issue.migrationName, "string");
  assert.equal(typeof issue.statementIndex, "number");
  assert.equal(typeof issue.detail, "string");
  assert.equal(typeof issue.statement, "string");
});

test("SqliteMigrationCompatibilityReport structure for multiple migrations", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    { version: 1, name: "first", sql: "SELECT 1;", appliedAt: null },
    { version: 2, name: "second", sql: "SELECT 2;", appliedAt: null },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.migrationCount, 2);
  assert.ok(Array.isArray(report.migrations));
  assert.equal(report.migrations.length, 2);
});

test("Multiple issues in single migration are all reported", () => {
  const mockMigrations: readonly SqliteMigrationDefinition[] = [
    {
      version: 1,
      name: "multiple_issues",
      sql: "PRAGMA cache_size=1000; INSERT OR REPLACE INTO t VALUES(1);",
      appliedAt: null,
    },
  ];

  const report = evaluateSqliteMigrationCompatibility(mockMigrations);

  assert.equal(report.issueCount, 2);
  assert.ok(report.issues.some((i) => i.ruleId === "sqlite_runtime_pragmas_stay_outside_migrations"));
  assert.ok(report.issues.some((i) => i.ruleId === "sqlite_conflict_clauses_are_not_used"));
});
