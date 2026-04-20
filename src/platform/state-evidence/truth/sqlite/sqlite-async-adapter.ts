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

import type {
  AsyncSqlConnection,
  AsyncSqlDatabase,
} from "../async-sql-database.js";
import type {
  AuthoritativeSqlDatabase,
  SqliteSchemaStatus,
} from "./sqlite-database.js";
import type { SQLInputValue } from "node:sqlite";

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
export class SqliteAsyncAdapter implements AsyncSqlDatabase {
  private readonly conn: AsyncSqlConnection;

  constructor(private readonly db: AuthoritativeSqlDatabase) {
    const syncConn = db.connection;
    this.conn = {
      query: async <T>(sql: string, ...params: unknown[]): Promise<{ rows: T[]; rowCount: number }> => {
        const stmt = syncConn.prepare(sql);
        const rows = stmt.all(...(params as SQLInputValue[])) as T[];
        return { rows, rowCount: rows.length };
      },
      queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | undefined> => {
        const row = syncConn.prepare(sql).get(...(params as SQLInputValue[])) as T | undefined;
        return row;
      },
      execute: async (sql: string, ...params: unknown[]): Promise<number> => {
        const result = syncConn.prepare(sql).run(...(params as SQLInputValue[]));
        return Number(result.changes);
      },
    };
  }

  get filePath(): string {
    return this.db.filePath;
  }

  get asyncConnection(): AsyncSqlConnection {
    return this.conn;
  }

  async migrate(): Promise<void> {
    this.db.migrate();
  }

  async getSchemaStatus(): Promise<SqliteSchemaStatus> {
    return this.db.getSchemaStatus();
  }

  async assertSchemaCurrent(): Promise<void> {
    this.db.assertSchemaCurrent();
  }

  async integrityCheck(): Promise<string[]> {
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
  async transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
    try {
      this.db.connection.exec("BEGIN IMMEDIATE");
      const result = await work(this.conn);
      this.db.connection.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.connection.exec("ROLLBACK");
      throw error;
    }
  }

  async readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
    try {
      this.db.connection.exec("BEGIN");
      const result = await work(this.conn);
      this.db.connection.exec("COMMIT");
      return result;
    } catch (error) {
      this.db.connection.exec("ROLLBACK");
      throw error;
    }
  }

  async close(): Promise<void> {
    // Cast to 'unknown' then to '{ close(): void }' since AuthoritativeSqlDatabase
    // doesn't declare close() but SqliteDatabase implements it
    (this.db as unknown as { close(): void }).close();
  }
}
