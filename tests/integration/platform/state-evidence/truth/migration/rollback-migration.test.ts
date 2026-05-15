/**
 * Migration Test: Schema Rollback Compatibility
 *
 * Verifies that after migration, the schema remains in a consistent state
 * and data can still be read correctly (simulating rollback compatibility).
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("migration: running migrate twice is idempotent", () => {
  const workspace = createTempWorkspace("aa-migration-idempotent-");

  try {
    const dbPath = join(workspace, "idempotent.db");
    const db = new SqliteDatabase(dbPath);

    // First migration
    db.migrate();
    const firstMigrations = db.listAppliedMigrations();

    // Insert test data
    const taskId = newId("task");
    const now = nowIso();

    db.connection
      .prepare(
        `INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general_ops",
        null,
        "Idempotent test",
        "queued",
        "user",
        "normal",
        "{}",
        null,
        null,
        null,
        0,
        null,
        now,
        now,
        null,
      );

    // Second migration - should be no-op
    db.migrate();
    const secondMigrations = db.listAppliedMigrations();

    // Migration count should be identical
    assert.equal(
      secondMigrations.length,
      firstMigrations.length,
      "Running migrate twice should not apply additional migrations",
    );

    // Verify data is intact
    const task = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; title: string } | undefined;

    assert.ok(task, "Task should still exist after second migration");
    assert.equal(task.title, "Idempotent test");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: data survives migration re-run after modifications", () => {
  const workspace = createTempWorkspace("aa-migration-survive-");

  try {
    const dbPath = join(workspace, "survive.db");
    const db = new SqliteDatabase(dbPath);

    // Initial migration and data insert
    db.migrate();
    const taskId = newId("task");
    const now = nowIso();

    db.connection
      .prepare(
        `INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general_ops",
        null,
        "Survivor test",
        "in_progress",
        "user",
        "high",
        '{"priority": "high"}',
        '{"priority": "high"}',
        null,
        0.05,
        0.02,
        null,
        now,
        now,
        null,
      );

    // Update the task
    db.connection
      .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?")
      .run("completed", now, taskId);

    // Re-run migration
    db.migrate();

    // Verify the updated data survives
    const task = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; status: string; priority: string } | undefined;

    assert.ok(task, "Task should exist after migration re-run");
    assert.equal(task.status, "completed", "Updated status should be preserved");
    assert.equal(task.priority, "high", "Priority should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: multiple sequential runs maintain consistency", () => {
  const workspace = createTempWorkspace("aa-migration-seq-");

  try {
    const dbPath = join(workspace, "sequential.db");
    const db = new SqliteDatabase(dbPath);

    db.migrate();

    const taskId = newId("task");
    const now = nowIso();

    // Insert data
    db.connection
      .prepare(
        `INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        taskId,
        null,
        taskId,
        "general_ops",
        null,
        "Sequential test",
        "queued",
        "user",
        "normal",
        "{}",
        null,
        null,
        null,
        0,
        null,
        now,
        now,
        null,
      );

    // Run migration 3 times sequentially
    for (let i = 0; i < 3; i++) {
      db.migrate();
    }

    // Verify data integrity
    const task = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; title: string } | undefined;

    assert.ok(task, "Task should exist after multiple migration runs");
    assert.equal(task.title, "Sequential test");

    // Verify all expected tables still exist
    const expectedTables = [
      "tasks",
      "executions",
      "sessions",
      "events",
      "approvals",
    ];

    for (const table of expectedTables) {
      const exists = db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);

      assert.ok(exists, `Table ${table} should still exist after multiple migrations`);
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: schema version tracking is consistent", () => {
  const workspace = createTempWorkspace("aa-migration-version-");

  try {
    const dbPath = join(workspace, "version.db");
    const db = new SqliteDatabase(dbPath);

    // Run migration once
    db.migrate();
    const migrations = db.listAppliedMigrations();

    assert.ok(migrations.length > 0, "Some migrations should be applied");

    // Record the versions
    const versionsAfterFirst = new Set(migrations.map((m) => m.version));

    // Run migration again
    db.migrate();
    const migrationsSecond = db.listAppliedMigrations();

    // Versions should be identical
    const versionsAfterSecond = new Set(migrationsSecond.map((m) => m.version));

    assert.deepEqual(
      versionsAfterSecond,
      versionsAfterFirst,
      "Migration versions should be identical after re-run",
    );

    // Each migration should have a name
    for (const migration of migrations) {
      assert.ok(migration.name, "Each migration should have a name");
    }

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: new database starts with complete schema", () => {
  const workspace = createTempWorkspace("aa-migration-fresh-");

  try {
    const dbPath = join(workspace, "fresh.db");
    const db = new SqliteDatabase(dbPath);

    // Run migration on fresh DB
    db.migrate();

    // All core tables should exist
    const coreTables = [
      "tasks",
      "executions",
      "sessions",
      "events",
      "approvals",
      "worker_snapshots",
      "execution_tickets",
      "execution_leases",
      "file_locks",
      "workflow_state",
      "artifacts",
      "memories",
    ];

    for (const table of coreTables) {
      const exists = db.connection
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
        .get(table);

      assert.ok(exists, `Core table ${table} should exist in fresh migration`);
    }

    // Schema migrations ledger should be populated
    const migrations = db.listAppliedMigrations();
    assert.ok(migrations.length > 0, "Fresh DB should have migrations applied");

    // WAL mode should be enabled
    const walMode = db.connection
      .prepare("PRAGMA journal_mode")
      .get() as { journal_mode: string };

    assert.equal(walMode.journal_mode.toLowerCase(), "wal", "WAL mode should be enabled");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
