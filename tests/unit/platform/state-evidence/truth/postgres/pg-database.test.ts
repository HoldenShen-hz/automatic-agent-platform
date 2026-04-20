import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { isPgWriteError, PgDatabase, PgWriteError, type PgDatabaseOptions } from "../../../../../../src/platform/state-evidence/truth/postgres/pg-database.js";
import { openPostgresAuthoritativeStorageBackend, planAuthoritativeStorageBackend } from "../../../../../../src/platform/state-evidence/truth/storage-backend-factory.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../../helpers/fs.js";

test("PgDatabase is exported correctly", () => {
  assert.ok(PgDatabase !== undefined);
  assert.ok(typeof PgDatabase === "function");
});

test("PgDatabase.open throws when postgres driver is not installed", async () => {
  const options: PgDatabaseOptions = {
    dsn: "postgresql://localhost/test",
    poolMin: 0,
    poolMax: 10,
  };

  // Since postgres is not installed, open should throw with a clear error
  await assert.rejects(
    async () => PgDatabase.open(options),
    /postgres\.connection_failed|postgres\.driver_not_available|cannot find module/,
  );
});

test("PgDatabase throws helpful error before connection", async () => {
  const db = PgDatabase.createDisconnectedForTest({ dsn: "postgresql://localhost/test" });

  // Calling async methods before connect should throw helpful errors
  await assert.rejects(
    async () => { await db.migrate(); },
    /postgres\.not_connected/,
  );

  await assert.rejects(
    async () => { await db.getSchemaStatus(); },
    /postgres\.not_connected/,
  );

  await assert.rejects(
    async () => { await db.integrityCheck(); },
    /postgres\.not_connected/,
  );

  // Sync method - connection.exec throws synchronously
  assert.throws(
    () => { db.connection.exec("SELECT 1"); },
    /postgres\.not_connected/,
  );
});

test("PgDatabase isConnected returns false before open", () => {
  const db = PgDatabase.createDisconnectedForTest({ dsn: "postgresql://localhost/test" });
  assert.equal(db.isConnected(), false);
});

test("PgWriteError has correct structure", () => {
  const error = new PgWriteError("query", "postgresql://localhost/test", new Error("connection refused"));
  assert.equal(error.code, "postgres.write_error");
  assert.equal(error.operation, "query");
  assert.equal(error.dsn, "postgresql://localhost/test");
  assert.ok(error.cause instanceof Error);
});

test("isPgWriteError correctly identifies PgWriteError", () => {
  const err = new PgWriteError("execute", "postgresql://localhost/test");
  assert.equal(isPgWriteError(err), true);
  assert.equal(isPgWriteError(new Error()), false);
  assert.equal(isPgWriteError(null), false);
  assert.equal(isPgWriteError(undefined), false);
});

test("PgDatabase connection.prepare returns stub before connect", () => {
  const db = PgDatabase.createDisconnectedForTest({ dsn: "postgresql://localhost/test" });

  const stmt = db.connection.prepare("SELECT 1");
  assert.throws(
    () => { stmt.all(); },
    /postgres\.not_connected/,
  );
  assert.throws(
    () => { stmt.run(); },
    /postgres\.not_connected/,
  );
});

test("factory planAuthoritativeStorageBackend returns valid plan for postgres", () => {
  const workspace = createTempWorkspace("pg-factory-test-");
  const dbPath = join(workspace, "runtime.db");
  const shadowPath = join(workspace, "shadow", "runtime.db");

  try {
    createFile(shadowPath, "");

    const env = {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_db?sslmode=require",
      AA_STORAGE_POSTGRES_POOL_MIN: "2",
      AA_STORAGE_POSTGRES_POOL_MAX: "10",
      AA_STORAGE_POSTGRES_DUAL_RUN: "true",
      AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
    };

    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "staging",
      env,
    });

    assert.equal(plan.runtimeProfile.driver, "postgres");
    assert.deepEqual(plan.runtimeProfile.issues, []);
    assert.equal(plan.executable, true);
    assert.equal(plan.openErrorCode, null);
    assert.equal(plan.runtimeProfile.postgres?.host, "postgres.internal");
    assert.equal(plan.runtimeProfile.postgres?.database, "agent_db");
    assert.equal(plan.runtimeProfile.postgres?.sslmode, "require");
    assert.equal(plan.runtimeProfile.postgres?.poolMin, 2);
    assert.equal(plan.runtimeProfile.postgres?.poolMax, 10);
    assert.equal(plan.runtimeProfile.postgres?.dualRun, true);
  } finally {
    cleanupPath(workspace);
  }
});

test("factory openPostgresAuthoritativeStorageBackend throws when postgres driver not installed", async () => {
  const workspace = createTempWorkspace("pg-async-test-");
  const dbPath = join(workspace, "runtime.db");
  const shadowPath = join(workspace, "shadow", "runtime.db");

  try {
    createFile(shadowPath, "");

    const env = {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_db?sslmode=require",
      AA_STORAGE_POSTGRES_DUAL_RUN: "true",
      AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
    };

    // openPostgresAuthoritativeStorageBackend should throw since postgres driver is not installed
    await assert.rejects(
      async () => openPostgresAuthoritativeStorageBackend({
        dbPath,
        environment: "staging",
        env,
      }),
      /storage\.postgres_driver_not_installed|postgres\.connection_failed/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("factory planAuthoritativeStorageBackend returns non-executable plan for invalid postgres config", () => {
  const workspace = createTempWorkspace("pg-invalid-test-");
  const dbPath = join(workspace, "runtime.db");

  try {
    // Missing DSN, localhost in production, no SSL
    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "prod",
      env: {
        AA_STORAGE_DRIVER: "postgres",
      },
    });

    assert.equal(plan.runtimeProfile.driver, "postgres");
    assert.notEqual(plan.runtimeProfile.issues.length, 0);
    assert.equal(plan.executable, false);
    assert.ok(plan.openErrorCode?.startsWith("storage.backend_config_invalid:"));
  } finally {
    cleanupPath(workspace);
  }
});
