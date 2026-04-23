import { SQLITE_MIGRATIONS, } from "./sqlite-migration-plan.js";
/**
 * Compatibility rules that check for SQLite-specific constructs
 * that would prevent PostgreSQL-portable migrations.
 */
const COMPATIBILITY_RULES = [
    {
        id: "sqlite_runtime_pragmas_stay_outside_migrations",
        evaluate(statement) {
            return /\bPRAGMA\b/i.test(statement)
                ? "SQLite runtime PRAGMA statements must stay in connection bootstrap, not in migration SQL."
                : null;
        },
    },
    {
        id: "sqlite_conflict_clauses_are_not_used",
        evaluate(statement) {
            return /\b(?:INSERT|UPDATE)\s+OR\s+(?:REPLACE|IGNORE|ABORT|FAIL|ROLLBACK)\b/i.test(statement)
                ? "SQLite-specific OR conflict clauses are not portable to PostgreSQL migration execution."
                : null;
        },
    },
    {
        id: "sqlite_autoincrement_is_not_used",
        evaluate(statement) {
            return /\bAUTOINCREMENT\b/i.test(statement)
                ? "SQLite AUTOINCREMENT is not portable to PostgreSQL-compatible migration plans."
                : null;
        },
    },
    {
        id: "sqlite_without_rowid_is_not_used",
        evaluate(statement) {
            return /\bWITHOUT\s+ROWID\b/i.test(statement)
                ? "SQLite WITHOUT ROWID tables are not portable to PostgreSQL migration plans."
                : null;
        },
    },
    {
        id: "sqlite_attach_detach_is_not_used",
        evaluate(statement) {
            return /\b(?:ATTACH|DETACH)\s+DATABASE\b/i.test(statement)
                ? "SQLite ATTACH/DETACH DATABASE statements are not portable to PostgreSQL migration execution."
                : null;
        },
    },
    {
        id: "sqlite_vacuum_is_not_used",
        evaluate(statement) {
            return /\bVACUUM\b/i.test(statement)
                ? "SQLite VACUUM statements are runtime maintenance commands and must stay outside migrations."
                : null;
        },
    },
];
/**
 * Splits SQL into individual statements by semicolon delimiter.
 * @param sql - The SQL string to split
 * @returns Array of individual SQL statements
 */
function splitSqlStatements(sql) {
    return sql
        .split(";")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0);
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
export function evaluateSqliteMigrationCompatibility(migrationPlan = SQLITE_MIGRATIONS) {
    const migrations = migrationPlan.map((migration) => {
        const statements = splitSqlStatements(migration.sql);
        const issues = [];
        statements.forEach((statement, index) => {
            COMPATIBILITY_RULES.forEach((rule) => {
                const detail = rule.evaluate(statement);
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
//# sourceMappingURL=sqlite-migration-compatibility.js.map