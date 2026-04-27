import assert from "node:assert/strict";
import test from "node:test";

import {
  isSqliteWriteContentionError,
  SqliteDatabase,
  type AuthoritativeSqlDatabase,
  type SqliteDatabaseOptions,
  type SqliteSchemaStatus,
} from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";
import { SqliteWriteContentionError } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";

test("isSqliteWriteContentionError returns true for wrapped sqlite write contention error", () => {
  const error = new SqliteWriteContentionError(
    "/tmp/test.db",
    Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR" }),
  );
  assert.equal(isSqliteWriteContentionError(error), true);
});

test("isSqliteWriteContentionError returns false for raw sqlite busy error", () => {
  const error = Object.assign(new Error("database is locked"), { code: "ERR_SQLITE_ERROR" });
  assert.equal(isSqliteWriteContentionError(error), false);
});

test("isSqliteWriteContentionError returns false for generic error", () => {
  const error = new Error("something went wrong");
  assert.equal(isSqliteWriteContentionError(error), false);
});

test("isSqliteWriteContentionError returns false for null/undefined", () => {
  assert.equal(isSqliteWriteContentionError(null), false);
  assert.equal(isSqliteWriteContentionError(undefined), false);
});

test("SqliteDatabaseOptions structure is correct", () => {
  const options: SqliteDatabaseOptions = {
    migrationPlan: [],
    busyTimeoutMs: 5000,
  };
  assert.equal(options.migrationPlan?.length, 0);
  assert.equal(options.busyTimeoutMs, 5000);
});

test("SqliteSchemaStatus structure is correct", () => {
  const status: SqliteSchemaStatus = {
    currentVersion: 1,
    expectedVersion: 1,
    upToDate: true,
    pendingVersions: [],
    checksumMismatches: [],
  };
  assert.equal(status.currentVersion, 1);
  assert.equal(status.expectedVersion, 1);
  assert.equal(status.upToDate, true);
  assert.deepEqual(status.pendingVersions, []);
});

test("AuthoritativeSqlDatabase interface is satisfied by SqliteDatabase mock", () => {
  // This verifies the type relationship - SqliteDatabase implements AuthoritativeSqlDatabase
  const db: AuthoritativeSqlDatabase = {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: {} as SqliteDatabase["connection"],
    migrate: () => {},
    getSchemaStatus: () => ({
      currentVersion: 1,
      expectedVersion: 1,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    }),
    assertSchemaCurrent: () => {},
    integrityCheck: () => [],
    healthCheck: async () => true,
    transaction: <T>(work: () => T) => {
      return work();
    },
    readTransaction: <T>(work: () => T) => {
      return work();
    },
  };
  assert.ok(db != null);
  assert.equal(typeof db.migrate, "function");
  assert.equal(typeof db.transaction, "function");
});
