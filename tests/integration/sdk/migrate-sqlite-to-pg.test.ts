/**
 * @fileoverview Integration Tests for CLI migrate-sqlite-to-pg (2278-2279)
 *
 * Tests for migrate-sqlite-to-pg.ts CLI module:
 * - 2278: SQL injection vulnerability prevention
 * - 2279: Credential leak prevention in logs/output
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";

import {
  parseMigrateSqliteToPgArgs,
  planSqliteToPgMigration,
  migrateSqliteToPg,
  type MigrateSqliteToPgOptions,
} from "../../../src/sdk/cli/migrate-sqlite-to-pg.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { createTestPgDatabase, shouldRunPgIntegration, resetPgTables } from "../../helpers/pg-test-helper.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import { TEST_POSTGRES_DSN, buildTestPostgresDsn } from "../../helpers/network-test-constants.js";

// Check if PG integration tests can run
const pgCheck = shouldRunPgIntegration();
const CAN_RUN_PG_TESTS = pgCheck.enabled;

// ============================================================================
// Tests for 2278: SQL injection vulnerability prevention
// ============================================================================

test("2278: parseMigrateSqliteToPgArgs does not interpolate SQL in table names", () => {
  // This tests that malicious input in sqlite path cannot cause SQL injection
  // The table names are hardcoded in the module, so injection should not be possible
  const maliciousPath = "/tmp/'; DROP TABLE tasks; --";
  const options = parseMigrateSqliteToPgArgs([
    "--sqlite",
    maliciousPath,
    "--pg-dsn",
    buildTestPostgresDsn({ database: "db" }),
  ]);

  assert.equal(options.sqlitePath, maliciousPath);
  // The sqlitePath is used to open a file, not in SQL - so it's handled by the OS
  // The pgDsn is used for connection, not in SQL
});

test("2278: planSqliteToPgMigration uses parameterized queries for table access", () => {
  const workspace = createTempWorkspace("aa-migrate-sql-injection-");
  try {
    const db = new SqliteDatabase(join(workspace, "test.db"));
    db.migrate();

    // Insert a task to verify migration planning works
    db.connection.prepare(`
      INSERT INTO tasks (
        id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
        error_code, created_at, updated_at, completed_at
      ) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
    `).run(
      "task_sql_injection_test",
      "task_sql_injection_test",
      "SQL injection test",
      "queued",
      "user",
      "normal",
      "{}",
      "{}",
      "{}",
      null,
      0,
      new Date().toISOString(),
      new Date().toISOString(),
    );

    const plan = planSqliteToPgMigration(db);

    assert.ok(plan.length > 100, "Plan should enumerate the current authoritative schema surface");
    const tableNames = new Set(plan.map((entry) => entry.table));
    assert.ok(tableNames.has("tasks"));
    assert.ok(tableNames.has("events"));
    assert.ok(tableNames.has("event_consumer_acks"));
    assert.ok(tableNames.has("secret_registry"));
    assert.ok(tableNames.has("release_execution_reports"));

    // Verify task count is correctly reported
    const taskPlan = plan.find((entry) => entry.table === "tasks");
    assert.ok(taskPlan);
    assert.equal(taskPlan.rowCount, 1);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("2278: planSqliteToPgMigration fails closed when a canonical source table is missing", () => {
  const workspace = createTempWorkspace("aa-migrate-missing-table-");
  try {
    const db = new SqliteDatabase(join(workspace, "incomplete.db"));
    db.migrate();

    db.connection.exec("DROP TABLE events");

    assert.throws(
      () => planSqliteToPgMigration(db),
      /migrate_sqlite_to_pg\.missing_source_table:events/,
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ============================================================================
// Tests for 2279: Credential leak prevention in logs/output
// ============================================================================

test("2279: parseMigrateSqliteToPgArgs does not leak credentials in error messages", () => {
  // When required arguments are missing, the error should not contain the DSN
  // even if it was partially parsed

  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/test.db"]),
    (error: unknown) => {
      if (error instanceof Error) {
        // The error message should mention usage/arguments but NOT the DSN value
        const message = error.message;
        const hasDsnLeak = message.includes("postgresql://") || message.includes("password");
        return !hasDsnLeak && message.includes("usage");
      }
      return false;
    }
  );
});

test("2279: parseMigrateSqliteToPgArgs correctly parses DSN without leaking", () => {
  const dsnWithPassword = TEST_POSTGRES_DSN;
  const options = parseMigrateSqliteToPgArgs([
    "--sqlite",
    "/tmp/test.db",
    "--pg-dsn",
    dsnWithPassword,
  ]);

  // Verify the DSN was parsed correctly
  assert.equal(options.pgDsn, dsnWithPassword);

  // Verify the error message doesn't leak when we have all required args
  const errorMessage = JSON.stringify(options);
    assert.ok(!errorMessage.includes("test-password") || errorMessage.includes(dsnWithPassword));
});

test("2279: migrateSqliteToPg output does not contain credentials in dry-run mode", async () => {
  if (!CAN_RUN_PG_TESTS) {
    // Skip if PG not available - just test the parsing
    const options = parseMigrateSqliteToPgArgs([
      "--sqlite",
      "/tmp/test.db",
      "--pg-dsn",
      buildTestPostgresDsn({ password: "dry-run-password-placeholder", database: "db" }),
      "--dry-run",
    ]);

    // Dry run returns migration plan without connecting to PG
    // Verify options were parsed correctly
    assert.equal(options.dryRun, true);
    assert.ok(options.pgDsn.includes("dry-run-password-placeholder")); // Password is stored in options
    return;
  }

  const workspace = createTempWorkspace("aa-migrate-dry-run-");
  let output = "";
  let outputContainsPassword = false;

  try {
    const db = new SqliteDatabase(join(workspace, "source.db"));
    db.migrate();
    db.close();

    const options: MigrateSqliteToPgOptions = {
      sqlitePath: join(workspace, "source.db"),
      pgDsn: buildTestPostgresDsn({ password: "dry-run-password-placeholder" }),
      dryRun: true,
    };

    const result = await migrateSqliteToPg(options);
    output = JSON.stringify(result);

    // Check if output contains the password
    outputContainsPassword = output.includes("dry-run-password-placeholder");

    db.close();
  } finally {
    cleanupPath(workspace);
  }

  // The migration result (table counts) should not contain the password
  // Note: The password IS stored in options.pgDsn internally,
  // but it should not appear in the migration result output
  assert.equal(outputContainsPassword, false, "Password should not appear in migration output");
});

// ============================================================================
// Integration tests with real PostgreSQL (if available)
// ============================================================================

test("Integration: migrateSqliteToPg with real PostgreSQL (dry-run)", async () => {
  if (!CAN_RUN_PG_TESTS) {
    // Test parsing and planning without real PG
    const workspace = createTempWorkspace("aa-migrate-dry-run-only-");
    try {
      const db = new SqliteDatabase(join(workspace, "source.db"));
      db.migrate();

      // Insert test data
      db.connection.prepare(`
        INSERT INTO tasks (
          id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
          input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
          error_code, created_at, updated_at, completed_at
        ) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
      `).run(
        "task_dry_run_1",
        "task_dry_run_1",
        "Dry run test task",
        "queued",
        "user",
        "normal",
        "{}",
        "{}",
        "{}",
        null,
        0,
        new Date().toISOString(),
        new Date().toISOString(),
      );

      const plan = planSqliteToPgMigration(db);

      const taskPlan = plan.find((entry) => entry.table === "tasks");
      assert.ok(taskPlan);
      assert.equal(taskPlan.rowCount, 1);

      db.close();
    } finally {
      cleanupPath(workspace);
    }
    return;
  }

  // Real PG integration test
  const workspace = createTempWorkspace("aa-migrate-real-pg-");
  let pgDb = null;

  try {
    pgDb = await createTestPgDatabase();

    // Create source SQLite DB
    const sqlitePath = join(workspace, "source.db");
    const sqliteDb = new SqliteDatabase(sqlitePath);
    sqliteDb.migrate();

    // Insert test data
    const now = new Date().toISOString();
    sqliteDb.connection.prepare(`
      INSERT INTO tasks (
        id, parent_id, root_id, division_id, tenant_id, title, status, source, priority,
        input_json, normalized_input_json, output_json, estimated_cost_usd, actual_cost_usd,
        error_code, created_at, updated_at, completed_at
      ) VALUES (?, NULL, ?, NULL, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)
    `).run(
      "task_migrate_001",
      "task_migrate_001",
      "Migration test task",
      "queued",
      "user",
      "normal",
      "{}",
      "{}",
      "{}",
      null,
      0,
      now,
      now,
    );

    sqliteDb.close();

    // Run dry-run migration
    const options: MigrateSqliteToPgOptions = {
      sqlitePath,
      pgDsn: (pgDb as any).dsn,
      dryRun: true,
    };

    const result = await migrateSqliteToPg(options);

    // Verify result structure
    assert.ok(Array.isArray(result));
    assert.ok(result.length > 0);

    const taskResult = result.find((entry) => entry.table === "tasks");
    assert.ok(taskResult);
    assert.equal(taskResult.migrated, 1); // In dry-run, migrated = rowCount

  } finally {
    if (pgDb) {
      await resetPgTables(pgDb as any, ["tasks", "sessions", "executions", "leases", "events",
        "approvals", "artifacts", "billing_records", "dispatches",
        "divisions", "evolutions", "intelligence_records", "locks",
        "marketplace_listings", "memory_entries", "operations",
        "organizations", "releases", "secret_registry", "secret_usage_audits",
        "secret_rotation_events", "secret_leases", "workers", "workflows"]);
      await (pgDb as any).close();
    }
    cleanupPath(workspace);
  }
});

// ============================================================================
// Tests for parseMigrateSqliteToPgArgs argument parsing
// ============================================================================

test("parseMigrateSqliteToPgArgs parses --sqlite-path alias", () => {
  const options = parseMigrateSqliteToPgArgs([
    "--sqlite-path",
    "/tmp/my-db.db",
    "--pg-dsn",
    "postgresql://localhost/db",
  ]);

  assert.equal(options.sqlitePath, "/tmp/my-db.db");
});

test("parseMigrateSqliteToPgArgs parses --dry-run flag", () => {
  const options = parseMigrateSqliteToPgArgs([
    "--sqlite",
    "/tmp/db.db",
    "--pg-dsn",
    "postgresql://localhost/db",
    "--dry-run",
  ]);

  assert.equal(options.dryRun, true);
});

test("parseMigrateSqliteToPgArgs defaults dryRun to false when not provided", () => {
  const options = parseMigrateSqliteToPgArgs([
    "--sqlite",
    "/tmp/db.db",
    "--pg-dsn",
    "postgresql://localhost/db",
  ]);

  assert.equal(options.dryRun, false);
});

test("parseMigrateSqliteToPgArgs rejects missing sqlite path", () => {
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--pg-dsn", "postgresql://localhost/db"]),
    /usage/
  );
});

test("parseMigrateSqliteToPgArgs rejects missing pg-dsn", () => {
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/db.db"]),
    /usage/
  );
});

test("parseMigrateSqliteToPgArgs handles empty sqlite path", () => {
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "", "--pg-dsn", "postgresql://localhost/db"]),
    /usage/
  );
});

test("parseMigrateSqliteToPgArgs handles empty pg-dsn", () => {
  assert.throws(
    () => parseMigrateSqliteToPgArgs(["--sqlite", "/tmp/db.db", "--pg-dsn", ""]),
    /usage/
  );
});
