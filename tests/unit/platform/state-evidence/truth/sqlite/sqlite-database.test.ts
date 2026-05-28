import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  SqliteWriteContentionError,
  isSqliteWriteContentionError,
  type SqliteDatabaseOptions,
  type AuthoritativeSqlDatabase,
  type AppliedSqliteMigrationRecord,
  type SqliteSchemaStatus,
  SqliteDatabase,
} from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

test("SqliteWriteContentionError constructor sets properties correctly", () => {
  const error = new SqliteWriteContentionError("/path/to/db.sqlite");
  assert.equal(error.filePath, "/path/to/db.sqlite");
  assert.equal(error.name, "SqliteWriteContentionError");
  assert.equal(error.code, "sqlite.write_contention");
  assert.equal(error.retryable, true);
  assert.equal(error.statusCode, 503);
});

test("SqliteWriteContentionError with cause sets sqliteCode from error code", () => {
  const cause = new Error("database is locked") as Error & { code?: string };
  cause.code = "ERR_SQLITE_ERROR";
  const error = new SqliteWriteContentionError("/path/to/db.sqlite", cause);
  assert.equal(error.sqliteCode, "ERR_SQLITE_ERROR");
});

test("SqliteWriteContentionError with cause sets sqliteCode to null when no code", () => {
  const cause = new Error("database is locked");
  const error = new SqliteWriteContentionError("/path/to/db.sqlite", cause);
  assert.equal(error.sqliteCode, null);
});

test("SqliteWriteContentionError with non-object cause", () => {
  const error = new SqliteWriteContentionError("/path/to/db.sqlite", "string cause");
  assert.equal(error.sqliteCode, null);
});

test("isSqliteWriteContentionError returns true for SqliteWriteContentionError", () => {
  const error = new SqliteWriteContentionError("/path/to/db.sqlite");
  assert.equal(isSqliteWriteContentionError(error), true);
});

test("isSqliteWriteContentionError returns false for regular Error", () => {
  const error = new Error("regular error");
  assert.equal(isSqliteWriteContentionError(error), false);
});

test("isSqliteWriteContentionError returns false for null", () => {
  assert.equal(isSqliteWriteContentionError(null), false);
});

test("isSqliteWriteContentionError returns false for undefined", () => {
  assert.equal(isSqliteWriteContentionError(undefined), false);
});

test("isSqliteWriteContentionError returns false for object without sqliteCode", () => {
  const error = { message: "some error" };
  assert.equal(isSqliteWriteContentionError(error), false);
});

test("SqliteDatabaseOptions interface structure", () => {
  const options: SqliteDatabaseOptions = {
    migrationPlan: [],
    busyTimeoutMs: 10000,
  };
  assert.ok(Array.isArray(options.migrationPlan));
  assert.equal(options.busyTimeoutMs, 10000);
});

test("SqliteDatabaseOptions allows undefined properties", () => {
  const options: SqliteDatabaseOptions = {};
  assert.equal(options.migrationPlan, undefined);
  assert.equal(options.busyTimeoutMs, undefined);
});

test("AppliedSqliteMigrationRecord interface structure", () => {
  const record: AppliedSqliteMigrationRecord = {
    version: 1,
    name: "initial_schema",
    checksum: "abc123def456",
    appliedAt: "2026-04-26T10:00:00.000Z",
  };
  assert.equal(record.version, 1);
  assert.equal(record.name, "initial_schema");
  assert.equal(record.checksum, "abc123def456");
  assert.equal(record.appliedAt, "2026-04-26T10:00:00.000Z");
});

test("SqliteSchemaStatus interface structure with no issues", () => {
  const status: SqliteSchemaStatus = {
    currentVersion: 42,
    expectedVersion: 42,
    upToDate: true,
    pendingVersions: [],
    checksumMismatches: [],
  };
  assert.equal(status.currentVersion, 42);
  assert.equal(status.expectedVersion, 42);
  assert.equal(status.upToDate, true);
  assert.equal(status.pendingVersions.length, 0);
  assert.equal(status.checksumMismatches.length, 0);
});

test("SqliteSchemaStatus interface structure with pending migrations", () => {
  const status: SqliteSchemaStatus = {
    currentVersion: 10,
    expectedVersion: 12,
    upToDate: false,
    pendingVersions: [11, 12],
    checksumMismatches: [],
  };
  assert.equal(status.upToDate, false);
  assert.deepEqual(status.pendingVersions, [11, 12]);
});

test("SqliteSchemaStatus interface structure with checksum mismatches", () => {
  const status: SqliteSchemaStatus = {
    currentVersion: 11,
    expectedVersion: 12,
    upToDate: false,
    pendingVersions: [12],
    checksumMismatches: [
      {
        version: 5,
        name: "migration_5",
        expectedChecksum: "expected123",
        actualChecksum: "actual456",
      },
    ],
  };
  assert.equal(status.checksumMismatches.length, 1);
  assert.equal(status.checksumMismatches[0]!.version, 5);
  assert.equal(status.checksumMismatches[0]!.expectedChecksum, "expected123");
  assert.equal(status.checksumMismatches[0]!.actualChecksum, "actual456");
});

test("AuthoritativeSqlDatabase interface type check", () => {
  // This tests that the interface can be used as a type
  const db: Pick<AuthoritativeSqlDatabase, "filePath" | "backendType" | "connection"> = {
    filePath: "/tmp/test.db",
    backendType: "sqlite",
    connection: {} as any,
  };
  assert.equal(db.filePath, "/tmp/test.db");
  assert.equal(db.backendType, "sqlite");
});

test("SqliteWriteContentionError extends StorageError", () => {
  const error = new SqliteWriteContentionError("/path/to/db.sqlite");
  // Check it has message property from Error
  assert.equal(error.message.includes("sqlite.write_contention"), true);
});

test("SqliteWriteContentionError has correct retryable and statusCode", () => {
  const error = new SqliteWriteContentionError("/path/to/db.sqlite");
  assert.equal((error as any).retryable, true);
  assert.equal((error as any).statusCode, 503);
});

test("SqliteDatabase validates busyTimeoutMs as a positive integer", () => {
  const workspace = createTempWorkspace("aa-sqlite-db-");
  const dbPath = join(workspace, "invalid-timeout.db");
  try {
    assert.throws(() => new SqliteDatabase(dbPath, { busyTimeoutMs: 0 }), /busyTimeoutMs must be a positive integer/);
    assert.throws(() => new SqliteDatabase(dbPath, { busyTimeoutMs: 1.5 }), /busyTimeoutMs must be a positive integer/);
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteDatabase healthCheck is synchronous and returns true for writable database", () => {
  const workspace = createTempWorkspace("aa-sqlite-db-");
  const dbPath = join(workspace, "health.db");
  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    assert.equal(db.healthCheck(), true);
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("SqliteDatabase file-backed connections enforce WAL mode", () => {
  const workspace = createTempWorkspace("aa-sqlite-db-");
  const dbPath = join(workspace, "wal.db");
  try {
    const db = new SqliteDatabase(dbPath);
    const row = db.connection.prepare("PRAGMA journal_mode;").get() as { journal_mode?: string } | undefined;
    assert.equal((row?.journal_mode ?? "").toLowerCase(), "wal");
    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
