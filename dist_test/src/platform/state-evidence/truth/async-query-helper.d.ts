/**
 * Async query helpers for PostgreSQL data access.
 *
 * These mirror the sync query-helper.ts pattern but for async operations.
 * They work with AsyncSqlConnection and return properly typed results.
 */
import type { AsyncSqlConnection } from "./async-sql-database.js";
/**
 * Execute a query and return all rows as the target type.
 */
export declare function asyncQueryAll<T>(conn: AsyncSqlConnection, sql: string, ...params: unknown[]): Promise<T[]>;
/**
 * Execute a query and return all rows as the target type, or an empty array
 * if the result is undefined.
 */
export declare function asyncQueryAllOrEmpty<T>(conn: AsyncSqlConnection, sql: string, ...params: unknown[]): Promise<T[]>;
/**
 * Execute a query and return a single row as the target type,
 * or undefined if no row was found.
 */
export declare function asyncQueryOne<T>(conn: AsyncSqlConnection, sql: string, ...params: unknown[]): Promise<T | undefined>;
/**
 * Execute a statement and return the number of affected rows.
 */
export declare function asyncExecute(conn: AsyncSqlConnection, sql: string, ...params: unknown[]): Promise<number>;
