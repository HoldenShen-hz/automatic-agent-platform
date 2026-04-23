import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const db = new SqliteDatabase(join(workspace, "sqlite-async-adapter.db"));
    db.connection.exec(`
    CREATE TABLE sample_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL
    );
  `);
    const adapter = new SqliteAsyncAdapter(db);
    return { workspace, db, adapter };
}
function toPlainObject(value) {
    if (value == null) {
        return value;
    }
    return { ...value };
}
test("SqliteAsyncAdapter exposes sqlite metadata and async query helpers", async () => {
    const harness = createHarness("aa-sqlite-async-adapter-");
    try {
        const { adapter, db } = harness;
        assert.equal(adapter.filePath, db.filePath);
        assert.ok(adapter.asyncConnection);
        assert.equal(typeof adapter.asyncConnection.query, "function");
        assert.equal(typeof adapter.asyncConnection.queryOne, "function");
        assert.equal(typeof adapter.asyncConnection.execute, "function");
    }
    finally {
        await harness.adapter.close();
        cleanupPath(harness.workspace);
    }
});
test("SqliteAsyncAdapter asyncConnection executes query, queryOne, and execute", async () => {
    const harness = createHarness("aa-sqlite-async-adapter-");
    try {
        const { adapter } = harness;
        const inserted = await adapter.asyncConnection.execute("INSERT INTO sample_items (id, name) VALUES (?, ?)", "item-1", "first");
        const rows = await adapter.asyncConnection.query("SELECT id, name FROM sample_items ORDER BY id ASC");
        const row = await adapter.asyncConnection.queryOne("SELECT id, name FROM sample_items WHERE id = ?", "item-1");
        assert.equal(inserted, 1);
        assert.equal(rows.rowCount, 1);
        assert.deepEqual(rows.rows.map((entry) => ({ ...entry })), [{ id: "item-1", name: "first" }]);
        assert.deepEqual(toPlainObject(row), { id: "item-1", name: "first" });
    }
    finally {
        await harness.adapter.close();
        cleanupPath(harness.workspace);
    }
});
test("SqliteAsyncAdapter transaction commits on success and rolls back on error", async () => {
    const harness = createHarness("aa-sqlite-async-adapter-");
    try {
        const { adapter } = harness;
        const committed = await adapter.transaction(async (conn) => {
            await conn.execute("INSERT INTO sample_items (id, name) VALUES (?, ?)", "item-1", "committed");
            return conn.queryOne("SELECT name FROM sample_items WHERE id = ?", "item-1");
        });
        assert.deepEqual(toPlainObject(committed), { name: "committed" });
        await assert.rejects(() => adapter.transaction(async (conn) => {
            await conn.execute("INSERT INTO sample_items (id, name) VALUES (?, ?)", "item-2", "rolled-back");
            throw new Error("boom");
        }), /boom/);
        const afterRollback = await adapter.asyncConnection.queryOne("SELECT id FROM sample_items WHERE id = ?", "item-2");
        assert.equal(afterRollback, undefined);
    }
    finally {
        await harness.adapter.close();
        cleanupPath(harness.workspace);
    }
});
test("SqliteAsyncAdapter readTransaction returns values and database helpers delegate", async () => {
    const harness = createHarness("aa-sqlite-async-adapter-");
    try {
        const { adapter, db } = harness;
        db.migrate();
        db.connection.exec("INSERT INTO sample_items (id, name) VALUES ('item-1', 'reader')");
        const value = await adapter.readTransaction(async (conn) => conn.queryOne("SELECT name FROM sample_items WHERE id = ?", "item-1"));
        assert.deepEqual(toPlainObject(value), { name: "reader" });
        const status = await adapter.getSchemaStatus();
        assert.equal(status.upToDate, true);
        await adapter.assertSchemaCurrent();
        assert.deepEqual(await adapter.integrityCheck(), ["ok"]);
    }
    finally {
        await harness.adapter.close();
        cleanupPath(harness.workspace);
    }
});
//# sourceMappingURL=sqlite-async-adapter.test.js.map