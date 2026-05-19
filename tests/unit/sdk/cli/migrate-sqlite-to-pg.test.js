import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { parseMigrateSqliteToPgArgs, planSqliteToPgMigration, } from "../../../../src/sdk/cli/migrate-sqlite-to-pg.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
test("parseMigrateSqliteToPgArgs parses required flags", () => {
    const options = parseMigrateSqliteToPgArgs([
        "--sqlite",
        "/tmp/source.db",
        "--pg-dsn",
        "postgresql://user:pass@localhost/db",
        "--dry-run",
    ]);
    assert.equal(options.sqlitePath, "/tmp/source.db");
    assert.equal(options.pgDsn, "postgresql://user:pass@localhost/db");
    assert.equal(options.dryRun, true);
});
test("parseMigrateSqliteToPgArgs rejects missing arguments", () => {
    assert.throws(() => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/source.db"]), /usage:/);
});
test("planSqliteToPgMigration returns row counts for migrated tables", () => {
    const workspace = createTempWorkspace("aa-migrate-plan-");
    try {
        const db = new SqliteDatabase(join(workspace, "source.db"));
        db.migrate();
        db.connection.prepare(`
      INSERT INTO tasks (
        id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
        error_code, created_at, updated_at, completed_at
      ) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
    `).run("task_plan_1", "task_plan_1", "Migration task", "queued", "user", "normal", "{}", "{}", "{}", null, 0, "2026-04-15T00:00:00.000Z", "2026-04-15T00:00:00.000Z");
        const plan = planSqliteToPgMigration(db);
        assert.equal(plan.find((entry) => entry.table === "tasks")?.rowCount, 1);
        assert.equal(plan.find((entry) => entry.table === "workflows")?.rowCount, 0);
        db.close();
    }
    finally {
        cleanupPath(workspace);
    }
});
//# sourceMappingURL=migrate-sqlite-to-pg.test.js.map