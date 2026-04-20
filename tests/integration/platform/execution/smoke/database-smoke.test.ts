/**
 * Smoke Test: Database Migration
 *
 * Verifies SQLite migration runs correctly on fresh databases.
 * Part of the smoke test suite in tests/integration/smoke/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("smoke: fresh database runs all migrations successfully", () => {
  const workspace = createTempWorkspace("smoke-migration-");

  try {
    const dbPath = join(workspace, "fresh.db");
    const db = new SqliteDatabase(dbPath);

    // This should not throw
    db.migrate();

    // Verify key tables exist
    const tables = db.connection
      .prepare(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name",
      )
      .all() as Array<{ name: string }>;

    const tableNames = tables.map((t) => t.name);

    // Verify essential tables exist (based on actual schema)
    const essentialTables = [
      "tasks",
      "sessions",
      "executions",
      "events",
      "approvals",
      "artifacts",
      "memories",
    ];

    for (const essential of essentialTables) {
      assert.ok(
        tableNames.includes(essential),
        `Essential table "${essential}" should exist after migration`,
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: database schema migrations are recorded", () => {
  const workspace = createTempWorkspace("smoke-schema-version-");

  try {
    const dbPath = join(workspace, "version.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Check schema_migrations table exists and has entries
    const migrations = db.connection
      .prepare("SELECT * FROM schema_migrations ORDER BY applied_at DESC")
      .all() as Array<{ version: number; name: string; applied_at: string }>;

    assert.ok(migrations.length > 0, "Schema migrations should be recorded");
    assert.ok(migrations[0]!.version > 0, "Schema version should be positive");
    assert.ok(migrations[0]!.name, "Migration should have a name");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("smoke: database WAL mode is enabled", () => {
  const workspace = createTempWorkspace("smoke-wal-");

  try {
    const dbPath = join(workspace, "wal.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const walMode = db.connection
      .prepare("PRAGMA journal_mode")
      .get() as { journal_mode: string };

    assert.strictEqual(
      walMode.journal_mode.toLowerCase(),
      "wal",
      "Database should be in WAL mode",
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
