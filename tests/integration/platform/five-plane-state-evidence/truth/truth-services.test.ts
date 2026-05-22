/**
 * Integration tests for truth services
 *
 * Tests SQLite database and truth repository.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { existsSync, unlinkSync, mkdirSync } from "node:fs";

import {
  SqliteDatabase,
  type AuthoritativeSqlDatabase,
} from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-sql-database.js";

const TEST_DB_DIR = "/tmp/five-plane-state-evidence-integration-test";

function createTestDbPath(name: string): string {
  return join(TEST_DB_DIR, `${name}-${process.pid}-${Date.now()}-${Math.random().toString(16).slice(2)}.db`);
}

function cleanupTestDb(dbPath: string) {
  try {
    if (existsSync(dbPath)) {
      unlinkSync(dbPath);
    }
  } catch {
    // ignore cleanup errors
  }
}

test("integration: SqliteDatabase full lifecycle", () => {
  const dbPath = createTestDbPath("truth-integration");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  assert.equal(db.backendType, "sqlite");
  assert.ok(existsSync(dbPath));

  const status = db.getSchemaStatus();
  assert.equal(status.upToDate, true);
  assert.equal(status.pendingVersions.length, 0);

  db.assertSchemaCurrent();

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase transaction commits changes", () => {
  const dbPath = createTestDbPath("truth-transaction-commit");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  let committed = false;

  db.transaction(() => {
    committed = true;
    db.connection.exec("CREATE TABLE test_tx (id INTEGER PRIMARY KEY, value TEXT)");
    db.connection.prepare("INSERT INTO test_tx (value) VALUES (?)").run("test_value");
  });
  assert.equal(committed, true);

  const result = db.connection.prepare("SELECT value FROM test_tx").get() as { value: string };
  assert.equal(result.value, "test_value");

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase transaction rollback on error", () => {
  const dbPath = createTestDbPath("truth-transaction-rollback");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  let rolledBack = false;

  try {
    db.transaction(() => {
      db.connection.exec("CREATE TABLE test_rb (id INTEGER PRIMARY KEY)");
      db.connection.prepare("INSERT INTO test_rb (id) VALUES (1)").run();
      throw new Error("Force rollback");
    });
  } catch {
    rolledBack = true;
  }
  assert.equal(rolledBack, true);

  // Table should not exist after rollback
  const result = db.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='test_rb'").get();
  assert.equal(result, undefined);

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase readTransaction works", () => {
  const dbPath = createTestDbPath("truth-read-transaction");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  db.transaction(() => {
    db.connection.exec("CREATE TABLE test_read (id INTEGER PRIMARY KEY)");
    db.connection.prepare("INSERT INTO test_read (id) VALUES (42)").run();
  });

  const result = db.readTransaction(() => {
    return db.connection.prepare("SELECT id FROM test_read").get() as { id: number };
  });
  assert.equal(result.id, 42);

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase health check", async () => {
  const dbPath = createTestDbPath("truth-health");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const health = await db.healthCheck();
  assert.equal(health, true);

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase integrity check", () => {
  const dbPath = createTestDbPath("truth-integrity");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  db.migrate();

  const issues = db.integrityCheck();
  assert.ok(Array.isArray(issues));
  assert.deepEqual(issues, ["ok"], "Fresh database should return SQLite integrity ok");

  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: multiple connections share same database", () => {
  const dbPath = createTestDbPath("truth-shared-connections");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db1 = new SqliteDatabase(dbPath);
  db1.migrate();
  const db2 = new SqliteDatabase(dbPath);

  db1.transaction(() => {
    db1.connection.exec("CREATE TABLE test_shared (id INTEGER PRIMARY KEY, value TEXT)");
    db1.connection.prepare("INSERT INTO test_shared (value) VALUES (?)").run("shared_value");
  });

  const result = db2.readTransaction(() => {
    return db2.connection.prepare("SELECT value FROM test_shared").get() as { value: string };
  });
  assert.equal(result.value, "shared_value");

  db1.connection.close();
  db2.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase filePath is exposed", () => {
  const dbPath = createTestDbPath("truth-filepath");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  assert.equal(db.filePath, dbPath);
  db.connection.close();
  cleanupTestDb(dbPath);
});

test("integration: SqliteDatabase backend type is sqlite", () => {
  const dbPath = createTestDbPath("truth-backend-type");
  cleanupTestDb(dbPath);
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(dbPath);
  assert.equal(db.backendType, "sqlite");
  db.connection.close();
  cleanupTestDb(dbPath);
});
