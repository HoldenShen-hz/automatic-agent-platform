/**
 * Async query helpers for PostgreSQL data access.
 *
 * These mirror the sync query-helper.ts pattern but for async operations.
 * They work with AsyncSqlConnection and return properly typed results.
 */
/**
 * Execute a query and return all rows as the target type.
 */
export async function asyncQueryAll(conn, sql, ...params) {
    const result = await conn.query(sql, ...params);
    return result.rows;
}
/**
 * Execute a query and return all rows as the target type, or an empty array
 * if the result is undefined.
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
//# sourceMappingURL=async-query-helper.js.map