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

import { AsyncLocalStorage } from "node:async_hooks";
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
  private readonly transactionContext = new AsyncLocalStorage<{ inTransaction: true }>();
  private executionTail: Promise<void> = Promise.resolve();

  constructor(private readonly db: AuthoritativeSqlDatabase) {
    const syncConn = db.connection;
    const normalizeSql = (sql: string): string => sql.replace(/\$\d+/g, "?");
    const executeSyncQuery = <T>(sql: string, ...params: unknown[]): { rows: T[]; rowCount: number } => {
      const stmt = syncConn.prepare(normalizeSql(sql));
      const rows = stmt.all(...(params as SQLInputValue[])) as T[];
      return { rows, rowCount: rows.length };
    };
    const executeSyncQueryOne = <T>(sql: string, ...params: unknown[]): T | undefined =>
      syncConn.prepare(normalizeSql(sql)).get(...(params as SQLInputValue[])) as T | undefined;
    const executeSyncStatement = (sql: string, ...params: unknown[]): number => {
      const result = syncConn.prepare(normalizeSql(sql)).run(...(params as SQLInputValue[]));
      return Number(result.changes);
    };
    const runSerialized = <T>(work: () => T): Promise<T> => this.enqueue(async () => work());
    this.conn = {
      query: async <T>(sql: string, ...params: unknown[]): Promise<{ rows: T[]; rowCount: number }> =>
        this.inTransaction()
          ? executeSyncQuery<T>(sql, ...params)
          : runSerialized(() => executeSyncQuery<T>(sql, ...params)),
      queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | undefined> =>
        this.inTransaction()
          ? executeSyncQueryOne<T>(sql, ...params)
          : runSerialized(() => executeSyncQueryOne<T>(sql, ...params)),
      execute: async (sql: string, ...params: unknown[]): Promise<number> =>
        this.inTransaction()
          ? executeSyncStatement(sql, ...params)
          : runSerialized(() => executeSyncStatement(sql, ...params)),
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
    return this.enqueue(async () => {
      try {
        this.db.connection.exec("BEGIN IMMEDIATE");
        const result = await this.transactionContext.run({ inTransaction: true }, () => work(this.conn));
        this.db.connection.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.connection.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
    return this.enqueue(async () => {
      try {
        this.db.connection.exec("BEGIN");
        const result = await this.transactionContext.run({ inTransaction: true }, () => work(this.conn));
        this.db.connection.exec("COMMIT");
        return result;
      } catch (error) {
        this.db.connection.exec("ROLLBACK");
        throw error;
      }
    });
  }

  async close(): Promise<void> {
    this.db.close();
  }

  private inTransaction(): boolean {
    return this.transactionContext.getStore()?.inTransaction === true;
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.executionTail.then(work, work);
    this.executionTail = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }
}
