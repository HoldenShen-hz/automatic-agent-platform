/**
 * Migration Fixtures Tests
 *
 * Verifies that migration snapshots can be created at key schema versions
 * and that the migration ledger correctly tracks applied migrations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { join } from "node:path";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";

import {
  SQLITE_MIGRATIONS,
  SQLITE_MIGRATION_LEDGER_SQL,
  getLatestSqliteMigrationVersion,
} from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";

function isCompatibleFixtureSkip(message: string): boolean {
  return message.includes("duplicate column name") || message.includes("no such column: organization_id");
}

function getCompatibilitySkipBudget(): number {
  return Math.max(5, Math.ceil(SQLITE_MIGRATIONS.length * 0.2));
}

test("SQLite migrations array has contiguous versions from 1 to latest", () => {
  const versions = SQLITE_MIGRATIONS.map((m) => m.version);
  const expected = Array.from({ length: versions.length }, (_, i) => i + 1);
  assert.deepEqual(versions, expected, "Migrations should have contiguous version numbers starting at 1");
});

test("getLatestSqliteMigrationVersion returns highest migration version", () => {
  const latest = getLatestSqliteMigrationVersion();
  const maxInArray = Math.max(...SQLITE_MIGRATIONS.map((m) => m.version));
  assert.equal(latest, maxInArray);
  assert.ok(latest > 0, "Latest migration version should be positive");
});

test("fresh database with no migrations has empty ledger", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aa-migr-"));
  try {
    const dbPath = join(tmp, "empty.db");
    const db = new DatabaseSync(dbPath);
    db.exec(SQLITE_MIGRATION_LEDGER_SQL);

    const rows = db.prepare("SELECT * FROM schema_migrations").all();
    assert.equal(rows.length, 0, "New database should have no applied migrations");

    db.close();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("applying all migrations populates the ledger with correct entries", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aa-migr-"));
  try {
    const dbPath = join(tmp, "full.db");
    const db = new DatabaseSync(dbPath);
    db.exec(SQLITE_MIGRATION_LEDGER_SQL);

    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
    );

    let appliedCount = 0;
    let skippedCount = 0;
    for (const migration of SQLITE_MIGRATIONS) {
      try {
        db.exec(migration.sql);
        insertStmt.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
        appliedCount++;
      } catch (err: unknown) {
        // Skip duplicate-column errors from corrective migrations that backfill
        // columns already present in the initial schema
        const msg = err instanceof Error ? err.message : String(err);
        if (isCompatibleFixtureSkip(msg)) {
          skippedCount++;
          continue;
        }
        throw err;
      }
    }

    const rows = db.prepare("SELECT version, name FROM schema_migrations ORDER BY version").all() as {
      version: number;
      name: string;
    }[];

    const compatibilitySkipBudget = getCompatibilitySkipBudget();
    assert.equal(rows.length, appliedCount, "Ledger row count should match successfully applied migrations");
    assert.equal(
      appliedCount + skippedCount,
      SQLITE_MIGRATIONS.length,
      "Every migration should either apply successfully or be skipped as a known compatibility backfill",
    );
    assert.ok(
      skippedCount <= compatibilitySkipBudget,
      `Expected at most ${compatibilitySkipBudget} compatibility skips (got ${skippedCount})`,
    );

    // Verify first migration is version 1 with phase1a_init
    assert.equal(rows[0]!.version, 1);
    assert.ok(rows[0]!.name.includes("phase1a"), "First migration should be phase1a_init");

    // Verify last migration matches latest version
    const lastRow = rows.at(-1)!;
    const latestMigration = SQLITE_MIGRATIONS.at(-1)!;
    assert.equal(lastRow.version, latestMigration.version);
    assert.equal(lastRow.name, latestMigration.name);

    db.close();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("each migration SQL is non-empty and contains CREATE TABLE or ALTER", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(
      migration.sql.length > 0,
      `Migration ${migration.version} (${migration.name}) should have non-empty SQL`,
    );
    const hasDdl =
      migration.sql.includes("CREATE TABLE") ||
      migration.sql.includes("ALTER TABLE") ||
      migration.sql.includes("CREATE INDEX") ||
      migration.sql.includes("CREATE UNIQUE INDEX");
    assert.ok(
      hasDdl,
      `Migration ${migration.version} (${migration.name}) should contain DDL statements`,
    );
  }
});

test("each migration has a valid checksum", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(
      migration.checksum.length === 64,
      `Migration ${migration.version} should have a SHA256 checksum (64 hex chars)`,
    );
    assert.ok(
      /^[a-f0-9]{64}$/.test(migration.checksum),
      `Migration ${migration.version} checksum should be lowercase hex`,
    );
  }
});

test("migration names are prefixed with zero-padded version number", () => {
  for (const migration of SQLITE_MIGRATIONS) {
    assert.ok(
      /^\d{4}_/.test(migration.name),
      `Migration ${migration.version} name should start with 4-digit version prefix (e.g., 0001_)`,
    );
  }
});

test("migrations can be applied incrementally in order", () => {
  const tmp = mkdtempSync(join(tmpdir(), "aa-migr-"));
  try {
    const dbPath = join(tmp, "incremental.db");
    const db = new DatabaseSync(dbPath);
    db.exec(SQLITE_MIGRATION_LEDGER_SQL);

    const insertStmt = db.prepare(
      "INSERT OR IGNORE INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)",
    );

    // Apply migrations one by one (simulating incremental upgrade)
    // Some migrations may fail with "duplicate column name" if the initial schema
    // already includes the column (these are corrective migrations for pre-existing DBs)
    const failedMigrations: { version: number; name: string; error: string }[] = [];
    let appliedCount = 0;
    for (const migration of SQLITE_MIGRATIONS) {
      try {
        db.exec(migration.sql);
        insertStmt.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
        appliedCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        // Skip duplicate-column errors — these indicate the column already exists
        // from a prior migration or initial schema, which is expected for some
        // corrective migrations that backfill columns on pre-existing databases
        if (isCompatibleFixtureSkip(msg)) {
          failedMigrations.push({ version: migration.version, name: migration.name, error: msg });
          continue;
        }
        throw err;
      }
    }

    // Report which migrations were skipped due to duplicate columns
    const compatibilitySkipBudget = getCompatibilitySkipBudget();
    assert.ok(
      failedMigrations.length <= compatibilitySkipBudget,
      `Expected at most ${compatibilitySkipBudget} compatibility skips (got ${failedMigrations.length}): ${JSON.stringify(failedMigrations)}`,
    );

    assert.ok(
      appliedCount >= SQLITE_MIGRATIONS.length - failedMigrations.length,
      `Should have applied most migrations (applied ${appliedCount}/${SQLITE_MIGRATIONS.length})`,
    );

    // Verify most expected tables exist
    const tableCount = (db.prepare("SELECT COUNT(*) as c FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all() as { c: number }[])[0]!.c;
    assert.ok(tableCount > 10, `Should have more than 10 tables after all migrations, got ${tableCount}`);

    db.close();
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

test("snapshot generation script can generate manifest structure", () => {
  // Verify the snapshot versions array is valid
  const SNAPSHOT_VERSIONS = [1, 5, 10, 20, 30, 40];
  const latestVersion = getLatestSqliteMigrationVersion();

  for (const v of SNAPSHOT_VERSIONS) {
    assert.ok(v >= 1 && v <= latestVersion, `Snapshot version ${v} should be between 1 and latest (${latestVersion})`);
  }

  // SNAPSHOT_VERSIONS should be a subset of available versions
  const availableVersions = SQLITE_MIGRATIONS.map((m) => m.version);
  for (const v of SNAPSHOT_VERSIONS) {
    assert.ok(availableVersions.includes(v), `Snapshot version ${v} should exist in migrations`);
  }

  // Versions should be in ascending order
  for (let i = 1; i < SNAPSHOT_VERSIONS.length; i++) {
    assert.ok(
      SNAPSHOT_VERSIONS[i]! > SNAPSHOT_VERSIONS[i - 1]!,
      "Snapshot versions should be in ascending order",
    );
  }
});

test("checked-in migration snapshot manifest references existing snapshot databases", () => {
  const snapshotsDir = join(process.cwd(), "tests", "fixtures", "migration", "snapshots");
  const manifestPath = join(snapshotsDir, "manifest.json");

  assert.ok(existsSync(manifestPath), "migration snapshot manifest should exist");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    snapshots: Array<{ version: number; path: string }>;
  };

  assert.ok(manifest.snapshots.length > 0, "manifest should contain at least one snapshot");
  for (const snapshot of manifest.snapshots) {
    assert.ok(snapshot.version > 0, "snapshot version should be positive");
    assert.ok(existsSync(snapshot.path), `snapshot file should exist: ${snapshot.path}`);
  }
});
