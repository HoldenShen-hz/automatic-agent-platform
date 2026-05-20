/**
 * Async query helpers for PostgreSQL data access.
 *
 * These mirror the sync query-helper.ts pattern but for async operations.
 * They work with AsyncSqlConnection and return properly typed results.
 */

import type { AsyncSqlConnection, AsyncSqlDatabase } from "./async-sql-database.js";

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

/**
 * Execute a batch of statements sequentially on the same connection.
 * Useful for repository code that needs a single helper entrypoint for
 * multi-statement writes.
 */
export async function asyncExecuteBatch(
  conn: AsyncSqlConnection,
  statements: readonly { sql: string; params?: readonly unknown[] }[],
): Promise<number[]> {
  const changes: number[] = [];
  for (const statement of statements) {
    changes.push(await conn.execute(statement.sql, ...(statement.params ?? [])));
  }
  return changes;
}

/**
 * Execute a unit of work inside a database transaction while exposing the
 * transaction-scoped async connection to callers.
 */
export async function asyncWithinTransaction<T>(
  db: AsyncSqlDatabase,
  work: (conn: AsyncSqlConnection) => Promise<T>,
): Promise<T> {
  return db.transaction(work);
}
