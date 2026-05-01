import { basename } from "node:path";

import { SqliteDatabase } from "../../platform/state-evidence/truth/sqlite/sqlite-database.js";
import { PgDatabase } from "../../platform/state-evidence/truth/postgres/pg-database.js";

const TABLES = [
  "tasks",
  "sessions",
  "executions",
  "leases",
  "events",
  "approvals",
  "artifacts",
  "billing_records",
  "dispatches",
  "divisions",
  "evolutions",
  "intelligence_records",
  "locks",
  "marketplace_listings",
  "memory_entries",
  "operations",
  "organizations",
  "releases",
  "secret_registry",
  "secret_usage_audits",
  "secret_rotation_events",
  "secret_leases",
  "workers",
  "workflows",
] as const;

/** Whitelist-validated table name type */
type ValidTableName = typeof TABLES[number];

/**
 * Validate that a table name is in the whitelist to prevent SQL injection.
 * @param table - Table name to validate
 * @throws Error if table name is not in whitelist
 */
function validateTableName(table: string): ValidTableName {
  if (!(TABLES as readonly string[]).includes(table)) {
    throw new Error(`Invalid table name: ${table}. Must be one of: ${TABLES.join(", ")}`);
  }
  return table as ValidTableName;
}

/**
 * Whitelist of valid column name characters.
 * Allows alphanumeric, underscore, and common PostgreSQL identifier characters.
 * Prevents SQL injection via column names from attacker-controlled SQLite DB.
 */
const VALID_COLUMN_NAME_REGEX = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

/**
 * Validate that a column name is safe for SQL insertion.
 * Column names come from the SQLite database which may be attacker-controlled.
 * @param column - Column name to validate
 * @throws Error if column name contains potentially dangerous characters
 */
function validateColumnName(column: string): string {
  if (!VALID_COLUMN_NAME_REGEX.test(column)) {
    throw new Error(`Invalid column name: ${column}. Column names must match ${VALID_COLUMN_NAME_REGEX}`);
  }
  return column;
}

/**
 * Validate an array of column names from SQLite database.
 * All columns must pass validation before any are used in SQL.
 * @param columns - Array of column names to validate
 * @throws Error if any column name is invalid
 */
function validateColumnNames(columns: string[]): string[] {
  if (columns.length === 0) {
    return columns;
  }
  // Validate all columns first before using any in SQL
  for (const column of columns) {
    validateColumnName(column);
  }
  return columns;
}

export interface MigrateSqliteToPgOptions {
  sqlitePath: string;
  pgDsn: string;
  dryRun: boolean;
}

export function parseMigrateSqliteToPgArgs(argv: string[]): MigrateSqliteToPgOptions {
  let sqlitePath = "";
  let pgDsn = "";
  let dryRun = false;
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index] ?? "";
    if (arg === "--sqlite" || arg === "--sqlite-path") {
      sqlitePath = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--pg-dsn") {
      pgDsn = argv[index + 1] ?? "";
      index += 1;
      continue;
    }
    if (arg === "--dry-run") {
      dryRun = true;
    }
  }
  if (!sqlitePath || !pgDsn) {
    throw new Error("usage: migrate-sqlite-to-pg --sqlite <path> --pg-dsn <dsn> [--dry-run]");
  }
  return { sqlitePath, pgDsn, dryRun };
}

export function planSqliteToPgMigration(sqlite: SqliteDatabase): Array<{ table: string; rowCount: number }> {
  return TABLES.map((table) => {
    try {
      const validatedTable = validateTableName(table);
      const row = sqlite.connection.prepare(`SELECT COUNT(*) AS count FROM ${validatedTable}`).get() as { count?: number } | undefined;
      return { table: validatedTable, rowCount: row?.count ?? 0 };
    } catch (error) {
      if (error instanceof Error && /no such table/i.test(error.message)) {
        return { table, rowCount: 0 };
      }
      throw error;
    }
  });
}

export async function migrateSqliteToPg(options: MigrateSqliteToPgOptions): Promise<Array<{ table: string; migrated: number }>> {
  const sqlite = new SqliteDatabase(options.sqlitePath);
  const plan = planSqliteToPgMigration(sqlite);
  if (options.dryRun) {
    sqlite.close();
    return plan.map(({ table, rowCount }) => ({ table, migrated: rowCount }));
  }

  const pg = await PgDatabase.open({ dsn: options.pgDsn });
  try {
    await pg.migrate();
    const migrated: Array<{ table: string; migrated: number }> = [];
    // Use single transaction for all tables to ensure atomicity
    await pg.transaction(async (conn) => {
      for (const { table, rowCount } of plan) {
        if (rowCount === 0) {
          migrated.push({ table, migrated: 0 });
          continue;
        }
        // Validate table name to prevent SQL injection (attacker-controlled SQLite DB)
        const validatedTable = validateTableName(table);
        const rows = sqlite.connection.prepare(`SELECT * FROM ${validatedTable}`).all() as Array<Record<string, unknown>>;
        if (rows.length === 0) {
          migrated.push({ table: validatedTable, migrated: 0 });
          continue;
        }
        // Validate column names from attacker-controlled SQLite DB to prevent SQL injection
        // Even though table name is validated, attacker-controlled column names could inject
        const columns = validateColumnNames(Object.keys(rows[0] ?? {}));
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(", ");
        const sql = `INSERT INTO ${validatedTable} (${columns.join(", ")}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`;
        let count = 0;
        for (const row of rows) {
          await conn.execute(sql, ...columns.map((column) => row[column]));
          count += 1;
        }
        migrated.push({ table: validatedTable, migrated: count });
      }
    });
    return migrated;
  } finally {
    sqlite.close();
    await pg.close();
  }
}

/**
 * Redact password from a PostgreSQL DSN connection string.
 * Handles formats like: postgres://user:pass@host:5432/db or postgresql://user:pass@host:5432/db
 */
function redactPgDsn(dsn: string): string {
  try {
    const url = new URL(dsn);
    if (url.password) {
      url.password = "****";
    }
    return url.toString();
  } catch {
    // If DSN is not a valid URL, mask any password-like pattern
    return dsn.replace(/:([^:@]+)@/, ":****@");
  }
}

async function main(): Promise<void> {
  const options = parseMigrateSqliteToPgArgs(process.argv.slice(2));
  const result = await migrateSqliteToPg(options);
  process.stdout.write(`${JSON.stringify({
    sqlite: basename(options.sqlitePath),
    pgDsn: redactPgDsn(options.pgDsn),
    dryRun: options.dryRun,
    tables: result,
  }, null, 2)}\n`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  void main();
}
