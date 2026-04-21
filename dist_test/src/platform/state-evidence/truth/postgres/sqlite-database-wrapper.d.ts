/**
 * SqliteDatabaseWrapper provides an AuthoritativeSqlDatabase-compatible interface
 * on top of a PostgreSQL connection.
 *
 * This allows the automatic agent system to work with PostgreSQL using the same
 * interface used for SQLite, enabling storage backend portability.
 *
 * This wrapper targets sync-compatible postgres-like connections used by
 * tests, compatibility adapters, or dual-write facades.
 */
import type { DatabaseSync } from "node:sqlite";
import type { AuthoritativeSqlDatabase } from "../sqlite/sqlite-database.js";
/**
 * A minimal interface that matches what we need from the postgres driver.
 */
export interface PostgresSqlLike {
    exec(sql: string): void;
    prepare(sql: string): {
        all(...params: unknown[]): unknown[];
        get?(...params: unknown[]): unknown;
        run(...params: unknown[]): void;
    };
}
/**
 * Wraps a postgres SQL connection to provide an AuthoritativeSqlDatabase interface.
 *
 * The wrapper exposes a DatabaseSync-shaped surface over a postgres-like
 * connection. It supports transactions, nested savepoints, and health checks.
 */
export declare class SqliteDatabaseWrapper implements AuthoritativeSqlDatabase {
    readonly filePath: string;
    readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
    readonly backendType: "postgres";
    private transactionDepth;
    private readonly sql;
    constructor(connection: PostgresSqlLike, schema?: string);
    migrate(): void;
    getSchemaStatus(): {
        currentVersion: number;
        expectedVersion: number;
        upToDate: boolean;
        pendingVersions: never[];
        checksumMismatches: never[];
    };
    assertSchemaCurrent(): void;
    integrityCheck(): string[];
    transaction<T>(Work: () => T): T;
    readTransaction<T>(Work: () => T): T;
    close(): void;
    /**
     * Health check for PostgreSQL backend.
     * Uses SELECT 1 to verify the connection is alive.
     */
    healthCheck(): Promise<boolean>;
}
