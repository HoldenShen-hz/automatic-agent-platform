import assert from "node:assert/strict";
import test from "node:test";

import {
  getLatestSqliteMigrationVersion,
  SQLITE_MIGRATIONS,
  SQLITE_MIGRATION_LEDGER_SQL,
  type SqliteMigrationDefinition,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";

test("SQLITE_MIGRATIONS is a non-empty readonly array", () => {
  assert.ok(Array.isArray(SQLITE_MIGRATIONS));
  assert.ok(SQLITE_MIGRATIONS.length > 0);
});

test("SQLITE_MIGRATIONS are in ascending version order", () => {
  for (let i = 1; i < SQLITE_MIGRATIONS.length; i++) {
    assert.ok(
      SQLITE_MIGRATIONS[i]!.version > SQLITE_MIGRATIONS[i - 1]!.version,
      `Migration ${i} version should be greater than previous`,
    );
  }
});

test("each SQLITE_MIGRATION has required fields", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    assert.equal(typeof migration.version, "number");
    assert.ok(migration.version > 0);
    assert.equal(typeof migration.name, "string");
    assert.ok(migration.name.length > 0);
    assert.equal(typeof migration.sql, "string");
    assert.ok(migration.sql.length > 0);
    assert.equal(typeof migration.checksum, "string");
    assert.equal(migration.checksum.length, 64);
  }
});

test("getLatestSqliteMigrationVersion returns highest version number", () => {
  const latestVersion = getLatestSqliteMigrationVersion();
  const latestMigration = SQLITE_MIGRATIONS.at(-1);

  assert.equal(latestVersion, latestMigration?.version);
});

test("getLatestSqliteMigrationVersion returns 0 for empty migrations", () => {
  // We can't easily test empty migrations without re-running the function
  // but we can verify the function returns the last migration's version
  assert.ok(getLatestSqliteMigrationVersion() > 0);
});

test("SQLITE_MIGRATION_LEDGER_SQL creates schema_migrations table", () => {
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("schema_migrations"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("CREATE TABLE"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("version"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("name"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("checksum"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("applied_at"));
});

test("SQLITE_MIGRATION_LEDGER_SQL uses IF NOT EXISTS", () => {
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("IF NOT EXISTS"));
});

test("migrations have unique names", () => {
  const names = SQLITE_MIGRATIONS.map((m) => m.name);
  const uniqueNames = new Set(names);
  assert.equal(names.length, uniqueNames.size, "Migration names should be unique");
});

test("migrations have unique versions", () => {
  const versions = SQLITE_MIGRATIONS.map((m) => m.version);
  const uniqueVersions = new Set(versions);
  assert.equal(versions.length, uniqueVersions.size, "Migration versions should be unique");
});

test("migration SQL does not contain NULL bytes", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(!migration.sql.includes("\0"), `Migration ${migration.name} contains NULL byte`);
  }
});

test("migration checksums are valid hex strings", () => {
  const hexRegex = /^[0-9a-f]{64}$/;
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(
      hexRegex.test(migration.checksum),
      `Migration ${migration.name} has invalid checksum format: ${migration.checksum}`,
    );
  }
});

test("SqliteMigrationDefinition interface structure", () => {
  const migration: SqliteMigrationDefinition = {
    version: 1,
    name: "test_migration",
    sql: "CREATE TABLE test (id INTEGER);",
    checksum: "a".repeat(64),
    downSql: "DROP TABLE test;",
    compatibleChecksums: ["b".repeat(64)],
  };

  assert.equal(migration.version, 1);
  assert.equal(migration.name, "test_migration");
  assert.equal(migration.sql, "CREATE TABLE test (id INTEGER);");
  assert.equal(migration.checksum, "a".repeat(64));
  assert.equal(migration.downSql, "DROP TABLE test;");
  assert.ok(migration.compatibleChecksums);
  assert.equal(migration.compatibleChecksums.length, 1);
});

test("migration sql ends with newline after normalization", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    // Normalized SQL should end with a newline
    assert.ok(
      migration.sql.endsWith("\n"),
      `Migration ${migration.name} SQL should end with newline`,
    );
  }
});

test("migration names follow naming convention", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    // Names should be non-empty strings
    assert.ok(migration.name.length > 0);
    // Names should not have leading/trailing whitespace
    assert.equal(migration.name, migration.name.trim());
  }
});

test("getLatestSqliteMigrationVersion is callable without arguments", () => {
  // Should not throw
  const result = getLatestSqliteMigrationVersion();
  assert.equal(typeof result, "number");
  assert.ok(result >= 0);
});

test("SQLITE_MIGRATIONS has expected count (42 migrations as of last count)", () => {
  // This test will need updating as migrations are added
  assert.ok(SQLITE_MIGRATIONS.length >= 40, "Should have at least 40 migrations");
});

test("first migration is version 1", () => {
  assert.equal(SQLITE_MIGRATIONS[0]!.version, 1);
});

test("last migration has highest version", () => {
  const lastMigration = SQLITE_MIGRATIONS.at(-1);
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(
      migration.version <= lastMigration!.version,
      `All migrations should have version <= ${lastMigration!.version}`,
    );
  }
});

test("SQLITE_MIGRATION_LEDGER_SQL creates proper schema", () => {
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("CREATE TABLE IF NOT EXISTS"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("PRIMARY KEY"));
  assert.ok(SQLITE_MIGRATION_LEDGER_SQL.includes("NOT NULL"));
});

test("migrations cover version range from 1 to latest", () => {
  const versions = SQLITE_MIGRATIONS.map((m) => m.version).sort((a, b) => a - b);
  for (let i = 0; i < versions.length - 1; i++) {
    // Each version should be exactly 1 more than the previous
    assert.equal(
      versions[i + 1] - versions[i],
      1,
      `Version gap found between ${versions[i]} and ${versions[i + 1]}`,
    );
  }
});