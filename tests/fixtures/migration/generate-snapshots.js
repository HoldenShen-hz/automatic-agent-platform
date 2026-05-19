/**
 * Migration Snapshot Generator
 *
 * Generates SQLite snapshot databases at specific schema versions.
 * These snapshots are used for testing upgrade/rollback migration paths.
 *
 * Usage:
 *   npm run build && node dist/tests/fixtures/migration/generate-snapshots.js [outputDir]
 *
 * Key versions for snapshots:
 *   - v1:  Initial phase1a schema (baseline)
 *   - v5:  Early worker routing migrations
 *   - v10: Message parts + remote routing
 *   - v20: Billing + perception + gateway
 *   - v30: Workflow dispatch + LLM eval
 *   - v40: Session events (current latest)
 */
import { mkdirSync, writeFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { SQLITE_MIGRATIONS, SQLITE_MIGRATION_LEDGER_SQL, } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-migration-plan.js";
const OUTPUT_DIR = process.argv[2] ?? join(process.cwd(), "tests", "fixtures", "migration", "snapshots");
// Key version milestones for snapshot generation
const SNAPSHOT_VERSIONS = [1, 5, 10, 20, 30, 40];
/**
 * Applies all migrations up to (and including) the specified version.
 */
function applyMigrationsUpTo(db, maxVersion) {
    db.exec(SQLITE_MIGRATION_LEDGER_SQL);
    const insertStmt = db.prepare("INSERT OR IGNORE INTO schema_migrations (version, name, checksum, applied_at) VALUES (?, ?, ?, ?)");
    const appliedMigrations = SQLITE_MIGRATIONS.filter((m) => m.version <= maxVersion);
    for (const migration of appliedMigrations) {
        try {
            db.exec(migration.sql);
            insertStmt.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
        }
        catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("duplicate column name")) {
                insertStmt.run(migration.version, migration.name, migration.checksum, new Date().toISOString());
                continue;
            }
            throw error;
        }
    }
}
/**
 * Generates a snapshot database at the specified version.
 */
function generateSnapshot(version) {
    const dbPath = join(OUTPUT_DIR, `v${version}-snapshot.db`);
    const db = new DatabaseSync(dbPath);
    applyMigrationsUpTo(db, version);
    db.close();
    let sizeBytes = 0;
    try {
        sizeBytes = statSync(dbPath).size;
    }
    catch {
        // stat unavailable
    }
    const migration = SQLITE_MIGRATIONS.find((m) => m.version === version);
    const name = migration?.name ?? `unknown`;
    console.log(`Generated snapshot v${version} (${name}) -> ${dbPath}`);
    return {
        version,
        name,
        path: dbPath,
        sizeBytes,
    };
}
/**
 * Main entry point: generates snapshots for all key versions.
 */
export function main() {
    mkdirSync(OUTPUT_DIR, { recursive: true });
    console.log(`Generating migration snapshots in: ${OUTPUT_DIR}`);
    console.log(`Target versions: ${SNAPSHOT_VERSIONS.join(", ")}`);
    console.log("");
    const results = [];
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
main();
//# sourceMappingURL=generate-snapshots.js.map