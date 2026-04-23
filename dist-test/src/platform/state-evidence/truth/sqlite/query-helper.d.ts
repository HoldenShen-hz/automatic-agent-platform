/**
 * Type-safe query helpers for SQLite data access.
 *
 * This module centralizes all `as unknown as T` type casts that arise because
 * better-sqlite3's query methods return `unknown`.  By funneling all casts through
 * these helpers we:
 *   1. Reduce the 100+ `as unknown as` occurrences in AuthoritativeTaskStore to a handful.
 *   2. Provide a single place to add Zod runtime validation if desired later.
 *   3. Make type-safety auditable via a single grep.
 */
import type { DatabaseSync, SQLInputValue } from "node:sqlite";
/** SQLite connection type compatible with AuthoritativeSqlDatabase.connection */
export type SqliteConnection = Pick<DatabaseSync, "exec" | "prepare">;
/**
 * Execute a statement and return all rows as the target type.
 * Casts `unknown[]` (better-sqlite3 row arrays) through `unknown` to T.
 */
export declare function queryAll<T>(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): T[];
/**
 * Execute a statement and return all rows as the target type, or an empty array
 * if the result is undefined (handles edge cases where .all() returns undefined).
 */
export declare function queryAllOrEmpty<T>(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): T[];
/**
 * Execute a statement and return a single row as the target type,
 * or undefined if no row was found.
 */
export declare function queryOne<T>(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): T | undefined;
/**
 * Execute a statement and return a single row as the target type,
 * or throw if no row was found (for queries that must succeed).
 */
export declare function queryOneOrThrow<T>(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): T;
/**
 * Execute an insert/update/delete statement that doesn't return rows.
 * Returns the sqlite changes count.
 */
export declare function execute(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): number;
/**
 * Execute an insert statement and return the last inserted row id.
 */
export declare function insertAndGetLastId(conn: SqliteConnection, sql: string, ...params: SQLInputValue[]): number;
