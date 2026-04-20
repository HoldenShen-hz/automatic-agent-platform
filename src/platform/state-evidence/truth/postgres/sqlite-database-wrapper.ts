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
export class SqliteDatabaseWrapper implements AuthoritativeSqlDatabase {
  public readonly filePath: string;
  public readonly connection: Pick<DatabaseSync, "exec" | "prepare">;
  public readonly backendType = "postgres" as const;
  private transactionDepth = 0;
  private readonly sql: PostgresSqlLike;

  public constructor(
    connection: PostgresSqlLike,
    schema: string = "public",
  ) {
    this.filePath = `postgres://${schema}`;
    this.sql = connection;
    this.connection = {
      exec: (sql: string): void => {
        this.sql.exec(sql);
      },
      prepare: (sql: string) => {
        const prepared = this.sql.prepare(sql);
        return {
          all: (...params: unknown[]) => prepared.all(...params),
          get: (...params: unknown[]) => {
            if (typeof prepared.get === "function") {
              return prepared.get(...params);
            }
            const rows = prepared.all(...params);
            return rows[0] ?? null;
          },
          run: (...params: unknown[]) => prepared.run(...params),
        };
      },
    } as Pick<DatabaseSync, "exec" | "prepare">;
  }

  public migrate(): void {
    // Migration is handled separately via the migration system
    // This is a no-op for the wrapper
  }

  public getSchemaStatus() {
    // PostgreSQL schema status tracking differs from SQLite
    // Returns a compatible structure
    return {
      currentVersion: 0,
      expectedVersion: 0,
      upToDate: true,
      pendingVersions: [],
      checksumMismatches: [],
    };
  }

  public assertSchemaCurrent(): void {
    // No-op for PostgreSQL - schema is managed separately
  }

  public integrityCheck(): string[] {
    // PostgreSQL uses pg_dump/pg_checksums for integrity checking
    return [];
  }

  public transaction<T>(Work: () => T): T {
    const savepointName = `aa_sp_${this.transactionDepth + 1}`;
    if (this.transactionDepth === 0) {
      this.connection.exec("BEGIN");
    } else {
      this.connection.exec(`SAVEPOINT ${savepointName}`);
    }
    this.transactionDepth += 1;
    try {
      const result = Work();
      if (this.transactionDepth === 1) {
        this.connection.exec("COMMIT");
      } else {
        this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
      }
      return result;
    } catch (error) {
      if (this.transactionDepth === 1) {
        this.connection.exec("ROLLBACK");
      } else {
        this.connection.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
        this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
      }
      throw error;
    } finally {
      this.transactionDepth -= 1;
    }
  }

  public readTransaction<T>(Work: () => T): T {
    return this.transaction(Work);
  }

  public close(): void {
    // Connection pool is managed by the postgres driver
  }

  /**
   * Health check for PostgreSQL backend.
   * Uses SELECT 1 to verify the connection is alive.
   */
  public async healthCheck(): Promise<boolean> {
    try {
      this.connection.prepare("SELECT 1").all();
      return true;
    } catch {
      return false;
    }
  }
}
