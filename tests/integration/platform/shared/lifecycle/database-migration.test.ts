/**
 * Lifecycle Integration Test: Database Migrations
 *
 * Verifies database migration behavior:
 * - Migration status tracking
 * - Checksum validation
 * - Migration ordering
 * - Double migrate safety
 * - Pending migration detection
 *
 * Part of lifecycle tests in tests/integration/platform/shared/lifecycle/.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";

test("lifecycle: getSchemaStatus returns correct pending versions on fresh database", () => {
  const workspace = createTempWorkspace("lifecycle-pending-");

  try {
    const dbPath = join(workspace, "pending-test.db");
    const db = new SqliteDatabase(dbPath);

    const status = db.getSchemaStatus();

    assert.strictEqual(status.currentVersion, 0, "Fresh database should have version 0");
    assert.ok(status.pendingVersions.length > 0, "Should have pending versions");
    assert.strictEqual(status.upToDate, false, "Schema should not be up to date");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: listAppliedMigrations returns empty array on fresh database", () => {
  const workspace = createTempWorkspace("lifecycle-applied-");

  try {
    const dbPath = join(workspace, "applied-test.db");
    const db = new SqliteDatabase(dbPath);

    const applied = db.listAppliedMigrations();

    assert.strictEqual(applied.length, 0, "Should have no applied migrations initially");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: migrate() records all applied migrations", () => {
  const workspace = createTempWorkspace("lifecycle-record-");

  try {
    const dbPath = join(workspace, "record-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const applied = db.listAppliedMigrations();

    assert.ok(applied.length > 0, "Should have applied migrations");
    assert.strictEqual(applied[0]!.version, 1, "First migration should be version 1");

    // Verify all have required fields
    for (const migration of applied) {
      assert.ok(migration.version > 0, "Migration should have version");
      assert.ok(migration.name.length > 0, "Migration should have name");
      assert.ok(migration.checksum.length > 0, "Migration should have checksum");
      assert.ok(migration.appliedAt.length > 0, "Migration should have appliedAt");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: migrate() is idempotent - running twice does not duplicate migrations", () => {
  const workspace = createTempWorkspace("lifecycle-idempotent-");

  try {
    const dbPath = join(workspace, "idempotent-test.db");
    const db = new SqliteDatabase(dbPath);

    // Run migrate twice
    db.migrate();
    const appliedAfterFirst = db.listAppliedMigrations().length;

    db.migrate();
    const appliedAfterSecond = db.listAppliedMigrations().length;

    assert.strictEqual(appliedAfterFirst, appliedAfterSecond, "Running migrate twice should not duplicate migrations");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: getSchemaStatus.upToDate is true after migration", () => {
  const workspace = createTempWorkspace("lifecycle-uptodate-");

  try {
    const dbPath = join(workspace, "uptodate-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const status = db.getSchemaStatus();

    assert.strictEqual(status.upToDate, true, "Schema should be up to date after migrate()");
    assert.strictEqual(status.pendingVersions.length, 0, "Should have no pending versions");
    assert.strictEqual(status.checksumMismatches.length, 0, "Should have no checksum mismatches");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Applied migrations are ordered by version", () => {
  const workspace = createTempWorkspace("lifecycle-ordered-");

  try {
    const dbPath = join(workspace, "ordered-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const applied = db.listAppliedMigrations();

    for (let i = 1; i < applied.length; i++) {
      assert.ok(
        applied[i]!.version > applied[i - 1]!.version,
        `Migration versions should be in order: ${applied[i - 1]!.version} < ${applied[i]!.version}`,
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Reopened database has same migration state", () => {
  const workspace = createTempWorkspace("lifecycle-reopen-");

  try {
    const dbPath = join(workspace, "reopen-test.db");

    // First instance - migrate
    const db1 = new SqliteDatabase(dbPath);
    db1.migrate();
    const appliedBefore = db1.listAppliedMigrations().map((m) => m.version);
    db1.close();

    // Second instance - should see same state
    const db2 = new SqliteDatabase(dbPath);
    const appliedAfter = db2.listAppliedMigrations().map((m) => m.version);

    assert.deepStrictEqual(appliedBefore, appliedAfter, "Migration state should persist after reopen");

    db2.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: Migration records contain valid ISO timestamps", () => {
  const workspace = createTempWorkspace("lifecycle-timestamp-");

  try {
    const dbPath = join(workspace, "timestamp-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const applied = db.listAppliedMigrations();

    for (const migration of applied) {
      const date = new Date(migration.appliedAt);
      assert.ok(!isNaN(date.getTime()), `Migration ${migration.version} should have valid timestamp`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: getSchemaStatus returns currentVersion matching highest applied migration", () => {
  const workspace = createTempWorkspace("lifecycle-current-");

  try {
    const dbPath = join(workspace, "current-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const status = db.getSchemaStatus();
    const applied = db.listAppliedMigrations();

    if (applied.length > 0) {
      const maxAppliedVersion = Math.max(...applied.map((m) => m.version));
      assert.strictEqual(
        status.currentVersion,
        maxAppliedVersion,
        "currentVersion should match highest applied migration",
      );
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lifecycle: WAL checkpoint occurs and preserves data", () => {
  const workspace = createTempWorkspace("lifecycle-checkpoint-");

  try {
    const dbPath = join(workspace, "checkpoint-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Insert data
    db.transaction(() => {
      db.connection
        .prepare("INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(
          "checkpoint_task",
          null,
          "checkpoint_task",
          "general-ops",
          "Checkpoint test",
          "pending",
          "user",
          "normal",
          "{}",
          "{}",
          null,
          0,
          0,
          null,
          new Date().toISOString(),
          new Date().toISOString(),
          null,
        );
    });

    // Manual checkpoint
    const checkpointResult = db.checkpointWal();
    assert.strictEqual(checkpointResult.mode, "TRUNCATE", "Checkpoint should use TRUNCATE mode");

    // Verify data still exists
    const tasks = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .all("checkpoint_task");

    assert.ok(tasks.length > 0, "Data should persist after checkpoint");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
