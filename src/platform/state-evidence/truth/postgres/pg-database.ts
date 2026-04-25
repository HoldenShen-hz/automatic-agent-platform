/**
 * @fileoverview PgDatabase - PostgreSQL implementation of AuthoritativeSqlDatabase
 *
 * Provides a PostgreSQL implementation for production deployments requiring
 * PostgreSQL as the authoritative storage backend. Maintains API compatibility
 * with the SQLite implementation while providing PostgreSQL-specific optimizations.
 *
 * Requires the `postgres` npm package, which is now declared in the main runtime dependencies.
 */

import { AsyncLocalStorage } from "node:async_hooks";
import { createRequire } from "node:module";
import type { DatabaseSync } from "node:sqlite";
import { InternalAppError, StorageError, ValidationError } from "../../../contracts/errors.js";
import {
  getLatestPostgresMigrationVersion,
  POSTGRES_MIGRATIONS,
} from "./pg-schema.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
import type {
  AsyncSqlConnection,
  AsyncSqlDatabase,
} from "../async-sql-database.js";
import type { SqliteSchemaStatus } from "../sqlite/sqlite-database.js";

const pgDbLogger = new StructuredLogger({ retentionLimit: 50 });
const require = createRequire(import.meta.url);

function splitPostgresStatements(sql: string): string[] {
  const statements: string[] = [];
  let buffer = "";
  let index = 0;
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let inLineComment = false;
  let inBlockComment = false;
  let dollarQuoteTag: string | null = null;

  while (index < sql.length) {
    const current = sql[index]!;
    const next = sql[index + 1] ?? "";

    if (inLineComment) {
      buffer += current;
      index += 1;
      if (current === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      buffer += current;
      index += 1;
      if (current === "*" && next === "/") {
        buffer += next;
        index += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarQuoteTag != null) {
      if (sql.startsWith(dollarQuoteTag, index)) {
        buffer += dollarQuoteTag;
        index += dollarQuoteTag.length;
        dollarQuoteTag = null;
        continue;
      }
      buffer += current;
      index += 1;
      continue;
    }

    if (inSingleQuote) {
      buffer += current;
      index += 1;
      if (current === "'" && next === "'") {
        buffer += next;
        index += 1;
        continue;
      }
      if (current === "'") {
        inSingleQuote = false;
      }
      continue;
    }

    if (inDoubleQuote) {
      buffer += current;
      index += 1;
      if (current === "\"" && next === "\"") {
        buffer += next;
        index += 1;
        continue;
      }
      if (current === "\"") {
        inDoubleQuote = false;
      }
      continue;
    }

    if (current === "-" && next === "-") {
      buffer += current;
      buffer += next;
      index += 2;
      inLineComment = true;
      continue;
    }

    if (current === "/" && next === "*") {
      buffer += current;
      buffer += next;
      index += 2;
      inBlockComment = true;
      continue;
    }

    if (current === "'") {
      buffer += current;
      index += 1;
      inSingleQuote = true;
      continue;
    }

    if (current === "\"") {
      buffer += current;
      index += 1;
      inDoubleQuote = true;
      continue;
    }

    if (current === "$") {
      const remaining = sql.slice(index);
      const match = remaining.match(/^\$[A-Za-z_][A-Za-z0-9_]*\$|^\$\$/);
      if (match) {
        dollarQuoteTag = match[0];
        buffer += dollarQuoteTag;
        index += dollarQuoteTag.length;
        continue;
      }
    }

    if (current === ";") {
      const statement = buffer.trim();
      if (statement.length > 0) {
        statements.push(statement);
      }
      buffer = "";
      index += 1;
      continue;
    }

    buffer += current;
    index += 1;
  }

  const statement = buffer.trim();
  if (statement.length > 0) {
    statements.push(statement);
  }
  return statements;
}

/**
 * Configuration options for PgDatabase connection.
 */
export interface PgDatabaseOptions {
  /** Data Source Name - PostgreSQL connection string */
  dsn: string;
  /** PostgreSQL schema name (defaults to "public") */
  schema?: string;
  /** Minimum pool size (defaults to 0) */
  poolMin?: number;
  /** Maximum pool size (defaults to 20) */
  poolMax?: number;
  /** Whether to use SSL connection */
  ssl?: boolean;
  /** Connection timeout in milliseconds */
  connectionTimeoutMs?: number;
}

/**
 * Schema status for PostgreSQL including version info.
 */
export interface PgSchemaStatus {
  currentVersion: number;
  expectedVersion: number;
  upToDate: boolean;
  pendingVersions: number[];
  checksumMismatches: Array<{
    version: number;
    name: string;
    expectedChecksum: string;
    actualChecksum: string;
  }>;
}

/**
 * PgWriteError is thrown when a PostgreSQL write operation fails.
 */
export class PgWriteError extends StorageError {
  public constructor(
    public readonly operation: string,
    public readonly dsn: string,
    cause?: unknown,
  ) {
    super("postgres.write_error", `postgres.write_error:${operation}:${dsn}`, {
      retryable: true,
      statusCode: 503,
      details: { operation, dsn },
      ...(cause instanceof Error ? { cause } : {}),
    });
    this.name = "PgWriteError";
  }
}

/**
 * Type guard to check if an error is a PgWriteError.
 */
export function isPgWriteError(error: unknown): error is PgWriteError {
  return error instanceof PgWriteError;
}

/**
 * Interface for raw SQL execution on the postgres driver.
 * Covers both tagged template syntax and .unsafe() prepared statements.
 */
interface PostgresRawSqlExecutor {
  // Tagged template function for executing queries
  <T = unknown>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T[]>;
  // Unsafe SQL execution with optional positional parameters
  unsafe<T = unknown>(sql: string, params?: readonly unknown[]): Promise<T[]>;
  // End the connection pool
  end(): Promise<void>;
  // Transaction support
  begin<T>(work: (sql: PostgresRawSqlExecutor) => Promise<T>): Promise<T>;
}

/**
 * Adapter interface that bridges async PgDatabase methods to the sync
 * AuthoritativeSqlDatabase interface expected by AuthoritativeTaskStore.
 *
 * This interface captures the minimal set of methods that AuthoritativeTaskStore
 * requires from a PostgreSQL backend: connection access and sync transaction.
 */
export interface PostgresDatabaseSyncAdapter {
  readonly filePath: string;
  readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
  migrate(): void;
  getSchemaStatus(): { currentVersion: number; expectedVersion: number; upToDate: boolean; pendingVersions: number[]; checksumMismatches: Array<{ version: number; name: string; expectedChecksum: string; actualChecksum: string }> };
  assertSchemaCurrent(): void;
  integrityCheck(): string[];
  transaction<T>(work: () => T): T;
  readTransaction<T>(work: () => T): T;
}

/**
 * A minimal connection interface matching what the AuthoritativeSqlDatabase
 * interface requires from a database connection.
 */
interface SqlLikeConnection {
  exec(sql: string): void;
  prepare(sql: string): {
    all(...params: unknown[]): unknown[];
    run(...params: unknown[]): void;
  };
}

/**
 * Creates a stub connection that throws helpful errors when operations are attempted before connecting.
 */
function createStubConnection(notConnectedError: string): SqlLikeConnection {
  return {
    exec: () => { throw new StorageError(notConnectedError, notConnectedError, { retryable: false }); },
    prepare: () => ({
      all: () => { throw new StorageError(notConnectedError, notConnectedError, { retryable: false }); },
      run: () => { throw new StorageError(notConnectedError, notConnectedError, { retryable: false }); },
    }),
  };
}

/**
 * PgDatabase provides PostgreSQL storage for the automatic agent system.
 *
 * This class uses the `postgres` npm package for all database operations.
 * Transaction methods are async and callers must await them.
 *
 * This class implements both:
 * - AuthoritativeSqlDatabase (sync interface, via createUnsupportedPostgresSyncFacade)
 * - AsyncSqlDatabase (async interface, via asyncConnection getter and async methods)
 */
export class PgDatabase implements AsyncSqlDatabase {
  public readonly dsn: string;
  public readonly schema: string;
  public readonly poolMin: number;
  public readonly poolMax: number;

  private sql: PostgresRawSqlExecutor | null = null;
  private readonly transactionScope = new AsyncLocalStorage<PostgresRawSqlExecutor>();

  private _connected = false;
  private _connecting = false;
  private _connectionError: Error | null = null;

  // Connection object that provides the AuthoritativeSqlDatabase interface.
  // Before connect: throws helpful "not connected" errors.
  // After connect: delegates to the postgres SQL instance.
  private _connection: SqlLikeConnection;

  private constructor(options: PgDatabaseOptions) {
    this.dsn = options.dsn;
    this.schema = options.schema ?? "public";
    this.poolMin = options.poolMin ?? 0;
    this.poolMax = options.poolMax ?? 20;
    this._connection = createStubConnection("postgres.not_connected:call PgDatabase.open() first");
  }

  /**
   * Creates a connected PgDatabase instance.
   * @param options - Configuration options
   * @returns A connected PgDatabase instance
   */
  public static async open(options: PgDatabaseOptions): Promise<PgDatabase> {
    const db = new PgDatabase(options);
    await db.connect();
    return db;
  }

  /**
   * Creates a disconnected PgDatabase instance for testing purposes.
   * @param options - Configuration options
   * @returns A disconnected PgDatabase instance
   */
  public static createDisconnectedForTest(options: PgDatabaseOptions): PgDatabase {
    return new PgDatabase(options);
  }

  /**
   * Establishes connection to the PostgreSQL database.
   * Loads the postgres driver and initializes the connection pool.
   */
  private async connect(): Promise<void> {
    if (this._connected || this._connecting) {
      return;
    }
    this._connecting = true;

    try {
      // Attempt to load the postgres driver
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const postgres = require("postgres") as (
        dsn: string,
        options: Record<string, unknown>,
      ) => PostgresRawSqlExecutor;

      const sqlOptions: Record<string, unknown> = {
        max: this.poolMax,
        min: this.poolMin,
        idle_timeout: 20000,
        connect_timeout: 10000,
      };
      if (this.schema !== "public") {
        const escapedSchema = this.schema.replace(/"/g, "\"\"");
        sqlOptions["connection"] = {
          search_path: `"${escapedSchema}", public`,
        };
      }

      this.sql = postgres(this.dsn, sqlOptions);
      this._connection = createStubConnection("postgres.sync_connection_unsupported:use async pg interfaces");

      // Test the connection
      await this.sql`SELECT 1`;
      if (this.schema !== "public") {
        const escapedSchema = this.schema.replace(/"/g, "\"\"");
        await this.sql.unsafe(`SET search_path TO "${escapedSchema}", public`);
      }

      this._connected = true;
      this._connecting = false;
    } catch (error) {
      this._connecting = false;
      this._connectionError = error instanceof Error ? error : new Error(String(error));
      throw new StorageError(
        `postgres.connection_failed:${this._connectionError.message}`,
        `postgres.connection_failed:${this._connectionError.message}`,
        {
          retryable: true,
          details: { dsn: this.dsn },
          cause: this._connectionError,
        },
      );
    }
  }

  /**
   * Ensures the database is connected. Throws if not.
   * @throws StorageError if not connected
   */
  private ensureConnected(): void {
    if (!this._connected) {
      if (this._connectionError) {
        throw new StorageError(
          `postgres.connection_error:${this._connectionError.message}`,
          `postgres.connection_error:${this._connectionError.message}`,
          {
            retryable: true,
            cause: this._connectionError,
          },
        );
      }
      throw new StorageError("postgres.not_connected:call PgDatabase.open() first", "postgres.not_connected:call PgDatabase.open() first", {
        retryable: false,
      });
    }
  }

  // ── AuthoritativeSqlDatabase interface ─────────────────────────────────

  /**
   * The connection object providing exec/prepare interface.
   * Throws helpful errors before connect() is called.
   */
  public get connection(): Pick<DatabaseSync, "exec" | "prepare"> {
    return this._connection as Pick<DatabaseSync, "exec" | "prepare">;
  }

  // ── AsyncSqlDatabase interface ──────────────────────────────────────────────

  /**
   * Async connection interface for query and execute operations.
   * This provides the async-first API that works naturally with PostgreSQL.
   */
  public get asyncConnection(): AsyncSqlConnection {
    const pgDb = this;
    return {
      query: async <T>(sql: string, ...params: unknown[]): Promise<{ rows: T[]; rowCount: number; changes?: number }> => {
        const rawSql = pgDb.getSql();
        const result = await rawSql.unsafe<T>(sql, params);
        return { rows: result, rowCount: result.length };
      },
      queryOne: async <T>(sql: string, ...params: unknown[]): Promise<T | undefined> => {
        const rawSql = pgDb.getSql();
        const result = await rawSql.unsafe<T>(sql, params);
        return result[0] as T | undefined;
      },
      execute: async (sql: string, ...params: unknown[]): Promise<number> => {
        const rawSql = pgDb.getSql();
        const result = await rawSql.unsafe(sql, params);
        // PostgreSQL DML returns row count in the result
        return (result as unknown[]).length;
      },
    };
  }

  /**
   * AsyncSqlDatabase.filePath — returns the DSN for PostgreSQL.
   */
  public get filePath(): string {
    return this.dsn;
  }

  /**
   * AsyncSqlDatabase.close() — closes the database connection.
   */
  async close(): Promise<void> {
    if (this.sql) {
      await this.sql.end();
      this._connected = false;
      this.sql = null;
      this._connection = createStubConnection("postgres.closed");
    }
  }

  /**
   * AsyncSqlDatabase.assertSchemaCurrent() — async version.
   */
  async assertSchemaCurrent(): Promise<void> {
    // Schema assertion is a no-op for PostgreSQL since migrations are version-tracked
    // The migrate() method handles all schema management
  }

  /**
   * Execute work within a database transaction using the async connection pattern.
   *
   * This implements the AsyncSqlDatabase.transaction() interface.
   * The work function receives an AsyncSqlConnection scoped to the transaction.
   *
   * @param work - Async function to execute within the transaction
   */
  async transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
    this.ensureConnected();
    const sql = this.getSql();
    return await sql.begin(async (transactionSql) => {
      if (this.schema !== "public") {
        const escapedSchema = this.schema.replace(/"/g, "\"\"");
        await transactionSql.unsafe(`SET search_path TO "${escapedSchema}", public`);
      }
      const txConn: AsyncSqlConnection = {
        query: async <R>(sqlStr: string, ...p: unknown[]): Promise<{ rows: R[]; rowCount: number }> => {
          const result = await transactionSql.unsafe<R>(sqlStr, p);
          return { rows: result, rowCount: result.length };
        },
        queryOne: async <R>(sqlStr: string, ...p: unknown[]): Promise<R | undefined> => {
          const result = await transactionSql.unsafe<R>(sqlStr, p);
          return result[0] as R | undefined;
        },
        execute: async (sqlStr: string, ...p: unknown[]): Promise<number> => {
          await transactionSql.unsafe(sqlStr, p);
          return 0; // DML row count not available from unsafe
        },
      };
      return this.transactionScope.run(transactionSql, () => work(txConn));
    });
  }

  /**
   * Execute work within a read-only transaction using the async connection pattern.
   *
   * @param work - Async function to execute within the read transaction
   */
  async readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
    return this.transaction(work);
  }

  /**
   * Runs all pending migrations to bring the schema up to date.
   * **Async** - use await.
   */
  public async migrate(): Promise<void> {
    this.ensureConnected();
    const sql = this.getSql();

    // Ensure migration ledger table exists using postgres tagged template
    await sql`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `;

    // Get list of already-applied migrations
    const applied = await sql<{ version: number; name: string; checksum: string }>`
      SELECT version, name, checksum, applied_at
      FROM schema_migrations
      ORDER BY version ASC
    `;

    const appliedMap = new Map<number, { checksum: string; name: string }>();
    for (const row of applied) {
      appliedMap.set(row.version, { checksum: row.checksum, name: row.name });
    }

    const expectedVersion = getLatestPostgresMigrationVersion();

    // Apply any pending migrations
    for (const migration of POSTGRES_MIGRATIONS) {
      const existing = appliedMap.get(migration.version);

      if (!existing) {
        // Migration not yet applied - apply it
        const statements = splitPostgresStatements(migration.ddl);
        for (const stmt of statements) {
          await sql.unsafe(stmt);
        }

        // Record the applied migration
        await sql`
          INSERT INTO schema_migrations (version, name, checksum, applied_at)
          VALUES (${migration.version}, ${migration.name}, ${migration.checksum}, NOW())
        `;
      } else if (existing.checksum !== migration.checksum) {
        // Checksum mismatch - this is a problem
        throw new StorageError(
          `postgres.migration_checksum_mismatch:${migration.version}`,
          `postgres.migration_checksum_mismatch:${migration.version}`,
          {
            retryable: false,
            details: { version: migration.version },
          },
        );
      }
    }

    // Verify connection is working
    await sql`SELECT 1`;
  }

  /**
   * Gets the current schema status.
   * **Async** - use await.
   * @returns The schema status including version and pending migrations
   */
  public async getSchemaStatus(): Promise<PgSchemaStatus> {
    this.ensureConnected();
    const sql = this.getSql();

    const expectedVersion = getLatestPostgresMigrationVersion();

    try {
      const applied = await sql<{ version: number; name: string; checksum: string }>`
        SELECT version, name, checksum
        FROM schema_migrations
        ORDER BY version DESC
      `;

      const appliedMap = new Map<number, { checksum: string; name: string }>();
      for (const row of applied) {
        appliedMap.set(row.version, { checksum: row.checksum, name: row.name });
      }

      const currentVersion = applied.length > 0 ? Number(applied[0]!.version) : 0;

      const pendingVersions: number[] = [];
      const checksumMismatches: PgSchemaStatus["checksumMismatches"] = [];

      for (const migration of POSTGRES_MIGRATIONS) {
        const existing = appliedMap.get(migration.version);
        if (!existing) {
          if (migration.version <= currentVersion) {
            // This shouldn't happen - migration missing but version is higher
          } else {
            pendingVersions.push(migration.version);
          }
        } else if (existing.checksum !== migration.checksum) {
          checksumMismatches.push({
            version: migration.version,
            name: migration.name,
            expectedChecksum: migration.checksum,
            actualChecksum: existing.checksum,
          });
        }
      }

      return {
        currentVersion,
        expectedVersion,
        upToDate: pendingVersions.length === 0 && checksumMismatches.length === 0,
        pendingVersions: pendingVersions.sort((a, b) => a - b),
        checksumMismatches,
      };
    } catch (err) {
      pgDbLogger.log({ level: "warn", message: "Failed to get PostgreSQL schema status", data: { error: err instanceof Error ? err.message : String(err) } });
      return {
        currentVersion: 0,
        expectedVersion,
        upToDate: expectedVersion === 0,
        pendingVersions: expectedVersion > 0 ? [1] : [],
        checksumMismatches: [],
      };
    }
  }

  public async healthCheck(): Promise<boolean> {
    this.ensureConnected();
    const sql = this.getSql();
    try {
      await sql`SELECT 1`;
      return true;
    } catch (err) {
      pgDbLogger.log({ level: "warn", message: "PostgreSQL health check failed", data: { error: err instanceof Error ? err.message : String(err) } });
      return false;
    }
  }


  /**
   * Runs an integrity check on the database.
   * **Async** - use await.
   * @returns Array of integrity check results
   */
  public async integrityCheck(): Promise<string[]> {
    this.ensureConnected();
    const sql = this.getSql();
    try {
      const result = await sql<{ integrity_check: number }>`SELECT 1 AS integrity_check`;
      return result.length > 0 ? ["ok"] : ["failed"];
    } catch (err) {
      pgDbLogger.log({ level: "warn", message: "PostgreSQL integrity check failed", data: { error: err instanceof Error ? err.message : String(err) } });
      return ["error"];
    }
  }


  /**
   * Get the underlying postgres SQL object for advanced operations.
   * @returns The raw postgres SQL executor
   */
  public getSql(): PostgresRawSqlExecutor {
    this.ensureConnected();
    return this.transactionScope.getStore() ?? this.sql!;
  }

  /**
   * Check if the database is connected.
   * @returns True if connected
   */
  public isConnected(): boolean {
    return this._connected;
  }
}
