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
/**
 * Wraps a postgres SQL connection to provide an AuthoritativeSqlDatabase interface.
 *
 * The wrapper exposes a DatabaseSync-shaped surface over a postgres-like
 * connection. It supports transactions, nested savepoints, and health checks.
 */
export class SqliteDatabaseWrapper {
    filePath;
    connection;
    backendType = "postgres";
    transactionDepth = 0;
    sql;
    constructor(connection, schema = "public") {
        this.filePath = `postgres://${schema}`;
        this.sql = connection;
        this.connection = {
            exec: (sql) => {
                this.sql.exec(sql);
            },
            prepare: (sql) => {
                const prepared = this.sql.prepare(sql);
                return {
                    all: (...params) => prepared.all(...params),
                    get: (...params) => {
                        if (typeof prepared.get === "function") {
                            return prepared.get(...params);
                        }
                        const rows = prepared.all(...params);
                        return rows[0] ?? null;
                    },
                    run: (...params) => prepared.run(...params),
                };
            },
        };
    }
    migrate() {
        // Migration is handled separately via the migration system
        // This is a no-op for the wrapper
    }
    getSchemaStatus() {
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
    assertSchemaCurrent() {
        // No-op for PostgreSQL - schema is managed separately
    }
    integrityCheck() {
        // PostgreSQL uses pg_dump/pg_checksums for integrity checking
        return [];
    }
    transaction(Work) {
        const savepointName = `aa_sp_${this.transactionDepth + 1}`;
        if (this.transactionDepth === 0) {
            this.connection.exec("BEGIN");
        }
        else {
            this.connection.exec(`SAVEPOINT ${savepointName}`);
        }
        this.transactionDepth += 1;
        try {
            const result = Work();
            if (this.transactionDepth === 1) {
                this.connection.exec("COMMIT");
            }
            else {
                this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
            }
            return result;
        }
        catch (error) {
            if (this.transactionDepth === 1) {
                this.connection.exec("ROLLBACK");
            }
            else {
                this.connection.exec(`ROLLBACK TO SAVEPOINT ${savepointName}`);
                this.connection.exec(`RELEASE SAVEPOINT ${savepointName}`);
            }
            throw error;
        }
        finally {
            this.transactionDepth -= 1;
        }
    }
    readTransaction(Work) {
        return this.transaction(Work);
    }
    close() {
        // Connection pool is managed by the postgres driver
    }
    /**
     * Health check for PostgreSQL backend.
     * Uses SELECT 1 to verify the connection is alive.
     */
    async healthCheck() {
        try {
            this.connection.prepare("SELECT 1").all();
            return true;
        }
        catch {
            return false;
        }
    }
}
//# sourceMappingURL=sqlite-database-wrapper.js.map