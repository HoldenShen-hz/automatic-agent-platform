/**
 * Migration Test: Empty Database Initialization
 *
 * Verifies that a fresh database can be initialized with all migrations
 * and all expected tables and indexes exist.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";
test("migration: empty database initializes all tables successfully", () => {
    const workspace = createTempWorkspace("aa-migration-init-");
    try {
        const dbPath = join(workspace, "migration-init.db");
        const db = new SqliteDatabase(dbPath);
        // Run all migrations on empty database
        db.migrate();
        // Verify schema ledger table exists
        const ledgerExists = db.connection
            .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='schema_migrations'")
            .get();
        assert.ok(ledgerExists, "Schema migrations ledger table should exist");
        // Verify core tables exist
        const expectedTables = [
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
        for (const table of expectedTables) {
            const tableExists = db.connection
                .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?")
                .get(table);
            assert.ok(tableExists, `Table ${table} should exist after migration`);
        }
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("migration: database integrity check passes after initialization", () => {
    const workspace = createTempWorkspace("aa-migration-integrity-");
    try {
        const dbPath = join(workspace, "migration-integrity.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Run integrity check
        const integrityResult = db.integrityCheck();
        // SQLite integrity check returns "ok" for each checked page
        assert.ok(Array.isArray(integrityResult), "Integrity check should return array");
        const hasErrors = integrityResult.some((r) => r !== "ok");
        assert.equal(hasErrors, false, "Database integrity should be ok");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("migration: can insert and retrieve data after migration", () => {
    const workspace = createTempWorkspace("aa-migration-data-");
    try {
        const dbPath = join(workspace, "migration-data.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const now = new Date().toISOString();
        const taskId = "test-task-001";
        // Insert a task
        db.connection
            .prepare(`INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
            .run(taskId, null, taskId, "general_ops", null, "Migration test task", "queued", "user", "normal", "{}", null, null, null, 0, null, now, now, null);
        // Retrieve the task
        const task = db.connection
            .prepare("SELECT * FROM tasks WHERE id = ?")
            .get(taskId);
        assert.ok(task, "Task should be retrievable after migration");
        assert.equal(task.id, taskId);
        assert.equal(task.title, "Migration test task");
        assert.equal(task.status, "queued");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("migration: WAL mode is enabled after migration", () => {
    const workspace = createTempWorkspace("aa-migration-wal-");
    try {
        const dbPath = join(workspace, "migration-wal.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Check WAL mode
        const walMode = db.connection
            .prepare("PRAGMA journal_mode")
            .get();
        assert.equal(walMode.journal_mode.toLowerCase(), "wal", "WAL mode should be enabled");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("migration: can run multiple migrations on already migrated database", () => {
    const workspace = createTempWorkspace("aa-migration-repeat-");
    try {
        const dbPath = join(workspace, "migration-repeat.db");
        const db = new SqliteDatabase(dbPath);
        // First migration
        db.migrate();
        // Get migration count after first run
        const firstMigrations = db.listAppliedMigrations();
        // Second migration call should be idempotent
        db.migrate();
        // Get migration count after second run
        const secondMigrations = db.listAppliedMigrations();
        // Should be the same
        assert.equal(firstMigrations.length, secondMigrations.length, "Migration count should be same after re-run");
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=empty-db-init.test.js.map