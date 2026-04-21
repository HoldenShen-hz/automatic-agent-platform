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
import type { AsyncSqlConnection, AsyncSqlDatabase } from "../async-sql-database.js";
import type { AuthoritativeSqlDatabase, SqliteSchemaStatus } from "./sqlite-database.js";
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
export declare class SqliteAsyncAdapter implements AsyncSqlDatabase {
    private readonly db;
    private readonly conn;
    constructor(db: AuthoritativeSqlDatabase);
    get filePath(): string;
    get asyncConnection(): AsyncSqlConnection;
    migrate(): Promise<void>;
    getSchemaStatus(): Promise<SqliteSchemaStatus>;
    assertSchemaCurrent(): Promise<void>;
    integrityCheck(): Promise<string[]>;
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
    transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;
    readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T>;
    close(): Promise<void>;
}
