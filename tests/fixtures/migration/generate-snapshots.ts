/**
 * Migration Snapshot Generator
 *
 * Generates SQLite snapshot databases at specific schema versions.
 * These snapshots are used for testing upgrade/rollback migration paths.
 *
 * Usage:
 *   node --import tsx tests/fixtures/migration/generate-snapshots.ts [outputDir]
 *
 * Key versions for snapshots:
 *   - v1:  Initial phase1a schema (baseline)
 *   - v5:  Early worker routing migrations
 *   - v10: Message parts + remote routing
 *   - v20: Billing + perception + gateway
 *   - v30: Workflow dispatch + LLM eval
 *   - latest: Current head schema
 */

import { mkdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";

import {
  SQLITE_MIGRATIONS,
} from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";

const OUTPUT_DIR = process.argv[2] ?? join(process.cwd(), "tests", "fixtures", "migration", "snapshots");

// Key version milestones for snapshot generation
export const SNAPSHOT_VERSIONS = [...new Set([1, 5, 10, 20, 30, SQLITE_MIGRATIONS.at(-1)?.version ?? 0])]
  .filter((version) => version > 0)
  .sort((left, right) => left - right);

interface SnapshotResult {
  version: number;
  name: string;
  path: string;
  sizeBytes: number;
}

/**
 * Generates a snapshot database at the specified version.
 */
function generateSnapshot(version: number): SnapshotResult {
  const dbPath = join(OUTPUT_DIR, `v${version}-snapshot.db`);
  rmSync(dbPath, { force: true });

  const db = new SqliteDatabase(dbPath, {
    migrationPlan: SQLITE_MIGRATIONS.filter((migration) => migration.version <= version),
  });
  db.migrate();
  db.close();

  let sizeBytes = 0;
  try {
    sizeBytes = statSync(dbPath).size;
  } catch {
    // stat unavailable
  }

  const migration = SQLITE_MIGRATIONS.find((m) => m.version === version);
  const name = migration?.name ?? `unknown`;

  console.log(`Generated snapshot v${version} (${name}) -> ${dbPath}`);

  return {
    version,
    name,
    path: relative(OUTPUT_DIR, dbPath) || `v${version}-snapshot.db`,
    sizeBytes,
  };
}

/**
 * Main entry point: generates snapshots for all key versions.
 */
export function main(): SnapshotResult[] {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Generating migration snapshots in: ${OUTPUT_DIR}`);
  console.log(`Target versions: ${SNAPSHOT_VERSIONS.join(", ")}`);
  console.log("");

  const results: SnapshotResult[] = [];

  for (const version of SNAPSHOT_VERSIONS) {
    const migration = SQLITE_MIGRATIONS.find((m) => m.version === version);
    if (!migration) {
      console.warn(`Migration v${version} not found, skipping`);
      continue;
    }
    const result = generateSnapshot(version);
    results.push(result);
  }

  // Write manifest
  const manifest = {
    generatedAt: new Date().toISOString(),
    latestVersion: SQLITE_MIGRATIONS.at(-1)?.version ?? 0,
    snapshots: results,
  };

  const manifestPath = join(OUTPUT_DIR, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
  console.log(`\nManifest written to: ${manifestPath}`);

  return results;
}

if (process.argv[1] && process.argv[1].endsWith("generate-snapshots.ts")) {
  main();
}
