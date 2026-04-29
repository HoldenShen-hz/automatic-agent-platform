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
const TEST_DB_PATH = join(TEST_DB_DIR, "truth-integration.db");

function cleanupTestDb() {
  try {
    if (existsSync(TEST_DB_PATH)) {
      unlinkSync(TEST_DB_PATH);
    }
  } catch {
    // ignore cleanup errors
  }
}

test("integration: SqliteDatabase full lifecycle", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
  db.migrate();

  assert.equal(db.backendType, "sqlite");
  assert.ok(existsSync(TEST_DB_PATH));

  const status = db.getSchemaStatus();
  assert.equal(status.upToDate, true);
  assert.equal(status.pendingVersions.length, 0);

  db.assertSchemaCurrent();

  db.connection.close();
  cleanupTestDb();
});

test("integration: SqliteDatabase transaction commits changes", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
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
  cleanupTestDb();
});

test("integration: SqliteDatabase transaction rollback on error", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
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
  cleanupTestDb();
});

test("integration: SqliteDatabase readTransaction works", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
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
  cleanupTestDb();
});

test("integration: SqliteDatabase health check", async () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
  db.migrate();

  const health = await db.healthCheck();
  assert.equal(health, true);

  db.connection.close();
  cleanupTestDb();
});

test("integration: SqliteDatabase integrity check", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
  db.migrate();

  const issues = db.integrityCheck();
  assert.ok(Array.isArray(issues));
  assert.equal(issues.length, 0, "Fresh database should have no integrity issues");

  db.connection.close();
  cleanupTestDb();
});

test("integration: multiple connections share same database", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db1 = new SqliteDatabase(TEST_DB_PATH);
  db1.migrate();
  const db2 = new SqliteDatabase(TEST_DB_PATH);

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
  cleanupTestDb();
});

test("integration: SqliteDatabase filePath is exposed", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
  assert.equal(db.filePath, TEST_DB_PATH);
  db.connection.close();
  cleanupTestDb();
});

test("integration: SqliteDatabase backend type is sqlite", () => {
  cleanupTestDb();
  mkdirSync(TEST_DB_DIR, { recursive: true });

  const db = new SqliteDatabase(TEST_DB_PATH);
  assert.equal(db.backendType, "sqlite");
  db.connection.close();
  cleanupTestDb();
});