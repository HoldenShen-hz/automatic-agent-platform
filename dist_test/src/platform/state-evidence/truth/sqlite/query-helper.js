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
import { StorageError } from "../../../contracts/errors.js";
/**
 * Execute a statement and return all rows as the target type.
 * Casts `unknown[]` (better-sqlite3 row arrays) through `unknown` to T.
 */
export function queryAll(conn, sql, ...params) {
    return conn.prepare(sql).all(...params);
}
/**
 * Execute a statement and return all rows as the target type, or an empty array
 * if the result is undefined (handles edge cases where .all() returns undefined).
 */
export function queryAllOrEmpty(conn, sql, ...params) {
    const result = conn.prepare(sql).all(...params);
    return (result ?? []);
}
/**
 * Execute a statement and return a single row as the target type,
 * or undefined if no row was found.
 */
export function queryOne(conn, sql, ...params) {
    return conn.prepare(sql).get(...params);
}
/**
 * Execute a statement and return a single row as the target type,
 * or throw if no row was found (for queries that must succeed).
 */
export function queryOneOrThrow(conn, sql, ...params) {
    const result = conn.prepare(sql).get(...params);
    if (result === undefined) {
        throw new StorageError("storage.query_no_rows", `queryOneOrThrow: no row returned for SQL: ${sql.slice(0, 80)}`, {
            retryable: false,
            details: {
                sqlPreview: sql.slice(0, 160),
                parameterCount: params.length,
            },
        });
    }
    return result;
}
/**
 * Execute an insert/update/delete statement that doesn't return rows.
 * Returns the sqlite changes count.
 */
export function execute(conn, sql, ...params) {
    return Number(conn.prepare(sql).run(...params).changes);
}
/**
 * Execute an insert statement and return the last inserted row id.
 */
export function insertAndGetLastId(conn, sql, ...params) {
    return Number(conn.prepare(sql).run(...params).lastInsertRowid);
}
//# sourceMappingURL=query-helper.js.map