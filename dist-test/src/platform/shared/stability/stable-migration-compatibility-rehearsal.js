/**
 * Stable Migration Compatibility Rehearsal
 *
 * Tests that database migrations maintain compatibility with PostgreSQL and that
 * fresh SQLite bootstrap can reach the latest schema version:
 *
 * 1. Migration plan passes PostgreSQL portability rules
 *    - All migration statements are evaluated against portability rules
 *    - SQLite-only constructs are detected
 *    - Report shows compatibility status and any issues found
 *
 * 2. SQLite migration bootstrap reaches latest schema
 *    - Fresh database applies all migrations successfully
 *    - Schema status shows current version equals latest version
 *    - All migrations are marked as applied
 *
 * These scenarios verify migration infrastructure correctness and ensure
 * database schema evolution remains portable across supported databases.
 *
 * @see sqlite-migration-compatibility.ts for portability rule evaluation
 * @see sqlite-migration-plan.ts for migration versioning
 */
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { evaluateSqliteMigrationCompatibility } from "../../state-evidence/truth/sqlite/sqlite-migration-compatibility.js";
import { getLatestSqliteMigrationVersion } from "../../state-evidence/truth/sqlite/sqlite-migration-plan.js";
import { SqliteDatabase } from "../../state-evidence/truth/sqlite-database.js";
/**
 * Writes JSON to a file, creating parent directories as needed.
 * Used for persisting rehearsal reports and state artifacts.
 */
function writeJson(path, value) {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(value, null, 2));
}
/**
 * Executes a scenario and measures its duration.
 * Wraps scenario results with timing information for performance analysis.
 */
async function measureScenario(scenarioId, run) {
    const started = performance.now();
    const result = await run();
    return {
        scenarioId,
        durationMs: Math.round((performance.now() - started) * 100) / 100,
        ...result,
    };
}
/**
 * Scenario 1: Migration plan passes PostgreSQL portability rules.
 *
 * Evaluates all migration statements against PostgreSQL portability rules.
 * Detects SQLite-only constructs that would prevent portability.
 *
 * Verifies:
 * - Migration plan reports as compatible
 * - All statements are within PostgreSQL subset
 * - Any issues found are documented in the report
 */
async function runPortabilityRuleScenario() {
    return measureScenario("migration_plan_passes_pg_portability_rules", async () => {
        const report = evaluateSqliteMigrationCompatibility();
        return {
            passed: report.compatible,
            summary: "migration plan avoids SQLite-only runtime/bootstrap SQL and stays within the PostgreSQL portability subset",
            details: {
                compatible: report.compatible,
                migrationCount: report.migrationCount,
                statementCount: report.statementCount,
                issueCount: report.issueCount,
                issues: report.issues,
                checkedRuleIds: report.checkedRuleIds,
            },
        };
    });
}
/**
 * Scenario 2: SQLite migration bootstrap reaches latest schema.
 *
 * Tests that a fresh SQLite database can be bootstrapped and migrated
 * all the way to the latest schema version.
 *
 * Verifies:
 * - Database can be created and migrated
 * - Schema status shows "upToDate"
 * - Current version equals latest version
 * - Latest migration version is in applied list
 */
async function runSqliteBootstrapScenario(outputDir) {
    return measureScenario("sqlite_migration_bootstrap_reaches_latest_schema", async () => {
        const dbPath = join(outputDir, "sqlite-migration-compatibility.db");
        rmSync(dbPath, { force: true });
        const db = new SqliteDatabase(dbPath);
        db.migrate();
        const schemaStatus = db.getSchemaStatus();
        const appliedVersions = db.listAppliedMigrations().map((migration) => migration.version);
        db.close();
        const latestVersion = getLatestSqliteMigrationVersion();
        return {
            passed: schemaStatus.upToDate
                && schemaStatus.currentVersion === latestVersion
                && appliedVersions.at(-1) === latestVersion,
            summary: "fresh SQLite bootstrap still reaches the latest schema after runtime PRAGMAs are kept outside the migration plan",
            details: {
                dbPath,
                schemaStatus,
                latestVersion,
                appliedVersions,
            },
        };
    });
}
/**
 * Runs all migration compatibility rehearsal scenarios.
 *
 * Executes two scenarios:
 * 1. PostgreSQL portability rule evaluation
 * 2. SQLite bootstrap reaching latest schema
 */
export async function runStableMigrationCompatibilityRehearsal(options) {
    mkdirSync(options.outputDir, { recursive: true });
    const startedAt = new Date().toISOString();
    const scenarios = [
        await runPortabilityRuleScenario(),
        await runSqliteBootstrapScenario(options.outputDir),
    ];
    return {
        startedAt,
        finishedAt: new Date().toISOString(),
        outputDir: options.outputDir,
        totalScenarios: scenarios.length,
        passedScenarios: scenarios.filter((scenario) => scenario.passed).length,
        failedScenarios: scenarios.filter((scenario) => !scenario.passed).length,
        scenarios,
    };
}
/**
 * Writes the migration compatibility rehearsal report to a JSON file.
 */
export function writeStableMigrationCompatibilityRehearsalReport(path, report) {
    writeJson(path, report);
}
//# sourceMappingURL=stable-migration-compatibility-rehearsal.js.map