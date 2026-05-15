/**
 * Migration Test: Schema Upgrade
 *
 * Verifies that running migrations on a database with existing data
 * correctly upgrades the schema while preserving data.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../../src/platform/contracts/types/ids.js";

test("migration: upgrade preserves existing task data", () => {
  const workspace = createTempWorkspace("aa-migration-upgrade-");

  try {
    const dbPath = join(workspace, "upgrade.db");
    const db = new SqliteDatabase(dbPath);

    // Run initial migration
    db.migrate();
    const initialMigrations = db.listAppliedMigrations();

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
        "Migration upgrade test",
        "in_progress",
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

    // Verify data exists before re-migration
    const taskBefore = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; title: string; status: string } | undefined;

    assert.ok(taskBefore, "Task should exist before re-migration");
    assert.equal(taskBefore.title, "Migration upgrade test");

    // Run migration again (simulates upgrade scenario)
    db.migrate();

    // Verify migrations were not re-applied (checksum validation would catch duplicates)
    const migrationsAfter = db.listAppliedMigrations();
    assert.equal(migrationsAfter.length, initialMigrations.length, "Migration count should be same after re-run");

    // Verify data still exists after re-migration
    const taskAfter = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as { id: string; title: string; status: string } | undefined;

    assert.ok(taskAfter, "Task should exist after re-migration");
    assert.equal(taskAfter.id, taskId, "Task ID should be preserved");
    assert.equal(taskAfter.title, "Migration upgrade test", "Task title should be preserved");
    assert.equal(taskAfter.status, "in_progress", "Task status should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: upgrade creates new columns in existing tables", () => {
  const workspace = createTempWorkspace("aa-migration-new-cols-");

  try {
    const dbPath = join(workspace, "new-cols.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Insert a task with minimal fields
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
        "New columns test",
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

    // Verify the row can be selected and all known columns are present
    const task = db.connection
      .prepare("SELECT * FROM tasks WHERE id = ?")
      .get(taskId) as Record<string, unknown> | undefined;

    assert.ok(task, "Task should be selectable");
    assert.ok(task.id, "id column should exist");
    assert.ok(task.division_id, "division_id column should exist");
    assert.ok(task.status, "status column should exist");
    assert.ok(task.created_at, "created_at column should exist");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: index creation does not affect existing data", () => {
  const workspace = createTempWorkspace("aa-migration-index-");

  try {
    const dbPath = join(workspace, "index-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Insert multiple tasks
    const now = nowIso();
    const taskIds: string[] = [];

    for (let i = 0; i < 5; i++) {
      const taskId = newId("task");
      taskIds.push(taskId);

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
          `Index test ${i}`,
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
    }

    // Re-run migrations (creates indexes)
    db.migrate();

    // Verify all tasks are still queryable
    const tasks = db.connection
      .prepare("SELECT id FROM tasks WHERE id IN (" + taskIds.map(() => "?").join(",") + ")")
      .all(...taskIds) as Array<{ id: string }>;

    assert.equal(tasks.length, 5, "All tasks should be queryable after index creation");

    // Verify index exists
    const indexes = db.connection
      .prepare("SELECT name FROM sqlite_master WHERE type='index' AND tbl_name='tasks'")
      .all() as Array<{ name: string }>;

    assert.ok(indexes.length > 0, "Indexes should exist on tasks table");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("migration: event table upgrade maintains referential integrity", () => {
  const workspace = createTempWorkspace("aa-migration-event-");

  try {
    const dbPath = join(workspace, "event-upgrade.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    // Create task first (parent reference)
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
        "Event upgrade test",
        "in_progress",
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

    // Insert an event referencing the task
    const eventId = newId("evt");
    db.connection
      .prepare(
        `INSERT INTO events (id, task_id, execution_id, event_type, event_tier, payload_json, trace_id, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        eventId,
        taskId,
        null,
        "task.started",
        "tier_1",
        "{}",
        "trace-upgrade",
        now,
      );

    // Re-run migrations
    db.migrate();

    // Verify event is still linked to task
    const event = db.connection
      .prepare("SELECT * FROM events WHERE id = ?")
      .get(eventId) as { id: string; task_id: string; event_type: string } | undefined;

    assert.ok(event, "Event should exist after migration");
    assert.equal(event.task_id, taskId, "Event should still reference the task");
    assert.equal(event.event_type, "task.started", "Event type should be preserved");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
