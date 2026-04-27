import assert from "node:assert/strict";
import test from "node:test";

import { defineMigration, normalizeSql, checksumSql } from "../../../../../../src/platform/state-evidence/truth/postgres/pg-schema-support.js";

test("normalizeSql removes leading/trailing whitespace and normalizes internal whitespace", () => {
  const result = normalizeSql("  SELECT   *   FROM   users  ");
  assert.strictEqual(result, "SELECT * FROM users\n");
});

test("normalizeSql handles newlines and tabs", () => {
  const result = normalizeSql("\n\tSELECT\n\t*\n\tFROM\n\tusers\n");
  assert.strictEqual(result, "SELECT * FROM users\n");
});

test("normalizeSql adds trailing newline", () => {
  const result = normalizeSql("SELECT * FROM users");
  assert.ok(result.endsWith("\n"));
});

test("normalizeSql handles empty string", () => {
  const result = normalizeSql("");
  assert.strictEqual(result, "\n");
});

test("normalizeSql handles string with only whitespace", () => {
  const result = normalizeSql("   \n\t  ");
  assert.strictEqual(result, "\n");
});

test("checksumSql returns a sha256 hash", () => {
  const result = checksumSql("SELECT * FROM users");
  // SHA256 hash is 64 characters hex
  assert.strictEqual(result.length, 64);
  assert.ok(/^[a-f0-9]+$/.test(result));
});

test("checksumSql is deterministic", () => {
  const sql = "SELECT * FROM users WHERE id = 1";
  const result1 = checksumSql(sql);
  const result2 = checksumSql(sql);
  assert.strictEqual(result1, result2);
});

test("checksumSql produces different hashes for different SQL", () => {
  const result1 = checksumSql("SELECT * FROM users");
  const result2 = checksumSql("SELECT * FROM orders");
  assert.notStrictEqual(result1, result2);
});

test("checksumSql normalizes SQL before hashing", () => {
  const sql1 = "SELECT   *   FROM   users";
  const sql2 = "SELECT * FROM users";
  const result1 = checksumSql(sql1);
  const result2 = checksumSql(sql2);
  assert.strictEqual(result1, result2);
});

test("defineMigration creates a valid migration object", () => {
  const migration = defineMigration(1, "create_users_table", "CREATE TABLE users (id TEXT);");

  assert.strictEqual(migration.version, 1);
  assert.strictEqual(migration.name, "create_users_table");
  assert.strictEqual(migration.ddl, "CREATE TABLE users (id TEXT);\n");
  assert.strictEqual(migration.checksum.length, 64);
  assert.ok(migration.downDdl.includes("manual rollback required"));
});

test("defineMigration uses custom downDdl when provided", () => {
  const migration = defineMigration(2, "add_email_column", "ALTER TABLE users ADD email TEXT;", {
    downDdl: "ALTER TABLE users DROP COLUMN email;",
  });

  assert.strictEqual(migration.downDdl, "ALTER TABLE users DROP COLUMN email;\n");
});

test("defineMigration normalizes both ddl and downDdl", () => {
  const migration = defineMigration(3, "test", "  SELECT   *   FROM   users  ", {
    downDdl: "  DROP   TABLE   users  ",
  });

  assert.strictEqual(migration.ddl, "SELECT * FROM users\n");
  assert.strictEqual(migration.downDdl, "DROP TABLE users\n");
});

test("defineMigration computes checksum for ddl", () => {
  const ddl = "CREATE TABLE users (id TEXT);";
  const migration = defineMigration(1, "test", ddl);

  assert.strictEqual(migration.checksum, checksumSql(ddl));
});
