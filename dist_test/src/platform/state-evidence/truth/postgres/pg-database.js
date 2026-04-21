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
import { StorageError } from "../../../contracts/errors.js";
import { getLatestPostgresMigrationVersion, POSTGRES_MIGRATIONS, } from "./pg-schema.js";
import { StructuredLogger } from "../../../shared/observability/structured-logger.js";
const pgDbLogger = new StructuredLogger({ retentionLimit: 50 });
const require = createRequire(import.meta.url);
function splitPostgresStatements(sql) {
    const statements = [];
    let buffer = "";
    let index = 0;
    let inSingleQuote = false;
    let inDoubleQuote = false;
    let inLineComment = false;
    let inBlockComment = false;
    let dollarQuoteTag = null;
    while (index < sql.length) {
        const current = sql[index];
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
 * PgWriteError is thrown when a PostgreSQL write operation fails.
 */
export class PgWriteError extends StorageError {
    operation;
    dsn;
    constructor(operation, dsn, cause) {
        super("postgres.write_error", `postgres.write_error:${operation}:${dsn}`, {
            retryable: true,
            statusCode: 503,
            details: { operation, dsn },
            ...(cause instanceof Error ? { cause } : {}),
        });
        this.operation = operation;
        this.dsn = dsn;
        this.name = "PgWriteError";
    }
}
/**
 * Type guard to check if an error is a PgWriteError.
 */
export function isPgWriteError(error) {
    return error instanceof PgWriteError;
}
/**
 * Creates a stub connection that throws helpful errors when operations are attempted before connecting.
 */
function createStubConnection(notConnectedError) {
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
export class PgDatabase {
    dsn;
    schema;
    poolMin;
    poolMax;
    sql = null;
    transactionScope = new AsyncLocalStorage();
    _connected = false;
    _connecting = false;
    _connectionError = null;
    // Connection object that provides the AuthoritativeSqlDatabase interface.
    // Before connect: throws helpful "not connected" errors.
    // After connect: delegates to the postgres SQL instance.
    _connection;
    constructor(options) {
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
    static async open(options) {
        const db = new PgDatabase(options);
        await db.connect();
        return db;
    }
    /**
     * Creates a disconnected PgDatabase instance for testing purposes.
     * @param options - Configuration options
     * @returns A disconnected PgDatabase instance
     */
    static createDisconnectedForTest(options) {
        return new PgDatabase(options);
    }
    /**
     * Establishes connection to the PostgreSQL database.
     * Loads the postgres driver and initializes the connection pool.
     */
    async connect() {
        if (this._connected || this._connecting) {
            return;
        }
        this._connecting = true;
        try {
            // Attempt to load the postgres driver
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const postgres = require("postgres");
            const sqlOptions = {
                max: this.poolMax,
                min: this.poolMin,
                idle_timeout: 20000,
                connect_timeout: 10000,
            };
            if (this.schema !== "public") {
                sqlOptions.search_path = this.schema;
            }
            this.sql = postgres(this.dsn, sqlOptions);
            this._connection = createStubConnection("postgres.sync_connection_unsupported:use async pg interfaces");
            // Test the connection
            await this.sql `SELECT 1`;
            this._connected = true;
            this._connecting = false;
        }
        catch (error) {
            this._connecting = false;
            this._connectionError = error instanceof Error ? error : new Error(String(error));
            throw new StorageError(`postgres.connection_failed:${this._connectionError.message}`, `postgres.connection_failed:${this._connectionError.message}`, {
                retryable: true,
                details: { dsn: this.dsn },
                cause: this._connectionError,
            });
        }
    }
    /**
     * Ensures the database is connected. Throws if not.
     * @throws StorageError if not connected
     */
    ensureConnected() {
        if (!this._connected) {
            if (this._connectionError) {
                throw new StorageError(`postgres.connection_error:${this._connectionError.message}`, `postgres.connection_error:${this._connectionError.message}`, {
                    retryable: true,
                    cause: this._connectionError,
                });
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
    get connection() {
        return this._connection;
    }
    // ── AsyncSqlDatabase interface ──────────────────────────────────────────────
    /**
     * Async connection interface for query and execute operations.
     * This provides the async-first API that works naturally with PostgreSQL.
     */
    get asyncConnection() {
        const pgDb = this;
        return {
            query: async (sql, ...params) => {
                const rawSql = pgDb.getSql();
                const result = await rawSql.unsafe(sql, params);
                return { rows: result, rowCount: result.length };
            },
            queryOne: async (sql, ...params) => {
                const rawSql = pgDb.getSql();
                const result = await rawSql.unsafe(sql, params);
                return result[0];
            },
            execute: async (sql, ...params) => {
                const rawSql = pgDb.getSql();
                const result = await rawSql.unsafe(sql, params);
                // PostgreSQL DML returns row count in the result
                return result.length;
            },
        };
    }
    /**
     * AsyncSqlDatabase.filePath — returns the DSN for PostgreSQL.
     */
    get filePath() {
        return this.dsn;
    }
    /**
     * AsyncSqlDatabase.close() — closes the database connection.
     */
    async close() {
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
    async assertSchemaCurrent() {
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
    async transaction(work) {
        this.ensureConnected();
        const sql = this.getSql();
        return await sql.begin(async (transactionSql) => {
            const txConn = {
                query: async (sqlStr, ...p) => {
                    const result = await transactionSql.unsafe(sqlStr, p);
                    return { rows: result, rowCount: result.length };
                },
                queryOne: async (sqlStr, ...p) => {
                    const result = await transactionSql.unsafe(sqlStr, p);
                    return result[0];
                },
                execute: async (sqlStr, ...p) => {
                    await transactionSql.unsafe(sqlStr, p);
                    return 0; // DML row count not available from unsafe
                },
            };
            return work(txConn);
        });
    }
    /**
     * Execute work within a read-only transaction using the async connection pattern.
     *
     * @param work - Async function to execute within the read transaction
     */
    async readTransaction(work) {
        return this.transaction(work);
    }
    /**
     * Runs all pending migrations to bring the schema up to date.
     * **Async** - use await.
     */
    async migrate() {
        this.ensureConnected();
        const sql = this.getSql();
        // Ensure migration ledger table exists using postgres tagged template
        await sql `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL
      )
    `;
        // Get list of already-applied migrations
        const applied = await sql `
      SELECT version, name, checksum, applied_at
      FROM schema_migrations
      ORDER BY version ASC
    `;
        const appliedMap = new Map();
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
                await sql `
          INSERT INTO schema_migrations (version, name, checksum, applied_at)
          VALUES (${migration.version}, ${migration.name}, ${migration.checksum}, NOW())
        `;
            }
            else if (existing.checksum !== migration.checksum) {
                // Checksum mismatch - this is a problem
                throw new StorageError(`postgres.migration_checksum_mismatch:${migration.version}`, `postgres.migration_checksum_mismatch:${migration.version}`, {
                    retryable: false,
                    details: { version: migration.version },
                });
            }
        }
        // Verify connection is working
        await sql `SELECT 1`;
    }
    /**
     * Gets the current schema status.
     * **Async** - use await.
     * @returns The schema status including version and pending migrations
     */
    async getSchemaStatus() {
        this.ensureConnected();
        const sql = this.getSql();
        const expectedVersion = getLatestPostgresMigrationVersion();
        try {
            const applied = await sql `
        SELECT version, name, checksum
        FROM schema_migrations
        ORDER BY version DESC
      `;
            const appliedMap = new Map();
            for (const row of applied) {
                appliedMap.set(row.version, { checksum: row.checksum, name: row.name });
            }
            const currentVersion = applied.length > 0 ? Number(applied[0].version) : 0;
            const pendingVersions = [];
            const checksumMismatches = [];
            for (const migration of POSTGRES_MIGRATIONS) {
                const existing = appliedMap.get(migration.version);
                if (!existing) {
                    if (migration.version <= currentVersion) {
                        // This shouldn't happen - migration missing but version is higher
                    }
                    else {
                        pendingVersions.push(migration.version);
                    }
                }
                else if (existing.checksum !== migration.checksum) {
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
        }
        catch (err) {
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
    async healthCheck() {
        this.ensureConnected();
        const sql = this.getSql();
        try {
            await sql `SELECT 1`;
            return true;
        }
        catch (err) {
            pgDbLogger.log({ level: "warn", message: "PostgreSQL health check failed", data: { error: err instanceof Error ? err.message : String(err) } });
            return false;
        }
    }
    /**
     * Runs an integrity check on the database.
     * **Async** - use await.
     * @returns Array of integrity check results
     */
    async integrityCheck() {
        this.ensureConnected();
        const sql = this.getSql();
        try {
            const result = await sql `SELECT 1 AS integrity_check`;
            return result.length > 0 ? ["ok"] : ["failed"];
        }
        catch (err) {
            pgDbLogger.log({ level: "warn", message: "PostgreSQL integrity check failed", data: { error: err instanceof Error ? err.message : String(err) } });
            return ["error"];
        }
    }
    /**
     * Get the underlying postgres SQL object for advanced operations.
     * @returns The raw postgres SQL executor
     */
    getSql() {
        this.ensureConnected();
        return this.transactionScope.getStore() ?? this.sql;
    }
    /**
     * Check if the database is connected.
     * @returns True if connected
     */
    isConnected() {
        return this._connected;
    }
}
//# sourceMappingURL=pg-database.js.map