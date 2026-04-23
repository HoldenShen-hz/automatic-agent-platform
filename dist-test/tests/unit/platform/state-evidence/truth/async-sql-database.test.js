import assert from "node:assert/strict";
import test from "node:test";
import { asyncExecute, asyncQueryAll, asyncQueryAllOrEmpty, asyncQueryOne, } from "../../../../../src/platform/state-evidence/truth/async-sql-database.js";
function createConnection() {
    const calls = [];
    const connection = {
        async query(sql, ...params) {
            calls.push({ method: "query", sql, params });
            return {
                rows: [{ id: "row-a" }],
                rowCount: 1,
                changes: 0,
            };
        },
        async queryOne(sql, ...params) {
            calls.push({ method: "queryOne", sql, params });
            return { id: "row-a" };
        },
        async execute(sql, ...params) {
            calls.push({ method: "execute", sql, params });
            return 7;
        },
    };
    return { connection, calls };
}
test("async-sql-database helper functions delegate to AsyncSqlConnection", async () => {
    const { connection, calls } = createConnection();
    const rows = await asyncQueryAll(connection, "SELECT * FROM demo WHERE kind = $1", "alpha");
    const rowsOrEmpty = await asyncQueryAllOrEmpty(connection, "SELECT * FROM demo WHERE state = $1", "ready");
    const row = await asyncQueryOne(connection, "SELECT * FROM demo WHERE id = $1", "row-a");
    const changes = await asyncExecute(connection, "DELETE FROM demo WHERE id = $1", "row-a");
    assert.deepEqual(rows, [{ id: "row-a" }]);
    assert.deepEqual(rowsOrEmpty, [{ id: "row-a" }]);
    assert.deepEqual(row, { id: "row-a" });
    assert.equal(changes, 7);
    assert.deepEqual(calls, [
        { method: "query", sql: "SELECT * FROM demo WHERE kind = $1", params: ["alpha"] },
        { method: "query", sql: "SELECT * FROM demo WHERE state = $1", params: ["ready"] },
        { method: "queryOne", sql: "SELECT * FROM demo WHERE id = $1", params: ["row-a"] },
        { method: "execute", sql: "DELETE FROM demo WHERE id = $1", params: ["row-a"] },
    ]);
});
test("asyncQueryAll returns multiple rows", async () => {
    const connection = {
        async query(sql, ...params) {
            return {
                rows: [{ id: "1" }, { id: "2" }, { id: "3" }],
                rowCount: 3,
                changes: 0,
            };
        },
        async queryOne(sql, ...params) {
            return undefined;
        },
        async execute(sql, ...params) {
            return 0;
        },
    };
    const rows = await asyncQueryAll(connection, "SELECT id FROM items");
    assert.equal(rows.length, 3);
});
test("asyncExecute returns correct change count", async () => {
    const connection = {
        async query(sql, ...params) {
            return { rows: [], rowCount: 0, changes: 0 };
        },
        async queryOne(sql, ...params) {
            return undefined;
        },
        async execute(sql, ...params) {
            return 10;
        },
    };
    const result = await asyncExecute(connection, "INSERT INTO items VALUES ($1)", "new-item");
    assert.equal(result, 10);
});
//# sourceMappingURL=async-sql-database.test.js.map