/**
 * Async query helpers for PostgreSQL data access.
 *
 * These mirror the sync query-helper.ts pattern but for async operations.
 * They work with AsyncSqlConnection and return properly typed results.
 */

import type { AsyncSqlConnection } from "./async-sql-database.js";

/**
 * Build a tenant scope filter clause for PostgreSQL queries.
 * Returns { clause: "", args: [] } when tenantId is undefined (no filter).
 * Returns { clause: "tenant_id = $1", args: [tenantId] } when tenantId is a string.
 * Returns { clause: "tenant_id IS NULL", args: [] } when tenantId is null.
 *
 * R12-06 FIX: Fixed parameter indexing - when startingIdx is provided, the
 * parameter placeholders use that as the base index (e.g., $2, $3 if startingIdx=2).
 */
export function buildTenantClause(
  scopedTenantId: string | null | undefined,
  startingIdx = 1,
): { clause: string; args: unknown[] } {
  if (scopedTenantId === undefined) {
    return { clause: "", args: [] };
  }
  if (scopedTenantId === null) {
    return { clause: "tenant_id IS NULL", args: [] };
  }
  return { clause: `tenant_id = $${startingIdx}`, args: [scopedTenantId] };
}

/**
 * Execute a query and return all rows as the target type.
 */
export async function asyncQueryAll<T>(
  conn: AsyncSqlConnection,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const result = await conn.query<T>(sql, ...params);
  return result.rows;
}

/**
 * Execute a query and return all rows as the target type, or an empty array
 * if the result is undefined.
 */
export async function asyncQueryAllOrEmpty<T>(
  conn: AsyncSqlConnection,
  sql: string,
  ...params: unknown[]
): Promise<T[]> {
  const result = await conn.query<T>(sql, ...params);
  return result.rows;
}

/**
 * Execute a query and return a single row as the target type,
 * or undefined if no row was found.
 */
export async function asyncQueryOne<T>(
  conn: AsyncSqlConnection,
  sql: string,
  ...params: unknown[]
): Promise<T | undefined> {
  return conn.queryOne<T>(sql, ...params);
}

/**
 * Execute a statement and return the number of affected rows.
 */
export async function asyncExecute(
  conn: AsyncSqlConnection,
  sql: string,
  ...params: unknown[]
): Promise<number> {
  return conn.execute(sql, ...params);
}
