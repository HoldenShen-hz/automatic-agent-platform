/**
 * Type-safe query helpers for SQLite data access.
 *
 * This module centralizes the remaining SQLite row type assertions that arise because
 * better-sqlite3's query methods return `unknown`.  By funneling all casts through
 * these helpers we:
 *   1. Reduce ad-hoc row assertions in AuthoritativeTaskStore to a handful.
 *   2. Provide a single place to add Zod runtime validation if desired later.
 *   3. Make type-safety auditable via a single grep.
 */

import type { DatabaseSync, SQLInputValue } from "node:sqlite";

import { StorageError } from "../../../contracts/errors.js";

/** SQLite connection type compatible with AuthoritativeSqlDatabase.connection */
export type SqliteConnection = Pick<DatabaseSync, "exec" | "prepare">;

/**
 * Execute a statement and return all rows as the target type.
 * Casts SQLite row arrays to the requested result type.
 */
export function queryAll<T>(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): T[] {
  return conn.prepare(sql).all(...params) as T[];
}

/**
 * Execute a statement and return all rows as the target type, or an empty array
 * if the result is undefined (handles edge cases where .all() returns undefined).
 */
export function queryAllOrEmpty<T>(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): T[] {
  const result = conn.prepare(sql).all(...params);
  return (result ?? []) as T[];
}

/**
 * Execute a statement and return a single row as the target type,
 * or undefined if no row was found.
 */
export function queryOne<T>(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): T | undefined {
  return conn.prepare(sql).get(...params) as T | undefined;
}

/**
 * Execute a statement and return a single row as the target type,
 * or throw if no row was found (for queries that must succeed).
 */
export function queryOneOrThrow<T>(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): T {
  const result = conn.prepare(sql).get(...params);
  if (result === undefined) {
    throw new StorageError(
      "storage.query_no_rows",
      `queryOneOrThrow: no row returned for SQL: ${sql.slice(0, 80)}`,
      {
        retryable: false,
        details: {
          sqlPreview: sql.slice(0, 160),
          parameterCount: params.length,
        },
      },
    );
  }
  return result as T;
}

/**
 * Execute an insert/update/delete statement that doesn't return rows.
 * Returns the sqlite changes count.
 */
export function execute(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): number {
  return Number(conn.prepare(sql).run(...params).changes);
}

/**
 * Execute an insert statement and return the last inserted row id.
 */
export function insertAndGetLastId(
  conn: SqliteConnection,
  sql: string,
  ...params: SQLInputValue[]
): number {
  return Number(conn.prepare(sql).run(...params).lastInsertRowid);
}
