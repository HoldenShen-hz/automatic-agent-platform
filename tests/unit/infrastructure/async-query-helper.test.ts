/**
 * Infrastructure: Async Query Helpers Tests
 *
 * Tests for async query helper functions.
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

import {
  asyncQueryAll,
  asyncQueryAllOrEmpty,
  asyncQueryOne,
  asyncExecute,
  asyncExecuteBatch,
  asyncWithinTransaction,
  type AsyncSqlConnection,
  type AsyncSqlDatabase,
  type AsyncQueryResult,
} from "../../../src/platform/five-plane-state-evidence/truth/async-query-helper.js";

// ── Mock AsyncSqlConnection Factory ───────────────────────────────────────────

function createMockConnection(
  overrides: Partial<AsyncSqlConnection> = {},
): AsyncSqlConnection {
  return {
    query: mock.fn(
      async <T>(
        _sql: string,
        ..._params: unknown[]
      ): Promise<AsyncQueryResult<T>> => {
        return { rows: [], rowCount: 0 };
      },
    ),
    queryOne: mock.fn(
      async <T>(
        _sql: string,
        ..._params: unknown[]
      ): Promise<T | undefined> => {
        return undefined;
      },
    ),
    execute: mock.fn(
      async (_sql: string, ..._params: unknown[]): Promise<number> => {
        return 0;
      },
    ),
    ...overrides,
  };
}

// ── asyncQueryAll Tests ───────────────────────────────────────────────────────

describe("asyncQueryAll", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("extracts rows from query result", async () => {
    const expectedRows = [
      { id: 1, name: "Alice" },
      { id: 2, name: "Bob" },
    ];
    conn.query = mock.fn(async () => ({ rows: expectedRows, rowCount: 2 }));

    const result = await asyncQueryAll<{ id: number; name: string }>(
      conn,
      "SELECT * FROM users",
    );

    assert.deepEqual(result, expectedRows);
    assert.equal(conn.query.mock.calls.length, 1);
  });

  it("returns empty array when query returns no rows", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    const result = await asyncQueryAll<{ id: number }>(
      conn,
      "SELECT * FROM empty",
    );

    assert.deepEqual(result, []);
  });

  it("passes sql and params to connection query", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    await asyncQueryAll(
      conn,
      "SELECT * FROM users WHERE age > ? AND status = ?",
      18,
      "active",
    );

    const call = conn.query.mock.calls[0];
    assert.equal(
      call.arguments[0],
      "SELECT * FROM users WHERE age > ? AND status = ?",
    );
    assert.deepEqual(call.arguments.slice(1), [18, "active"]);
  });

  it("handles typed results", async () => {
    interface UserRecord {
      readonly id: number;
      readonly email: string;
      readonly active: boolean;
    }
    const users: UserRecord[] = [
      { id: 1, email: "alice@example.com", active: true },
      { id: 2, email: "bob@example.com", active: false },
    ];
    conn.query = mock.fn(async () => ({ rows: users, rowCount: 2 }));

    const result = await asyncQueryAll<UserRecord>(conn, "SELECT * FROM users");

    assert.equal(result[0]?.email, "alice@example.com");
    assert.equal(result[1]?.active, false);
  });
});

// ── asyncQueryAllOrEmpty Tests ─────────────────────────────────────────────────

describe("asyncQueryAllOrEmpty", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns rows from query result", async () => {
    const rows = [{ id: 1 }, { id: 2 }];
    conn.query = mock.fn(async () => ({ rows, rowCount: 2 }));

    const result = await asyncQueryAllOrEmpty<{ id: number }>(
      conn,
      "SELECT * FROM test",
    );

    assert.equal(result.length, 2);
  });

  it("returns empty array when no results", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    const result = await asyncQueryAllOrEmpty<{ id: number }>(
      conn,
      "SELECT * FROM empty",
    );

    assert.deepEqual(result, []);
  });

  it("behaves same as asyncQueryAll for non-empty results", async () => {
    const rows = [{ id: 1, name: "test" }];
    conn.query = mock.fn(async () => ({ rows, rowCount: 1 }));

    const allResult = await asyncQueryAll<{ id: number; name: string }>(
      conn,
      "SELECT * FROM test",
    );
    const allOrEmptyResult = await asyncQueryAllOrEmpty<{
      id: number;
      name: string;
    }>(conn, "SELECT * FROM test");

    assert.deepEqual(allResult, allOrEmptyResult);
  });
});

// ── asyncQueryOne Tests ───────────────────────────────────────────────────────

describe("asyncQueryOne", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns single row from queryOne", async () => {
    const row = { id: 42, name: "Special" };
    conn.queryOne = mock.fn(async () => row);

    const result = await asyncQueryOne<{ id: number; name: string }>(
      conn,
      "SELECT * FROM users WHERE id = 42",
    );

    assert.deepEqual(result, row);
  });

  it("returns undefined when queryOne returns undefined", async () => {
    conn.queryOne = mock.fn(async () => undefined);

    const result = await asyncQueryOne<{ id: number }>(
      conn,
      "SELECT * FROM users WHERE id = 999",
    );

    assert.equal(result, undefined);
  });

  it("passes sql and params to connection queryOne", async () => {
    conn.queryOne = mock.fn(async () => undefined);

    await asyncQueryOne(
      conn,
      "SELECT * FROM users WHERE email = ?",
      "test@example.com",
    );

    const call = conn.queryOne.mock.calls[0];
    assert.equal(call.arguments[0], "SELECT * FROM users WHERE email = ?");
    assert.deepEqual(call.arguments.slice(1), ["test@example.com"]);
  });
});

// ── asyncExecute Tests ────────────────────────────────────────────────────────

describe("asyncExecute", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns affected row count from execute", async () => {
    conn.execute = mock.fn(async () => 5);

    const result = await asyncExecute(
      conn,
      "DELETE FROM users WHERE status = 'inactive'",
    );

    assert.equal(result, 5);
  });

  it("returns 0 when no rows affected", async () => {
    conn.execute = mock.fn(async () => 0);

    const result = await asyncExecute(conn, "DELETE FROM users WHERE id = 999");

    assert.equal(result, 0);
  });

  it("passes sql and params to connection execute", async () => {
    conn.execute = mock.fn(async () => 1);

    await asyncExecute(
      conn,
      "INSERT INTO users (name, email) VALUES (?, ?)",
      "Alice",
      "alice@example.com",
    );

    const call = conn.execute.mock.calls[0];
    assert.equal(
      call.arguments[0],
      "INSERT INTO users (name, email) VALUES (?, ?)",
    );
    assert.deepEqual(call.arguments.slice(1), ["Alice", "alice@example.com"]);
  });
});

// ── asyncExecuteBatch Tests ───────────────────────────────────────────────────

describe("asyncExecuteBatch", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection({
      execute: mock.fn(async () => 1),
    });
  });

  afterEach(() => {
    mock.reset();
  });

  it("executes statements sequentially and returns change counts", async () => {
    conn.execute = mock.fn(async () => 1);

    const statements = [
      { sql: "INSERT INTO logs (msg) VALUES ('first')" },
      { sql: "INSERT INTO logs (msg) VALUES ('second')" },
      { sql: "INSERT INTO logs (msg) VALUES ('third')" },
    ];

    const results = await asyncExecuteBatch(conn, statements);

    assert.equal(results.length, 3);
    assert.deepEqual(results, [1, 1, 1]);
  });

  it("returns varying change counts per statement", async () => {
    let nextCount = 0;
    conn.execute = mock.fn(async () => [10, 5][nextCount++] ?? 0);

    const results = await asyncExecuteBatch(conn, [
      { sql: "DELETE FROM table_a" }, // returns 10
      { sql: "DELETE FROM table_b" }, // returns 5
    ]);

    assert.deepEqual(results, [10, 5]);
  });

  it("handles empty statement list", async () => {
    const results = await asyncExecuteBatch(conn, []);

    assert.deepEqual(results, []);
    assert.equal(conn.execute.mock.calls.length, 0);
  });

  it("passes params for statements that have them", async () => {
    conn.execute = mock.fn(async () => 1);

    await asyncExecuteBatch(conn, [
      {
        sql: "INSERT INTO users (name, email) VALUES (?, ?)",
        params: ["Alice", "alice@example.com"],
      },
      {
        sql: "INSERT INTO users (name, email) VALUES (?, ?)",
        params: ["Bob", "bob@example.com"],
      },
    ]);

    const call1 = conn.execute.mock.calls[0];
    const call2 = conn.execute.mock.calls[1];
    assert.deepEqual(call1.arguments.slice(1), ["Alice", "alice@example.com"]);
    assert.deepEqual(call2.arguments.slice(1), ["Bob", "bob@example.com"]);
  });

  it("handles statements with no params", async () => {
    conn.execute = mock.fn(async () => 0);

    await asyncExecuteBatch(conn, [{ sql: "DELETE FROM audit_log" }]);

    const call = conn.execute.mock.calls[0];
    assert.deepEqual(call.arguments.slice(1), []);
  });
});

// ── asyncWithinTransaction Tests ───────────────────────────────────────────────

describe("asyncWithinTransaction", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("delegates to db.transaction with the connection", async () => {
    const transactionMock = mock.fn(
      async <T>(
        _work: (conn: AsyncSqlConnection) => Promise<T>,
      ): Promise<T> => {
        return await _work(conn);
      },
    );

    const db = {
      filePath: "/test.db",
      asyncConnection: conn,
      transaction: transactionMock,
    } as unknown as AsyncSqlDatabase;

    const workMock = mock.fn(
      async (_c: AsyncSqlConnection) => "transaction result",
    );

    const result = await asyncWithinTransaction(db, workMock);

    assert.equal(result, "transaction result");
    assert.equal(transactionMock.mock.calls.length, 1);
    assert.equal(workMock.mock.calls.length, 1);
  });

  it("transaction receives the db's asyncConnection", async () => {
    let receivedConn: AsyncSqlConnection | null = null;
    const db = {
      filePath: "/test.db",
      asyncConnection: conn,
      transaction: async <T>(
        work: (c: AsyncSqlConnection) => Promise<T>,
      ): Promise<T> => {
        receivedConn = conn;
        return await work(conn);
      },
    } as unknown as AsyncSqlDatabase;

    await asyncWithinTransaction(db, async (c) => {
      return c;
    });

    assert.ok(receivedConn != null);
  });
});
