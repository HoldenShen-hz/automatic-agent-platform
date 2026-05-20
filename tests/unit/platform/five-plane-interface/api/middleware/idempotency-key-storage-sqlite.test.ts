import assert from "node:assert/strict";
import test from "node:test";

import { SqliteIdempotencyStorage } from "../../../../../../src/platform/five-plane-interface/api/middleware/idempotency-key-storage.js";
import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

function createStorage(tableName = "idempotency_keys"): { db: SqliteDatabase; storage: SqliteIdempotencyStorage } {
  const db = new SqliteDatabase(":memory:");
  db.migrate();
  return { db, storage: new SqliteIdempotencyStorage(db, tableName) };
}

test("SqliteIdempotencyStorage rejects unsafe table names", () => {
  const db = new SqliteDatabase(":memory:");
  db.migrate();

  assert.throws(
    () => new SqliteIdempotencyStorage(db, "idempotency_keys; DROP TABLE tasks"),
    /safe SQL identifier/,
  );
});

test("SqliteIdempotencyStorage stores expires_at as ISO text while returning ms API value", async () => {
  const { db, storage } = createStorage();

  await storage.set("key-1", {
    method: "POST",
    statusCode: 201,
    responseBody: "{}",
    requestHash: "hash-1",
  }, 60_000);

  const row = db.connection
    .prepare("SELECT expires_at AS expiresAt, typeof(expires_at) AS expiresAtType FROM idempotency_keys WHERE key = ?")
    .get("key-1") as { expiresAt: string; expiresAtType: string };
  const entry = await storage.get("key-1");

  assert.equal(row.expiresAtType, "text");
  assert.match(row.expiresAt, /^\d{4}-\d{2}-\d{2}T/);
  assert.equal(typeof entry?.expiresAt, "number");
});

test("SqliteIdempotencyStorage cleanup uses portable select-delete limit and supports legacy integer rows", async () => {
  const { db, storage } = createStorage();
  db.connection.prepare(`
    INSERT INTO idempotency_keys (key, method, status_code, response_body, request_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("legacy-expired", "POST", 200, "{}", "hash", Date.now() - 1_000);
  db.connection.prepare(`
    INSERT INTO idempotency_keys (key, method, status_code, response_body, request_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("iso-expired", "POST", 200, "{}", "hash", "2020-01-01T00:00:00.000Z");
  db.connection.prepare(`
    INSERT INTO idempotency_keys (key, method, status_code, response_body, request_hash, expires_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("iso-active", "POST", 200, "{}", "hash", "2999-01-01T00:00:00.000Z");

  const deleted = await storage.cleanup(1);
  const remainingAfterLimit = db.connection.prepare("SELECT COUNT(*) AS count FROM idempotency_keys").get() as { count: number };
  const deletedRest = await storage.cleanup();
  const remainingKeys = db.connection.prepare("SELECT key FROM idempotency_keys ORDER BY key").all() as Array<{ key: string }>;

  assert.equal(deleted, 1);
  assert.equal(remainingAfterLimit.count, 2);
  assert.equal(deletedRest, 1);
  assert.deepEqual(remainingKeys.map((row) => row.key), ["iso-active"]);
});
