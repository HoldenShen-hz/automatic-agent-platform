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
/** Options for running the migration compatibility rehearsal */
export interface StableMigrationCompatibilityRehearsalOptions {
    outputDir: string;
}
/** Result of a single migration compatibility scenario */
export interface StableMigrationCompatibilityScenarioResult {
    scenarioId: "migration_plan_passes_pg_portability_rules" | "sqlite_migration_bootstrap_reaches_latest_schema";
    passed: boolean;
    durationMs: number;
    summary: string;
    details: Record<string, unknown>;
}
/** Complete report from the migration compatibility rehearsal */
export interface StableMigrationCompatibilityRehearsalReport {
    startedAt: string;
    finishedAt: string;
    outputDir: string;
    totalScenarios: number;
    passedScenarios: number;
    failedScenarios: number;
    scenarios: StableMigrationCompatibilityScenarioResult[];
}
/**
 * Runs all migration compatibility rehearsal scenarios.
 *
 * Executes two scenarios:
 * 1. PostgreSQL portability rule evaluation
 * 2. SQLite bootstrap reaching latest schema
 */
export declare function runStableMigrationCompatibilityRehearsal(options: StableMigrationCompatibilityRehearsalOptions): Promise<StableMigrationCompatibilityRehearsalReport>;
/**
 * Writes the migration compatibility rehearsal report to a JSON file.
 */
export declare function writeStableMigrationCompatibilityRehearsalReport(path: string, report: StableMigrationCompatibilityRehearsalReport): void;
