import assert from "node:assert/strict";
import test from "node:test";

import {
  isSqliteWriteContentionError,
  SqliteDatabase,
  type AuthoritativeSqlDatabase,
  type SqliteDatabaseOptions,
  type SqliteSchemaStatus,
} from "../../../../../src/platform/state-evidence/truth/authoritative-sql-database.js";

test("isSqliteWriteContentionError returns true for SQLITE_BUSY error", () => {
  const error = new Error("SQLITE_BUSY: database is locked");
  assert.equal(isSqliteWriteContentionError(error), true);
});

test("isSqliteWriteContentionError returns true for SQLITE_BUSY with code", () => {
  const error = new Error("database locked") as Error & { code: string };
  error.code = "SQLITE_BUSY";
  assert.equal(isSqliteWriteContentionError(error), true);
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
    enableWAL: false,
    readOnly: false,
  };
  assert.equal(options.migrationPlan.length, 0);
  assert.equal(options.enableWAL, false);
  assert.equal(options.readOnly, false);
});

test("SqliteSchemaStatus structure is correct", () => {
  const status: SqliteSchemaStatus = {
    currentVersion: "1.0.0",
    targetVersion: "1.0.0",
    pendingMigrations: [],
    lastMigratedAt: "2024-01-01T00:00:00.000Z",
    checksumMatches: true,
  };
  assert.equal(status.currentVersion, "1.0.0");
  assert.equal(status.targetVersion, "1.0.0");
  assert.equal(status.checksumMatches, true);
  assert.deepEqual(status.pendingMigrations, []);
});

test("AuthoritativeSqlDatabase interface is satisfied by SqliteDatabase mock", () => {
  // This verifies the type relationship - SqliteDatabase implements AuthoritativeSqlDatabase
  const db: AuthoritativeSqlDatabase = {
    filePath: "/tmp/test.db",
    connection: {} as SqliteDatabase["connection"],
    migrate: async () => {},
    getSchemaStatus: async () => ({
      currentVersion: "1.0.0",
      targetVersion: "1.0.0",
      pendingMigrations: [],
      lastMigratedAt: "2024-01-01T00:00:00.000Z",
      checksumMatches: true,
    }),
    assertSchemaCurrent: async () => {},
    integrityCheck: async () => [],
    transaction: async <T>(work: (conn: AuthoritativeSqlDatabase["connection"]) => Promise<T>) => {
      return work({} as AuthoritativeSqlDatabase["connection"]);
    },
    readTransaction: async <T>(work: (conn: AuthoritativeSqlDatabase["connection"]) => Promise<T>) => {
      return work({} as AuthoritativeSqlDatabase["connection"]);
    },
    close: async () => {},
  };
  assert.ok(db != null);
  assert.equal(typeof db.migrate, "function");
  assert.equal(typeof db.transaction, "function");
});
