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
// ── Async Query Helpers ───────────────────────────────────────────────────────
/**
 * Execute a query and return all rows as the target type.
 * Casts `unknown[]` through `unknown` to T.
 */
export async function asyncQueryAll(conn, sql, ...params) {
    const result = await conn.query(sql, ...params);
    return result.rows;
}
/**
 * Execute a query and return all rows, or an empty array if result is undefined.
 */
export async function asyncQueryAllOrEmpty(conn, sql, ...params) {
    const result = await conn.query(sql, ...params);
    return result.rows;
}
/**
 * Execute a query and return a single row as the target type,
 * or undefined if no row was found.
 */
export async function asyncQueryOne(conn, sql, ...params) {
    return conn.queryOne(sql, ...params);
}
/**
 * Execute a statement and return the number of affected rows.
 */
export async function asyncExecute(conn, sql, ...params) {
    return conn.execute(sql, ...params);
}
//# sourceMappingURL=async-sql-database.js.map