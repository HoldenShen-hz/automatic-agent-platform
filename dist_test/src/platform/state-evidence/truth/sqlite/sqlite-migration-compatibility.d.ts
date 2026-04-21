import { type SqliteMigrationDefinition } from "./sqlite-migration-plan.js";
/**
 * Rule IDs for SQLite migration compatibility checks.
 * These rules ensure migrations are portable and safe.
 */
export type SqliteMigrationCompatibilityRuleId = "sqlite_runtime_pragmas_stay_outside_migrations" | "sqlite_conflict_clauses_are_not_used" | "sqlite_autoincrement_is_not_used" | "sqlite_without_rowid_is_not_used" | "sqlite_attach_detach_is_not_used" | "sqlite_vacuum_is_not_used";
/**
 * Issue found during migration compatibility evaluation.
 */
export interface SqliteMigrationCompatibilityIssue {
    ruleId: SqliteMigrationCompatibilityRuleId;
    migrationVersion: number;
    migrationName: string;
    statementIndex: number;
    detail: string;
    statement: string;
}
/**
 * Result of evaluating a single migration for compatibility.
 */
export interface SqliteMigrationCompatibilityMigrationResult {
    version: number;
    name: string;
    compatible: boolean;
    statementCount: number;
    issues: SqliteMigrationCompatibilityIssue[];
}
/**
 * Comprehensive compatibility report for all migrations.
 */
export interface SqliteMigrationCompatibilityReport {
    checkedAt: string;
    compatible: boolean;
    checkedRuleIds: readonly SqliteMigrationCompatibilityRuleId[];
    migrationCount: number;
    statementCount: number;
    issueCount: number;
    issues: SqliteMigrationCompatibilityIssue[];
    migrations: SqliteMigrationCompatibilityMigrationResult[];
}
/**
 * Evaluates all migrations for PostgreSQL compatibility.
 *
 * Checks each SQL statement in each migration against rules that detect
 * SQLite-specific constructs that would prevent the migration from being
 * portable to PostgreSQL.
 *
 * @param migrationPlan - The migration plan to evaluate (defaults to SQLITE_MIGRATIONS)
 * @returns A comprehensive compatibility report
 */
export declare function evaluateSqliteMigrationCompatibility(migrationPlan?: readonly SqliteMigrationDefinition[]): SqliteMigrationCompatibilityReport;
