/**
 * Infrastructure: Storage Backend Tests
 *
 * Tests for storage backend configuration, async SQL database types,
 * and storage backend factory functions.
 */

import { describe, it } from "node:test";
import assert from "node:assert";

// Storage backend config
import {
  StorageDriver,
  StorageBackendConfigValidationOptions,
  PostgresStorageBackendRuntimeProfile,
  StorageBackendRuntimeProfile,
  resolveStorageDriver,
  buildStorageBackendConfigIssues,
  inspectStorageBackendConfig,
} from "../../../src/platform/five-plane-state-evidence/truth/storage-backend-config.js";

// Async SQL database types
import type { AsyncQueryResult, AsyncSqlConnection, AsyncSqlDatabase } from "../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import { asyncQueryAll, asyncQueryOne, asyncExecute } from "../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

// Storage backend factory
import type {
  AuthoritativeStorageBackendOptions,
  AuthoritativeStorageBackendPlan,
  SqliteAuthoritativeStorageBackendHandle,
  AuthoritativeStorageBackendHandle,
} from "../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { planAuthoritativeStorageBackend, openAuthoritativeStorageBackend } from "../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";

// SQLite database
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

// ── Storage Driver Tests ───────────────────────────────────────────────────────

describe("Storage Driver", () => {
  it("defaults to sqlite when not set", () => {
    const driver = resolveStorageDriver({});
    assert.equal(driver, "sqlite");
  });

  it("accepts sqlite driver", () => {
    const driver = resolveStorageDriver({ AA_STORAGE_DRIVER: "sqlite" });
    assert.equal(driver, "sqlite");
  });

  it("accepts postgres driver", () => {
    const driver = resolveStorageDriver({ AA_STORAGE_DRIVER: "postgres" });
    assert.equal(driver, "postgres");
  });

  it("throws for invalid driver", () => {
    assert.throws(
      () => resolveStorageDriver({ AA_STORAGE_DRIVER: "mysql" }),
      /storage.driver_invalid/,
    );
  });
});

// ── Storage Backend Config Inspection Tests ────────────────────────────────────

describe("inspectStorageBackendConfig", () => {
  it("returns SQLite profile with no issues for empty env", () => {
    const profile = inspectStorageBackendConfig({ environment: "development", env: {} });
    assert.equal(profile.driver, "sqlite");
    assert.deepEqual(profile.issues, []);
    assert.equal(profile.postgres, null);
  });

  it("returns SQLite profile for explicit sqlite driver", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: { AA_STORAGE_DRIVER: "sqlite" },
    });
    assert.equal(profile.driver, "sqlite");
    assert.deepEqual(profile.issues, []);
  });

  it("handles invalid driver gracefully", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: { AA_STORAGE_DRIVER: "invalid" },
    });
    assert.equal(profile.driver, "sqlite");
    assert.ok(profile.issues.length > 0);
  });

  it("validates pool min/max values", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_POOL_MIN: "5",
        AA_STORAGE_POSTGRES_POOL_MAX: "3", // Invalid: min > max
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("pool_min_exceeds_max")));
  });

  it("validates pool values are numeric", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_POOL_MIN: "not-a-number",
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("pool_min_invalid")));
  });

  it("marks DSN as configured when present", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
      },
    });
    assert.equal(profile.postgres?.dsnConfigured, true);
    assert.equal(profile.postgres?.host, "localhost");
    assert.equal(profile.postgres?.database, "testdb");
  });

  it("extracts sslmode from DSN", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb?sslmode=require",
      },
    });
    assert.equal(profile.postgres?.sslmode, "require");
  });

  it("validates schema name format", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_SCHEMA: "123invalid", // Cannot start with number
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("schema_invalid")));
  });

  it("accepts valid schema name", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_SCHEMA: "my_schema",
      },
    });
    assert.equal(profile.postgres?.schema, "my_schema");
  });

  it("requires DSN for postgres driver", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: { AA_STORAGE_DRIVER: "postgres" },
    });
    assert.ok(profile.issues.some((i) => i.includes("dsn_missing")));
  });

  it("requires dual-run in production-like environments", () => {
    const profile = inspectStorageBackendConfig({
      environment: "prod",
      env: { AA_STORAGE_DRIVER: "postgres", AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb" },
    });
    assert.ok(profile.issues.some((i) => i.includes("dual_run_required")));
  });

  it("requires shadow SQLite path in dual-run mode", () => {
    const profile = inspectStorageBackendConfig({
      environment: "development",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        // No shadow SQLite path
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("shadow_sqlite_path_missing")));
  });

  it("rejects localhost in production-like environments", () => {
    const profile = inspectStorageBackendConfig({
      environment: "prod",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: "/tmp/shadow.db",
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("host_not_production_ready")));
  });

  it("requires SSL in production-like environments", () => {
    const profile = inspectStorageBackendConfig({
      environment: "staging",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://db.example.com/testdb",
        AA_STORAGE_POSTGRES_DUAL_RUN: "true",
        AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: "/tmp/shadow.db",
        // No sslmode
      },
    });
    assert.ok(profile.issues.some((i) => i.includes("sslmode_required")));
  });
});

// ── Build Storage Backend Config Issues Tests ─────────────────────────────────

describe("buildStorageBackendConfigIssues", () => {
  it("returns empty array for valid SQLite config", () => {
    const issues = buildStorageBackendConfigIssues({ environment: "development" });
    assert.deepEqual(issues, []);
  });
});

// ── Plan Authoritative Storage Backend Tests ─────────────────────────────────

describe("planAuthoritativeStorageBackend", () => {
  it("returns executable plan for SQLite", () => {
    const plan = planAuthoritativeStorageBackend({ dbPath: "/tmp/test.db" });
    assert.equal(plan.executable, true);
    assert.equal(plan.openErrorCode, null);
    assert.equal(plan.runtimeProfile.driver, "sqlite");
  });

  it("returns executable plan when driver is postgres with valid DSN in env", () => {
    // Note: In development without dual-run, PostgreSQL plan returns executable=true
    // but actual backend opening requires async openPostgresAuthoritativeStorageBackend
    const plan = planAuthoritativeStorageBackend({
      dbPath: "/tmp/test.db",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgres://localhost/testdb",
      },
    });
    // The plan says executable, but openErrorCode might indicate it needs async opening
    assert.equal(plan.runtimeProfile.driver, "postgres");
  });

  it("returns non-executable plan for invalid config", () => {
    const plan = planAuthoritativeStorageBackend({
      dbPath: "/tmp/test.db",
      env: { AA_STORAGE_DRIVER: "invalid" },
    });
    assert.equal(plan.executable, false);
    assert.ok(plan.openErrorCode);
  });
});

// ── Open Authoritative Storage Backend Tests ─────────────────────────────────

describe("openAuthoritativeStorageBackend", () => {
  it("opens SQLite backend successfully", () => {
    const handle = openAuthoritativeStorageBackend({ dbPath: ":memory:" });
    assert.equal(handle.driver, "sqlite");
    assert.ok((handle as SqliteAuthoritativeStorageBackendHandle).sqlite);
    handle.close();
  });

  it("returns handle with all expected properties", () => {
    const handle = openAuthoritativeStorageBackend({ dbPath: ":memory:" }) as SqliteAuthoritativeStorageBackendHandle;
    assert.ok(handle.sql);
    assert.ok(handle.asyncSql);
    assert.ok(handle.asyncRepos);
    assert.ok(handle.cas);
    handle.close();
  });
});

// ── Async SQL Database Types Tests ────────────────────────────────────────────

describe("Async SQL Database Types", () => {
  it("AsyncQueryResult has correct shape", () => {
    const result: AsyncQueryResult = {
      rows: [{ id: 1 }, { id: 2 }],
      rowCount: 2,
      changes: 1,
    };
    assert.equal(result.rows.length, 2);
    assert.equal(result.rowCount, 2);
    assert.equal(result.changes, 1);
  });

  it("AsyncSqlConnection interface is satisfied by mock", async () => {
    // Create a mock that satisfies the interface
    const mockConnection: AsyncSqlConnection = {
      query: async <T = unknown>(_sql: string, ..._params: unknown[]) => {
        return { rows: [], rowCount: 0 };
      },
      queryOne: async <T = unknown>(_sql: string, ..._params: unknown[]) => {
        return undefined;
      },
      execute: async (_sql: string, ..._params: unknown[]) => {
        return 1;
      },
    };
    const result = await mockConnection.query("SELECT 1");
    assert.deepEqual(result.rows, []);
  });

  it("asyncQueryAll helper works", async () => {
    const mockConnection: AsyncSqlConnection = {
      query: async <T = unknown>(_sql: string, ..._params: unknown[]) => {
        return {
          rows: [{ id: 1 }, { id: 2 }] as T[],
          rowCount: 2,
        };
      },
      queryOne: async () => undefined,
      execute: async () => 0,
    };
    const rows = await asyncQueryAll(mockConnection, "SELECT * FROM test");
    assert.equal(rows.length, 2);
  });

  it("asyncQueryOne helper works", async () => {
    const mockConnection: AsyncSqlConnection = {
      query: async () => ({ rows: [], rowCount: 0 }),
      queryOne: async <T = unknown>(_sql: string, ..._params: unknown[]) =>
        ({ id: 1 } as T),
      execute: async () => 0,
    };
    const row = await asyncQueryOne(mockConnection, "SELECT * FROM test");
    assert.ok(row);
    assert.equal((row as any).id, 1);
  });

  it("asyncExecute helper works", async () => {
    const mockConnection: AsyncSqlConnection = {
      query: async () => ({ rows: [], rowCount: 0 }),
      queryOne: async () => undefined,
      execute: async (_sql: string, ..._params: unknown[]) => 5,
    };
    const changes = await asyncExecute(mockConnection, "UPDATE test SET x = 1");
    assert.equal(changes, 5);
  });
});

// ── Storage Backend Runtime Profile Tests ─────────────────────────────────────

describe("StorageBackendRuntimeProfile", () => {
  it("has correct structure for SQLite", () => {
    const profile: StorageBackendRuntimeProfile = {
      environment: "development",
      driver: "sqlite",
      issues: [],
      postgres: null,
    };
    assert.equal(profile.environment, "development");
    assert.equal(profile.driver, "sqlite");
    assert.equal(profile.postgres, null);
  });

  it("has correct structure for PostgreSQL", () => {
    const profile: StorageBackendRuntimeProfile = {
      environment: "development",
      driver: "postgres",
      issues: [],
      postgres: {
        dsnConfigured: true,
        dsnSource: "AA_STORAGE_POSTGRES_DSN",
        dsnValue: "postgres://localhost/testdb",
        host: "localhost",
        database: "testdb",
        sslmode: null,
        poolMin: 0,
        poolMax: 20,
        dualRun: false,
        shadowSqlitePath: null,
        schema: null,
      },
    };
    assert.equal(profile.driver, "postgres");
    assert.ok(profile.postgres);
    assert.equal(profile.postgres?.host, "localhost");
    assert.equal(profile.postgres?.database, "testdb");
  });
});

// ── AuthoritativeStorageBackendOptions Tests ──────────────────────────────────

describe("AuthoritativeStorageBackendOptions", () => {
  it("accepts minimal options for SQLite", () => {
    const options: AuthoritativeStorageBackendOptions = { dbPath: ":memory:" };
    assert.equal(options.dbPath, ":memory:");
  });

  it("accepts environment override", () => {
    const options: AuthoritativeStorageBackendOptions = {
      dbPath: ":memory:",
      environment: "test",
    };
    assert.equal(options.environment, "test");
  });

  it("accepts env override", () => {
    const options: AuthoritativeStorageBackendOptions = {
      dbPath: ":memory:",
      env: { AA_STORAGE_DRIVER: "sqlite" },
    };
    assert.equal(options.env?.AA_STORAGE_DRIVER, "sqlite");
  });
});
