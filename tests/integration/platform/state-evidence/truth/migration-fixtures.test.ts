/**
 * Migration Fixtures Tests
 *
 * Verifies that migration snapshots can be created at key schema versions
 * and that the migration ledger correctly tracks applied migrations.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { DatabaseSync } from "node:sqlite";
import { dirname, join } from "node:path";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  SQLITE_MIGRATIONS,
  SQLITE_MIGRATION_LEDGER_SQL,
  getLatestSqliteMigrationVersion,
} from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { SqliteDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SNAPSHOT_VERSIONS } from "../../../../fixtures/migration/generate-snapshots.js";

const currentDir = dirname(fileURLToPath(import.meta.url));
const snapshotsDir = join(currentDir, "../../../../fixtures/migration/snapshots");

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
    const db = new SqliteDatabase(dbPath);
    db.migrate();

    const rows = db.connection.prepare("SELECT version, name FROM schema_migrations ORDER BY version").all() as {
      version: number;
      name: string;
    }[];

    assert.equal(rows.length, SQLITE_MIGRATIONS.length, "Ledger row count should match the full migration plan");

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

test("migrations upgrade checked-in snapshots to the latest version", () => {
  try {
    const latestVersion = getLatestSqliteMigrationVersion();
    const manifest = JSON.parse(readFileSync(join(snapshotsDir, "manifest.json"), "utf8")) as {
      snapshots: Array<{ version: number; path: string }>;
    };

    for (const snapshot of manifest.snapshots.filter((entry) => entry.version < latestVersion)) {
      const tmp = mkdtempSync(join(tmpdir(), "aa-migr-"));
      try {
        const dbPath = join(tmp, "upgrade.db");
        copyFileSync(join(snapshotsDir, snapshot.path), dbPath);
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const appliedRows = db.connection.prepare("SELECT COUNT(*) AS count FROM schema_migrations").get() as { count: number };
        const latestRow = db.connection.prepare("SELECT MAX(version) AS version FROM schema_migrations").get() as { version: number };
        assert.equal(appliedRows.count, SQLITE_MIGRATIONS.length, `snapshot v${snapshot.version} should apply all migrations`);
        assert.equal(latestRow.version, latestVersion, `snapshot v${snapshot.version} should upgrade to latest`);
        db.close();
      } finally {
        rmSync(tmp, { recursive: true, force: true });
      }
    }
  } finally {
    // no-op
  }
});

test("snapshot generation script can generate manifest structure", () => {
  // Verify the snapshot versions array is valid
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
  const manifestPath = join(snapshotsDir, "manifest.json");

  assert.ok(existsSync(manifestPath), "migration snapshot manifest should exist");

  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    snapshots: Array<{ version: number; path: string }>;
  };

  assert.ok(manifest.snapshots.length > 0, "manifest should contain at least one snapshot");
  assert.deepEqual(
    manifest.snapshots.map((snapshot) => snapshot.version),
    SNAPSHOT_VERSIONS,
    "checked-in manifest should stay in lockstep with the generator snapshot version plan",
  );
  for (const snapshot of manifest.snapshots) {
    assert.ok(snapshot.version > 0, "snapshot version should be positive");
    assert.ok(existsSync(join(snapshotsDir, snapshot.path)), `snapshot file should exist: ${snapshot.path}`);
  }
});
