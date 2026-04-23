import { type SqliteMigrationDefinition } from "./sqlite-migration-plan.js";
/**
 * Rule IDs for SQLite schema compatibility checks.
 * These rules prevent breaking schema changes from shipping.
 */
export type SqliteSchemaCompatibilityRuleId = "destructive_drop_table_is_blocked" | "destructive_drop_column_is_blocked" | "drop_index_requires_review" | "table_rename_requires_review" | "column_rename_requires_review" | "add_not_null_column_requires_default";
/**
 * Issue found during schema compatibility evaluation.
 */
export interface SqliteSchemaCompatibilityIssue {
    ruleId: SqliteSchemaCompatibilityRuleId;
    migrationVersion: number;
    migrationName: string;
    statementIndex: number;
    detail: string;
    statement: string;
}
/**
 * Result of evaluating a single migration for schema compatibility.
 */
export interface SqliteSchemaCompatibilityMigrationResult {
    version: number;
    name: string;
    compatible: boolean;
    statementCount: number;
    issues: SqliteSchemaCompatibilityIssue[];
}
/**
 * Comprehensive schema compatibility report for all migrations.
 */
export interface SqliteSchemaCompatibilityReport {
    checkedAt: string;
    compatible: boolean;
    checkedRuleIds: readonly SqliteSchemaCompatibilityRuleId[];
    migrationCount: number;
    statementCount: number;
    issueCount: number;
    issues: SqliteSchemaCompatibilityIssue[];
    migrations: SqliteSchemaCompatibilityMigrationResult[];
}
/**
 * Evaluates all migrations for schema compatibility.
 *
 * Checks each SQL statement in each migration against rules that detect
 * potentially breaking schema changes that require explicit review.
 *
 * @param migrationPlan - The migration plan to evaluate (defaults to SQLITE_MIGRATIONS)
 * @returns A comprehensive compatibility report
 */
export declare function evaluateSqliteSchemaCompatibilityGate(migrationPlan?: readonly SqliteMigrationDefinition[]): SqliteSchemaCompatibilityReport;
