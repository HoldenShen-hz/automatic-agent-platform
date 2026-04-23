/**
 * @fileoverview SqliteAsyncAdapter - Wraps synchronous SQLite as an AsyncSqlDatabase.
 *
 * This adapter provides the async database interface for SQLite-backed code paths.
 * It wraps the synchronous AuthoritativeSqlDatabase (SQLite) methods as async.
 *
 * Note: Since SQLite is single-threaded and in-process, we can safely wrap
 * synchronous calls with Promise.resolve() for the async interface. The actual
 * transaction behavior remains synchronous — this adapter is primarily useful
 * for testing async repository code against SQLite or for dual-interface consumers.
 */
/**
 * SqliteAsyncAdapter wraps a synchronous SQLite database (AuthoritativeSqlDatabase)
 * to provide the AsyncSqlDatabase interface.
 *
 * This is useful for:
 * - Testing async repository code against SQLite without needing PostgreSQL
 * - Dual-path storage backends that need to expose both sync and async interfaces
 * - Gradual migration from sync to async patterns
 *
 * Important: The `transaction()` method implementation differs from PostgreSQL.
 * Since SQLite is single-threaded and in-process, we run the work synchronously
 * but must return a Promise. This is safe because SQLite's transaction model
 * doesn't require async I/O — the synchronous API is already thread-safe.
 */
export class SqliteAsyncAdapter {
    db;
    conn;
    constructor(db) {
        this.db = db;
        const syncConn = db.connection;
        const normalizeSql = (sql) => sql.replace(/\$\d+/g, "?");
        this.conn = {
            query: async (sql, ...params) => {
                const stmt = syncConn.prepare(normalizeSql(sql));
                const rows = stmt.all(...params);
                return { rows, rowCount: rows.length };
            },
            queryOne: async (sql, ...params) => {
                const row = syncConn.prepare(normalizeSql(sql)).get(...params);
                return row;
            },
            execute: async (sql, ...params) => {
                const result = syncConn.prepare(normalizeSql(sql)).run(...params);
                return Number(result.changes);
            },
        };
    }
    get filePath() {
        return this.db.filePath;
    }
    get asyncConnection() {
        return this.conn;
    }
    async migrate() {
        this.db.migrate();
    }
    async getSchemaStatus() {
        return this.db.getSchemaStatus();
    }
    async assertSchemaCurrent() {
        this.db.assertSchemaCurrent();
    }
    async integrityCheck() {
        return this.db.integrityCheck();
    }
    /**
     * Execute work within a database transaction.
     *
     * SQLite transactions are synchronous, so we run the work function
     * synchronously within the transaction. The async signature satisfies
     * the AsyncSqlDatabase interface while preserving SQLite's synchronous
     * execution model.
     *
     * The `conn` passed to `work` is the same SQLite connection used by
     * this adapter — it's provided for interface compatibility with the
     * AsyncSqlDatabase pattern, but PostgreSQL consumers should use a
     * transaction-scoped connection.
     *
     * Note: For SQLite, we use sync transaction with an async work function.
     * This works because the sync transaction blocks the event loop during execution,
     * allowing the async work to complete within the transaction boundary.
     */
    async transaction(work) {
        try {
            this.db.connection.exec("BEGIN IMMEDIATE");
            const result = await work(this.conn);
            this.db.connection.exec("COMMIT");
            return result;
        }
        catch (error) {
            this.db.connection.exec("ROLLBACK");
            throw error;
        }
    }
    async readTransaction(work) {
        try {
            this.db.connection.exec("BEGIN");
            const result = await work(this.conn);
            this.db.connection.exec("COMMIT");
            return result;
        }
        catch (error) {
            this.db.connection.exec("ROLLBACK");
            throw error;
        }
    }
    async close() {
        // Cast to 'unknown' then to '{ close(): void }' since AuthoritativeSqlDatabase
        // doesn't declare close() but SqliteDatabase implements it
        this.db.close();
    }
}
//# sourceMappingURL=sqlite-async-adapter.js.map