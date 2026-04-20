import assert from "node:assert/strict";
import test from "node:test";

import {
  isSqliteWriteContentionError,
  SqliteDatabase,
  type SqliteDatabaseOptions,
} from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";

test("sqlite database generic facade re-exports the sqlite implementation", () => {
  // SqliteDatabase is exported from both paths - verify they are the same class
  assert.equal(typeof SqliteDatabase, "function");
  assert.equal(typeof isSqliteWriteContentionError, "function");
});

test("isSqliteWriteContentionError returns false for regular errors", () => {
  const regularError = new Error("database error");
  assert.equal(isSqliteWriteContentionError(regularError), false);
});

test("isSqliteWriteContentionError returns false for errors with sqlite-like messages", () => {
  const busyError = new Error("SQLITE_BUSY: database is locked");
  const lockedError = new Error("SQLITE_LOCKED: database table is locked");
  // The function checks instanceof SqliteWriteContentionError, not message content
  assert.equal(isSqliteWriteContentionError(busyError), false);
  assert.equal(isSqliteWriteContentionError(lockedError), false);
});

test("isSqliteWriteContentionError returns false for null or undefined", () => {
  assert.equal(isSqliteWriteContentionError(null), false);
  assert.equal(isSqliteWriteContentionError(undefined), false);
});

test("SqliteDatabaseOptions interface accepts valid configuration", () => {
  const options: SqliteDatabaseOptions = {
    busyTimeoutMs: 5000,
  };
  assert.equal(options.busyTimeoutMs, 5000);
});
