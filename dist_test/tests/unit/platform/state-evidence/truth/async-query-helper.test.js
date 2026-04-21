import assert from "node:assert/strict";
import test from "node:test";
import { asyncExecute, asyncQueryAll, asyncQueryAllOrEmpty, asyncQueryOne, } from "../../../../../src/platform/state-evidence/truth/async-query-helper.js";
function createConnection() {
    const calls = [];
    const connection = {
        async query(sql, ...params) {
            calls.push({ method: "query", sql, params });
            return {
                rows: [{ id: "row-1" }, { id: "row-2" }],
                rowCount: 2,
            };
        },
        async queryOne(sql, ...params) {
            calls.push({ method: "queryOne", sql, params });
            return { id: "row-1" };
        },
        async execute(sql, ...params) {
            calls.push({ method: "execute", sql, params });
            return 3;
        },
    };
    return { connection, calls };
}
test("async query helpers delegate to the async connection and preserve params", async () => {
    const { connection, calls } = createConnection();
    const rows = await asyncQueryAll(connection, "SELECT * FROM items WHERE kind = $1", "task");
    const rowsOrEmpty = await asyncQueryAllOrEmpty(connection, "SELECT * FROM items WHERE state = $1", "active");
    const row = await asyncQueryOne(connection, "SELECT * FROM items WHERE id = $1", "row-1");
    const changes = await asyncExecute(connection, "UPDATE items SET state = $1", "done");
    assert.deepEqual(rows, [{ id: "row-1" }, { id: "row-2" }]);
    assert.deepEqual(rowsOrEmpty, [{ id: "row-1" }, { id: "row-2" }]);
    assert.deepEqual(row, { id: "row-1" });
    assert.equal(changes, 3);
    assert.deepEqual(calls, [
        { method: "query", sql: "SELECT * FROM items WHERE kind = $1", params: ["task"] },
        { method: "query", sql: "SELECT * FROM items WHERE state = $1", params: ["active"] },
        { method: "queryOne", sql: "SELECT * FROM items WHERE id = $1", params: ["row-1"] },
        { method: "execute", sql: "UPDATE items SET state = $1", params: ["done"] },
    ]);
});
test("asyncQueryAllOrEmpty returns empty array when no results", async () => {
    const connection = {
        async query(sql, ...params) {
            return { rows: [], rowCount: 0 };
        },
        async queryOne(sql, ...params) {
            return undefined;
        },
        async execute(sql, ...params) {
            return 0;
        },
    };
    const rows = await asyncQueryAllOrEmpty(connection, "SELECT * FROM empty");
    assert.deepEqual(rows, []);
});
test("asyncQueryOne returns undefined for no match", async () => {
    const connection = {
        async query(sql, ...params) {
            return { rows: [], rowCount: 0 };
        },
        async queryOne(sql, ...params) {
            return undefined;
        },
        async execute(sql, ...params) {
            return 0;
        },
    };
    const row = await asyncQueryOne(connection, "SELECT * FROM items WHERE id = $1", "nonexistent");
    assert.equal(row, undefined);
});
test("asyncExecute returns affected row count", async () => {
    const connection = {
        async query(sql, ...params) {
            return { rows: [], rowCount: 0 };
        },
        async queryOne(sql, ...params) {
            return undefined;
        },
        async execute(sql, ...params) {
            return 5;
        },
    };
    const changes = await asyncExecute(connection, "DELETE FROM items");
    assert.equal(changes, 5);
});
//# sourceMappingURL=async-query-helper.test.js.map