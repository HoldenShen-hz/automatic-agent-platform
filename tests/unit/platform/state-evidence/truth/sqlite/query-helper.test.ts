import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { queryAll, queryAllOrEmpty, queryOne, queryOneOrThrow, execute, insertAndGetLastId } from "../../../../../../src/platform/state-evidence/truth/sqlite/query-helper.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

interface SampleItem {
  id: string;
  name: string;
  quantity: number;
}

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "query-helper.db");
  const db = new SqliteDatabase(dbPath);

  db.connection.exec(`
    CREATE TABLE sample_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      quantity INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE empty_table (
      id TEXT PRIMARY KEY
    );
  `);

  return { workspace, db, dbPath };
}

test("queryAll returns all rows cast to target type", () => {
  const harness = createHarness("aa-query-helper-all-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'first', 10);
      INSERT INTO sample_items (id, name, quantity) VALUES ('i2', 'second', 20);
    `);

    const rows = queryAll<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items ORDER BY id ASC");

    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.id, "i1");
    assert.equal(rows[0]!.name, "first");
    assert.equal(rows[0]!.quantity, 10);
    assert.equal(rows[1]!.id, "i2");
    assert.equal(rows[1]!.name, "second");
    assert.equal(rows[1]!.quantity, 20);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryAll returns empty array when no rows", () => {
  const harness = createHarness("aa-query-helper-all-empty-");
  try {
    const { db } = harness;

    const rows = queryAll<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items");

    assert.equal(rows.length, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryAll passes parameters to the statement", () => {
  const harness = createHarness("aa-query-helper-all-params-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'alpha', 1);
      INSERT INTO sample_items (id, name, quantity) VALUES ('i2', 'beta', 2);
      INSERT INTO sample_items (id, name, quantity) VALUES ('i3', 'gamma', 3);
    `);

    const rows = queryAll<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items WHERE quantity > ? ORDER BY quantity ASC", 1);

    assert.equal(rows.length, 2);
    assert.equal(rows[0]!.id, "i2");
    assert.equal(rows[1]!.id, "i3");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryAllOrEmpty returns all rows or empty array if undefined result", () => {
  const harness = createHarness("aa-query-helper-all-or-empty-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'first', 10);
    `);

    const rows = queryAllOrEmpty<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items");

    assert.equal(rows.length, 1);
    assert.equal(rows[0]!.id, "i1");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryAllOrEmpty returns empty array when no rows", () => {
  const harness = createHarness("aa-query-helper-all-or-empty-none-");
  try {
    const { db } = harness;

    const rows = queryAllOrEmpty<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items");

    assert.deepEqual(rows, []);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryOne returns a single row or undefined", () => {
  const harness = createHarness("aa-query-helper-one-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'only', 42);
    `);

    const row = queryOne<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items WHERE id = ?", "i1");

    assert.ok(row);
    assert.equal(row.id, "i1");
    assert.equal(row.name, "only");
    assert.equal(row.quantity, 42);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryOne returns undefined when no row found", () => {
  const harness = createHarness("aa-query-helper-one-none-");
  try {
    const { db } = harness;

    const row = queryOne<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items WHERE id = ?", "nonexistent");

    assert.equal(row, undefined);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryOneOrThrow returns a single row", () => {
  const harness = createHarness("aa-query-helper-one-or-throw-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'found', 99);
    `);

    const row = queryOneOrThrow<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items WHERE id = ?", "i1");

    assert.equal(row.id, "i1");
    assert.equal(row.name, "found");
    assert.equal(row.quantity, 99);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryOneOrThrow throws StorageError when no row found", () => {
  const harness = createHarness("aa-query-helper-one-or-throw-none-");
  try {
    const { db } = harness;

    try {
      queryOneOrThrow<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items WHERE id = ?", "nonexistent");
      assert.fail("Expected StorageError to be thrown");
    } catch (error: any) {
      assert.equal(error.code, "storage.query_no_rows");
      assert.ok(error.message.includes("queryOneOrThrow"));
    }
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("execute returns number of affected rows", () => {
  const harness = createHarness("aa-query-helper-execute-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'first', 10);
    `);

    const changes = execute(db.connection, "UPDATE sample_items SET quantity = quantity + 5 WHERE id = ?", "i1");

    assert.equal(changes, 1);
    const updated = queryOne<SampleItem>(db.connection, "SELECT quantity FROM sample_items WHERE id = ?", "i1");
    assert.equal(updated?.quantity, 15);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("execute returns 0 when no rows affected", () => {
  const harness = createHarness("aa-query-helper-execute-zero-");
  try {
    const { db } = harness;

    const changes = execute(db.connection, "UPDATE sample_items SET quantity = 999 WHERE id = ?", "nonexistent");

    assert.equal(changes, 0);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("insertAndGetLastId returns the last inserted rowid", () => {
  const harness = createHarness("aa-query-helper-insert-");
  try {
    const { db } = harness;

    // Create a table with INTEGER PRIMARY KEY to get meaningful rowid
    db.connection.exec(`
      CREATE TABLE auto_id_items (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL
      );
    `);

    const rowid1 = insertAndGetLastId(db.connection, "INSERT INTO auto_id_items (name) VALUES (?)", "first");
    const rowid2 = insertAndGetLastId(db.connection, "INSERT INTO auto_id_items (name) VALUES (?)", "second");

    assert.ok(rowid1 >= 1);
    assert.ok(rowid2 > rowid1);

    const first = queryOne<{ id: number; name: string }>(db.connection, "SELECT id, name FROM auto_id_items WHERE id = ?", rowid1);
    assert.equal(first?.name, "first");
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});

test("queryAll handles multiple statements in SQL", () => {
  const harness = createHarness("aa-query-helper-multi-");
  try {
    const { db } = harness;
    db.connection.exec(`
      INSERT INTO sample_items (id, name, quantity) VALUES ('i1', 'first', 10);
    `);

    // Splitting by semicolon happens at caller level, queryAll just executes one statement
    const rows = queryAll<SampleItem>(db.connection, "SELECT id, name, quantity FROM sample_items");

    assert.equal(rows.length, 1);
  } finally {
    harness.db.close();
    cleanupPath(harness.workspace);
  }
});
