/**
 * Lifecycle Integration Test: Database Initialization
 *
 * Verifies database initialization behavior:
 * - Schema creation on fresh database
 * - Initial migration execution
 * - Schema status after initialization
 * - WAL mode configuration
 *
 * Part of lifecycle tests in tests/integration/platform/shared/lifecycle/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("lifecycle: Database initializes schema_migrations table on first migrate", () => {
  const workspace = createTempWorkspace("lifecycle-init-");

  try {
    const dbPath = join(workspace, "init-test.db");
    const db = new SqliteDatabase(dbPath);

    // Before migrate - schema_migrations table should not exist
    const tablesBefore = db.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .all();

    assert.strictEqual(tablesBefore.length, 0, "schema_migrations table should not exist before migrate");

    // After migrate - schema_migrations table should exist
    db.migrate();

    const tablesAfter = db.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
      .all();

    assert.ok(tablesAfter.length > 0, "schema_migrations table should be created after migrate");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database applies all migrations on first migrate() call", () => {
  const workspace = createTempWorkspace("lifecycle-migrate-");

  try {
    const dbPath = join(workspace, "migrate-test.db");
    const db = new SqliteDatabase(dbPath);

    // Get expected version before migration
    const statusBefore = db.getSchemaStatus();
    assert.strictEqual(statusBefore.currentVersion, 0, "Should start at version 0");
    assert.ok(statusBefore.pendingVersions.length > 0, "Should have pending migrations");

    // Run migrations
    db.migrate();

    // Verify all migrations applied
    const statusAfter = db.getSchemaStatus();
    assert.strictEqual(statusAfter.upToDate, true, "Schema should be up to date after migrate()");
    assert.strictEqual(statusAfter.pendingVersions.length, 0, "Should have no pending migrations");
    assert.ok(statusAfter.currentVersion > 0, "Should have applied migrations");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database creates all required tables on initialization", () => {
  const workspace = createTempWorkspace("lifecycle-tables-");

  try {
    const dbPath = join(workspace, "tables-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Core tables that should exist after full migration
    const requiredTables = [
      "tasks",
      "sessions",
      "events",
      "schema_migrations",
      "worker_snapshots",
      "executions",
      "execution_tickets",
    ];

    for (const table of requiredTables) {
      const result = db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .all(table);

      assert.ok(result.length > 0, `Table ${table} should exist after migration`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database enables WAL journal mode on initialization", () => {
  const workspace = createTempWorkspace("lifecycle-wal-");

  try {
    const dbPath = join(workspace, "wal-mode-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Check WAL mode is enabled
    const walMode = db.connection
      .prepare("PRAGMA journal_mode")
      .get() as { journal_mode: string };

    assert.strictEqual(walMode.journal_mode.toLowerCase(), "wal", "WAL mode should be enabled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database enables foreign keys on initialization", () => {
  const workspace = createTempWorkspace("lifecycle-fk-");

  try {
    const dbPath = join(workspace, "fk-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Check foreign keys are enabled
    const foreignKeys = db.connection
      .prepare("PRAGMA foreign_keys")
      .get() as { foreign_keys: number };

    assert.strictEqual(foreignKeys.foreign_keys, 1, "Foreign keys should be enabled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database integrity check passes on initialized database", () => {
  const workspace = createTempWorkspace("lifecycle-integrity-");

  try {
    const dbPath = join(workspace, "integrity-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const integrityResults = db.integrityCheck();

    assert.ok(integrityResults.length === 1, "Should have one integrity result");
    assert.strictEqual(integrityResults[0], "ok", "Integrity check should pass");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database health check returns true when writable", async () => {
  const workspace = createTempWorkspace("lifecycle-health-");

  try {
    const dbPath = join(workspace, "health-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const health = await db.healthCheck();

    assert.strictEqual(health, true, "Database should report healthy when writable");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Fresh database starts with zero applied migrations", () => {
  const workspace = createTempWorkspace("lifecycle-fresh-");

  try {
    const dbPath = join(workspace, "fresh-test.db");
    const db = new SqliteDatabase(dbPath);

    const appliedMigrations = db.listAppliedMigrations();

    assert.strictEqual(appliedMigrations.length, 0, "Fresh database should have no applied migrations");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: assertSchemaCurrent passes after successful migration", () => {
  const workspace = createTempWorkspace("lifecycle-assert-");

  try {
    const dbPath = join(workspace, "assert-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Should not throw
    db.assertSchemaCurrent();

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Database can be created in non-existent directory", () => {
  const workspace = createTempWorkspace("lifecycle-nested-");

  try {
    const nestedPath = join(workspace, "level1", "level2");
    const dbPath = join(nestedPath, "nested-test.db");

    // Directory doesn't exist yet
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Should be able to query
    const status = db.getSchemaStatus();
    assert.ok(status !== undefined, "Should get valid schema status");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
