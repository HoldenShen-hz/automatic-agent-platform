import {
  SQLITE_MIGRATIONS,
  type SqliteMigrationDefinition,
} from "./sqlite-migration-plan.js";

/**
 * Rule IDs for SQLite schema compatibility checks.
 * These rules prevent breaking schema changes from shipping.
 */
export type SqliteSchemaCompatibilityRuleId =
  | "destructive_drop_table_is_blocked"
  | "destructive_drop_column_is_blocked"
  | "drop_index_requires_review"
  | "table_rename_requires_review"
  | "column_rename_requires_review"
  | "add_not_null_column_requires_default";

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
 * Interface for a single compatibility rule evaluator.
 */
interface CompatibilityRule {
  id: SqliteSchemaCompatibilityRuleId;
  evaluate(statement: string, statements: readonly string[], statementIndex: number): string | null;
}

/**
 * Checks if a DROP INDEX statement is part of a safe tenant-scoped index replacement.
 * This is allowed because it's replacing an index to add tenant scoping.
 */
function isSafeTenantScopedIndexReplacement(
  statement: string,
  statements: readonly string[],
): boolean {
  if (!/^\s*DROP\s+INDEX\s+IF\s+EXISTS\s+idx_extension_packages_extension_version\s*$/i.test(statement)) {
    return false;
  }

  // Check if the replacement index is created in the same migration
  return statements.some((candidate) =>
    /CREATE\s+UNIQUE\s+INDEX\s+IF\s+NOT\s+EXISTS\s+idx_extension_packages_tenant_extension_version\s+ON\s+extension_packages\s*\(\s*COALESCE\s*\(\s*tenant_id\s*,\s*''\s*\)\s*,\s*extension_id\s*,\s*version\s*\)/i
      .test(candidate)
  );
}

/**
 * Compatibility rules that detect potentially breaking schema changes.
 * These rules ensure migrations are reviewed for compatibility impact.
 */
const COMPATIBILITY_RULES: readonly CompatibilityRule[] = [
  {
    id: "destructive_drop_table_is_blocked",
    evaluate(statement) {
      return /\bDROP\s+TABLE\b/i.test(statement)
        ? "DROP TABLE is a breaking schema change and must not ship without an explicit compatibility migration plan."
        : null;
    },
  },
  {
    id: "destructive_drop_column_is_blocked",
    evaluate(statement) {
      return /\bDROP\s+COLUMN\b/i.test(statement)
        ? "DROP COLUMN is a breaking schema change and must not ship without a staged compatibility migration."
        : null;
    },
  },
  {
    id: "drop_index_requires_review",
    evaluate(statement, statements) {
      // Allow the safe tenant-scoped index replacement
      if (isSafeTenantScopedIndexReplacement(statement, statements)) {
        return null;
      }

      return /\bDROP\s+INDEX\b/i.test(statement)
        ? "DROP INDEX can change runtime query safety and requires explicit compatibility review."
        : null;
    },
  },
  {
    id: "table_rename_requires_review",
    evaluate(statement) {
      return /\bALTER\s+TABLE\b[\s\S]*\bRENAME\s+TO\b/i.test(statement)
        ? "ALTER TABLE ... RENAME TO is treated as a compatibility-risking change and requires explicit review."
        : null;
    },
  },
  {
    id: "column_rename_requires_review",
    evaluate(statement) {
      return /\bALTER\s+TABLE\b[\s\S]*\bRENAME\s+COLUMN\b/i.test(statement)
        ? "ALTER TABLE ... RENAME COLUMN is treated as a compatibility-risking change and requires explicit review."
        : null;
    },
  },
  {
    id: "add_not_null_column_requires_default",
    evaluate(statement) {
      return /\bALTER\s+TABLE\b/i.test(statement)
        && /\bADD\s+COLUMN\b/i.test(statement)
        && /\bNOT\s+NULL\b/i.test(statement)
        && !/\bDEFAULT\b/i.test(statement)
        ? "Adding a NOT NULL column without a DEFAULT is not backward compatible for existing rows."
        : null;
    },
  },
] as const;

/**
 * Splits SQL into individual statements by semicolon delimiter.
 * @param sql - The SQL string to split
 * @returns Array of individual SQL statements
 */
function splitSqlStatements(sql: string): string[] {
  return sql
    .split(";")
    .map((statement) => statement.trim())
    .filter((statement) => statement.length > 0);
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
export function evaluateSqliteSchemaCompatibilityGate(
  migrationPlan: readonly SqliteMigrationDefinition[] = SQLITE_MIGRATIONS,
): SqliteSchemaCompatibilityReport {
  const migrations: SqliteSchemaCompatibilityMigrationResult[] = migrationPlan.map((migration) => {
    const statements = splitSqlStatements(migration.sql);
    const issues: SqliteSchemaCompatibilityIssue[] = [];

    statements.forEach((statement, index) => {
      COMPATIBILITY_RULES.forEach((rule) => {
        const detail = rule.evaluate(statement, statements, index);
        if (detail == null) {
          return;
        }

        issues.push({
          ruleId: rule.id,
          migrationVersion: migration.version,
          migrationName: migration.name,
          statementIndex: index + 1,
          detail,
          statement,
        });
      });
    });

    return {
      version: migration.version,
      name: migration.name,
      compatible: issues.length === 0,
      statementCount: statements.length,
      issues,
    };
  });

  const issues = migrations.flatMap((migration) => migration.issues);

  return {
    checkedAt: new Date().toISOString(),
    compatible: issues.length === 0,
    checkedRuleIds: COMPATIBILITY_RULES.map((rule) => rule.id),
    migrationCount: migrations.length,
    statementCount: migrations.reduce((sum, migration) => sum + migration.statementCount, 0),
    issueCount: issues.length,
    issues,
    migrations,
  };
}
