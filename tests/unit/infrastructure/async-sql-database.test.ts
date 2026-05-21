/**
 * Infrastructure: Async SQL Database Tests
 *
 * Tests for async SQL database interface and async query helpers.
 */

import { describe, it, beforeEach, afterEach, mock } from "node:test";
import assert from "node:assert";

// Import types and helpers under test
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
} from "../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

// ── Mock AsyncSqlConnection ────────────────────────────────────────────────────

function createMockConnection(overrides: Partial<AsyncSqlConnection> = {}): AsyncSqlConnection {
  return {
    query: mock.fn(async <T>(_sql: string, ..._params: unknown[]): Promise<AsyncQueryResult<T>> => {
      return { rows: [], rowCount: 0 };
    }),
    queryOne: mock.fn(async <T>(_sql: string, ..._params: unknown[]): Promise<T | undefined> => {
      return undefined;
    }),
    execute: mock.fn(async (_sql: string, ..._params: unknown[]): Promise<number> => {
      return 0;
    }),
    ...overrides,
  };
}

// ── AsyncSqlConnection Mock Tests ─────────────────────────────────────────────

describe("AsyncSqlConnection (mocked)", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  describe("query", () => {
    it("returns query result with rows and rowCount", async () => {
      const mockResult: AsyncQueryResult = { rows: [{ id: 1 }], rowCount: 1 };
      conn.query = mock.fn(async () => mockResult);

      const result = await conn.query("SELECT * FROM test");

      assert.equal(result.rowCount, 1);
      assert.deepEqual(result.rows, [{ id: 1 }]);
    });

    it("passes parameters to query", async () => {
      conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

      await conn.query("SELECT * FROM test WHERE id = ?", 1, "value");

      const call = conn.query.mock.calls[0];
      assert.deepEqual(call.arguments, ["SELECT * FROM test WHERE id = ?", 1, "value"]);
    });

    it("returns empty rows for no results", async () => {
      conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

      const result = await conn.query("SELECT * FROM empty");

      assert.equal(result.rowCount, 0);
      assert.deepEqual(result.rows, []);
    });
  });

  describe("queryOne", () => {
    it("returns single row when found", async () => {
      const mockRow = { id: 1, name: "test" };
      conn.queryOne = mock.fn(async () => mockRow);

      const result = await conn.queryOne("SELECT * FROM test WHERE id = 1");

      assert.deepEqual(result, mockRow);
    });

    it("returns undefined when not found", async () => {
      conn.queryOne = mock.fn(async () => undefined);

      const result = await conn.queryOne("SELECT * FROM test WHERE id = 999");

      assert.equal(result, undefined);
    });
  });

  describe("execute", () => {
    it("returns affected row count", async () => {
      conn.execute = mock.fn(async () => 5);

      const result = await conn.execute("DELETE FROM test WHERE status = ?", "old");

      assert.equal(result, 5);
    });

    it("returns 0 for no affected rows", async () => {
      conn.execute = mock.fn(async () => 0);

      const result = await conn.execute("DELETE FROM test WHERE id = ?", 999);

      assert.equal(result, 0);
    });
  });
});

// ── Async Query Helpers Tests ─────────────────────────────────────────────────

describe("asyncQueryAll", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns all rows from query result", async () => {
    const rows = [{ id: 1 }, { id: 2 }, { id: 3 }];
    conn.query = mock.fn(async () => ({ rows, rowCount: 3 }));

    const result = await asyncQueryAll<{ id: number }>(conn, "SELECT * FROM test");

    assert.equal(result.length, 3);
    assert.deepEqual(result, rows);
  });

  it("returns empty array when no rows", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    const result = await asyncQueryAll<{ id: number }>(conn, "SELECT * FROM test");

    assert.deepEqual(result, []);
  });

  it("passes parameters correctly", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    await asyncQueryAll(conn, "SELECT * FROM test WHERE a = ? AND b = ?", 1, "two");

    const call = conn.query.mock.calls[0];
    assert.deepEqual(call.arguments, ["SELECT * FROM test WHERE a = ? AND b = ?", 1, "two"]);
  });
});

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

    const result = await asyncQueryAllOrEmpty<{ id: number }>(conn, "SELECT * FROM test");

    assert.equal(result.length, 2);
  });

  it("returns empty array when no rows", async () => {
    conn.query = mock.fn(async () => ({ rows: [], rowCount: 0 }));

    const result = await asyncQueryAllOrEmpty<{ id: number }>(conn, "SELECT * FROM test");

    assert.deepEqual(result, []);
  });
});

describe("asyncQueryOne", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns single row from queryOne", async () => {
    const row = { id: 1, name: "test" };
    conn.queryOne = mock.fn(async () => row);

    const result = await asyncQueryOne<{ id: number; name: string }>(conn, "SELECT * FROM test LIMIT 1");

    assert.deepEqual(result, row);
  });

  it("returns undefined when not found", async () => {
    conn.queryOne = mock.fn(async () => undefined);

    const result = await asyncQueryOne<{ id: number }>(conn, "SELECT * FROM test WHERE id = 999");

    assert.equal(result, undefined);
  });
});

describe("asyncExecute", () => {
  let conn: AsyncSqlConnection;

  beforeEach(() => {
    conn = createMockConnection();
  });

  afterEach(() => {
    mock.reset();
  });

  it("returns number of affected rows", async () => {
    conn.execute = mock.fn(async () => 10);

    const result = await asyncExecute(conn, "UPDATE test SET status = 'done'");

    assert.equal(result, 10);
  });

  it("passes parameters to execute", async () => {
    conn.execute = mock.fn(async () => 1);

    await asyncExecute(conn, "INSERT INTO test (a, b) VALUES (?, ?)", 1, "two");

    const call = conn.execute.mock.calls[0];
    assert.deepEqual(call.arguments, ["INSERT INTO test (a, b) VALUES (?, ?)", 1, "two"]);
  });
});

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

  it("executes multiple statements sequentially", async () => {
    conn.execute = mock.fn(async () => 1);

    const statements = [
      { sql: "INSERT INTO test (id) VALUES (1)" },
      { sql: "INSERT INTO test (id) VALUES (2)" },
      { sql: "INSERT INTO test (id) VALUES (3)" },
    ];

    const results = await asyncExecuteBatch(conn, statements);

    assert.equal(results.length, 3);
    assert.equal(conn.execute.mock.calls.length, 3);
  });

  it("passes parameters for each statement", async () => {
    conn.execute = mock.fn(async () => 1);

    const statements = [
      { sql: "INSERT INTO test (a, b) VALUES (?, ?)", params: [1, "one"] },
      { sql: "INSERT INTO test (a, b) VALUES (?, ?)", params: [2, "two"] },
    ];

    await asyncExecuteBatch(conn, statements);

    const call1 = conn.execute.mock.calls[0];
    const call2 = conn.execute.mock.calls[1];
    assert.deepEqual(call1.arguments[1], 1);
    assert.deepEqual(call2.arguments[1], 2);
  });

  it("handles empty statement list", async () => {
    const results = await asyncExecuteBatch(conn, []);

    assert.deepEqual(results, []);
  });
});

describe("asyncWithinTransaction", () => {
  it("delegates to db.transaction", async () => {
    const mockConn = createMockConnection();
    const mockDb = {
      filePath: "/test.db",
      asyncConnection: mockConn,
      transaction: mock.fn(async <T>(_work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> => {
        return await _work(mockConn);
      }),
    } as unknown as AsyncSqlDatabase;

    const result = await asyncWithinTransaction(mockDb, async (conn) => {
      return "success";
    });

    assert.equal(result, "success");
    assert.equal(mockDb.transaction.mock.calls.length, 1);
  });
});

// ── AsyncQueryResult Type Tests ────────────────────────────────────────────────

describe("AsyncQueryResult", () => {
  it("can hold rows and rowCount", () => {
    const result: AsyncQueryResult<{ id: number }> = {
      rows: [{ id: 1 }, { id: 2 }],
      rowCount: 2,
    };

    assert.equal(result.rowCount, 2);
    assert.equal(result.rows.length, 2);
  });

  it("can include changes property", () => {
    const result: AsyncQueryResult = {
      rows: [],
      rowCount: 0,
      changes: 5,
    };

    assert.equal(result.changes, 5);
  });
});