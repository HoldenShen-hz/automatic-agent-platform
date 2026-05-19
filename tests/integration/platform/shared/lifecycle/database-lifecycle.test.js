/**
 * Lifecycle Integration Test: Database Connection Pool
 *
 * Verifies database connection pool behavior on close.
 * Part of lifecycle tests in tests/integration/lifecycle/.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
test("lifecycle: Database can be closed and reopened successfully", () => {
    const workspace = createTempWorkspace("lifecycle-db-");
    try {
        const dbPath = join(workspace, "lifecycle.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Perform some operations
        db.transaction(() => {
            db.connection
                .prepare("INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run("task_close_test", null, "task_close_test", "general_ops", "Close test", "pending", "user", "normal", "{}", "{}", null, 0, 0, null, new Date().toISOString(), new Date().toISOString(), null);
        });
        // Close the database
        db.close();
        // Reopen the database and verify data persists
        const db2 = new SqliteDatabase(dbPath);
        const tasks = db2.connection
            .prepare("SELECT * FROM tasks WHERE id = ?")
            .all("task_close_test");
        assert.ok(tasks.length > 0, "Data should persist after close and reopen");
        assert.strictEqual(tasks[0].title, "Close test");
        db2.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lifecycle: Database WAL checkpoint occurs on close", () => {
    const workspace = createTempWorkspace("lifecycle-wal-");
    try {
        const dbPath = join(workspace, "wal-checkpoint.db");
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        // Insert some data
        db.transaction(() => {
            for (let i = 0; i < 10; i++) {
                db.connection
                    .prepare("INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                    .run(`task_wal_${i}`, null, `task_wal_${i}`, "general_ops", `WAL test ${i}`, "pending", "user", "normal", "{}", "{}", null, 0, 0, null, new Date().toISOString(), new Date().toISOString(), null);
            }
        });
        // Close database (should checkpoint WAL)
        db.close();
        // Reopen database and verify data persists
        const db2 = new SqliteDatabase(dbPath);
        const tasks = db2.connection
            .prepare("SELECT * FROM tasks WHERE id LIKE 'task_wal_%'")
            .all();
        assert.ok(tasks.length >= 10, "Data should persist after close and reopen");
        db2.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
test("lifecycle: Multiple databases can be opened and closed independently", () => {
    const workspace = createTempWorkspace("lifecycle-multi-");
    try {
        const dbPath1 = join(workspace, "db1.db");
        const dbPath2 = join(workspace, "db2.db");
        const db1 = new SqliteDatabase(dbPath1);
        db1.migrate();
        const db2 = new SqliteDatabase(dbPath2);
        db2.migrate();
        // Insert data into both
        db1.transaction(() => {
            db1.connection
                .prepare("INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run("db1_task", null, "db1_task", "general_ops", "DB1 Task", "pending", "user", "normal", "{}", "{}", null, 0, 0, null, new Date().toISOString(), new Date().toISOString(), null);
        });
        db2.transaction(() => {
            db2.connection
                .prepare("INSERT INTO tasks (id, parent_id, root_id, division_id, title, status, source, priority, input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd, error_code, created_at, updated_at, completed_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
                .run("db2_task", null, "db2_task", "general_ops", "DB2 Task", "pending", "user", "normal", "{}", "{}", null, 0, 0, null, new Date().toISOString(), new Date().toISOString(), null);
        });
        // Close one database
        db1.close();
        // Other database should still be operational
        const tasks = db2.connection.prepare("SELECT * FROM tasks").all();
        assert.ok(tasks.length > 0, "DB2 should still be operational after DB1 close");
        db2.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=database-lifecycle.test.js.map