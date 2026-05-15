import assert from "node:assert/strict";
import test from "node:test";

import {
  asyncExecute,
  asyncQueryAll,
  asyncQueryAllOrEmpty,
  asyncQueryOne,
} from "../../../../../src/platform/five-plane-state-evidence/truth/async-query-helper.js";
import type { AsyncSqlConnection } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

function createConnection() {
  const calls: Array<{ method: string; sql: string; params: unknown[] }> = [];
  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]) {
      calls.push({ method: "query", sql, params });
      return {
        rows: [{ id: "row-1" }, { id: "row-2" }] as T[],
        rowCount: 2,
      };
    },
    async queryOne<T>(sql: string, ...params: unknown[]) {
      calls.push({ method: "queryOne", sql, params });
      return { id: "row-1" } as T;
    },
    async execute(sql: string, ...params: unknown[]) {
      calls.push({ method: "execute", sql, params });
      return 3;
    },
  };
  return { connection, calls };
}

test("async query helpers delegate to the async connection and preserve params", async () => {
  const { connection, calls } = createConnection();

  const rows = await asyncQueryAll<{ id: string }>(connection, "SELECT * FROM items WHERE kind = $1", "task");
  const rowsOrEmpty = await asyncQueryAllOrEmpty<{ id: string }>(connection, "SELECT * FROM items WHERE state = $1", "active");
  const row = await asyncQueryOne<{ id: string }>(connection, "SELECT * FROM items WHERE id = $1", "row-1");
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
  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]) {
      return { rows: [] as T[], rowCount: 0 };
    },
    async queryOne<T>(sql: string, ...params: unknown[]) {
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]) {
      return 0;
    },
  };

  const rows = await asyncQueryAllOrEmpty<{ id: string }>(connection, "SELECT * FROM empty");
  assert.deepEqual(rows, []);
});

test("asyncQueryOne returns undefined for no match", async () => {
  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]) {
      return { rows: [] as T[], rowCount: 0 };
    },
    async queryOne<T>(sql: string, ...params: unknown[]) {
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]) {
      return 0;
    },
  };

  const row = await asyncQueryOne<{ id: string }>(connection, "SELECT * FROM items WHERE id = $1", "nonexistent");
  assert.equal(row, undefined);
});

test("asyncExecute returns affected row count", async () => {
  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]) {
      return { rows: [] as T[], rowCount: 0 };
    },
    async queryOne<T>(sql: string, ...params: unknown[]) {
      return undefined;
    },
    async execute(sql: string, ...params: unknown[]) {
      return 5;
    },
  };

  const changes = await asyncExecute(connection, "DELETE FROM items");
  assert.equal(changes, 5);
});
