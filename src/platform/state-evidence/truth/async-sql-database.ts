/**
 * @fileoverview AsyncSqlDatabase interface and types for async-first database operations.
 *
 * This module defines the async database interface that bridges the gap between
 * synchronous SQLite (via node:sqlite) and asynchronous PostgreSQL (via postgres driver).
 *
 * The AuthoritativeSqlDatabase interface requires synchronous methods (transaction, execute),
 * but PostgreSQL's `postgres` driver is inherently asynchronous. This interface provides
 * an async-first approach that works naturally with PostgreSQL while a SqliteAsyncAdapter
 * provides compatibility for SQLite-backed code paths.
 */

import type { SqliteSchemaStatus } from "./sqlite/sqlite-database.js";

// ── Query Result Types ────────────────────────────────────────────────────────

/**
 * Result of an async query execution.
 */
export interface AsyncQueryResult<T = unknown> {
  rows: T[];
  rowCount: number;
  changes?: number;
}

// ── Async Connection Interface ─────────────────────────────────────────────────

/**
 * Async SQL connection interface providing query and execute methods.
 *
 * This abstracts away the differences between:
 * - SQLite: sync `conn.prepare(sql).all()/get()/run()` via DatabaseSync
 * - PostgreSQL: async `pool.query(sql, params)` via postgres driver
 *
 * Key design: The connection is passed to transaction callbacks so that
 * PostgreSQL consumers can hold the same connection for the transaction
 * duration, ensuring proper isolation.
 */
export interface AsyncSqlConnection {
  /**
   * Execute a query and return all rows.
   * @param sql - SQL query string
   * @param params - Query parameters (positional for PG, $N for SQLite via adapter)
   */
  query<T = unknown>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>>;

  /**
   * Execute a query and return a single row, or undefined if not found.
   * @param sql - SQL query string
   * @param params - Query parameters
   */
  queryOne<T = unknown>(sql: string, ...params: unknown[]): Promise<T | undefined>;

  /**
   * Execute a statement (INSERT, UPDATE, DELETE) and return the number of affected rows.
   * @param sql - SQL statement
   * @param params - Statement parameters
   */
  execute(sql: string, ...params: unknown[]): Promise<number>;
}

// ── Async Database Interface ───────────────────────────────────────────────────

/**
 * Async database interface for database operations.
 *
 * This interface is async-first and works naturally with PostgreSQL.
 * For SQLite, use SqliteAsyncAdapter to wrap the synchronous AuthoritativeSqlDatabase.
 *
 * Key design decisions:
 * - `transaction()` receives a connection-scoped parameter so PostgreSQL consumers
 *   can hold the same connection for the transaction duration
 * - All methods return `Promise<T>` — natural fit for both PG and Node.js async patterns
 * - The interface is backend-agnostic and can be implemented by any SQL database
 */
export interface AsyncSqlDatabase {
  /** Path or connection string for this database */
  readonly filePath: string;

  /** The async connection for query/execute operations */
  readonly asyncConnection: AsyncSqlConnection;

  /**
   * Run all pending migrations to bring the schema up to date.
   */
  migrate(): Promise<void>;

  /**
   * Get the current schema status including version and pending migrations.
   */
  getSchemaStatus(): Promise<SqliteSchemaStatus>;

  /**
   * Assert that the schema is at the current version.
   * @throws StorageError if schema is outdated or has checksum mismatches
   */
  assertSchemaCurrent(): Promise<void>;

  /**
   * Run an integrity check on the database.
   * @returns Array of integrity check results
   */
  integrityCheck(): Promise<string[]>;

  /**
   * Execute work within a database transaction.
   *
   * The work function receives an AsyncSqlConnection that uses the same
   * transaction-scoped connection, ensuring proper PostgreSQL transaction
   * isolation.
   *
   * @param work - Async function to execute within the transaction
   */
  transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;

  /**
   * Execute work within a read-only transaction.
   *
   * @param work - Async function to execute within the read transaction
   */
  readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;

  /**
   * Close the database connection.
   */
  close(): Promise<void>;
}

// ── Async Query Helpers ───────────────────────────────────────────────────────

/**
 * Execute a query and return all rows as the target type.
 * Casts `unknown[]` through `unknown` to T.
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
 * Execute a query and return all rows, or an empty array if result is undefined.
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
