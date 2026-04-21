import { createRequire } from "node:module";
import { dirname } from "node:path";
import { resolveConfigEnvironment } from "../../control-plane/config-center/runtime-env.js";
import { StorageError, ValidationError } from "../../contracts/errors.js";
import { createWorkspaceWritePolicy } from "../../control-plane/iam/sandbox-policy.js";
import { inspectStorageBackendConfig, } from "./storage-backend-config.js";
import { SqliteDatabase, } from "./sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "./sqlite/sqlite-async-adapter.js";
import { AuthoritativeTaskStore } from "./authoritative-task-store.js";
import { decorateAuthoritativeTaskStore } from "./repositories/authoritative-task-store-decorator.js";
import { createAsyncRepositoryRegistry, } from "./async-repository-registry.js";
const require = createRequire(import.meta.url);
function runtimeRequire(specifier) {
    const override = globalThis.require;
    if (override != null && override.__aaMockOverride === true) {
        return override(specifier);
    }
    return require(specifier);
}
/**
 * Type guard to extract SQLite handle from a storage backend.
 * @param storage - The storage backend handle
 * @returns The SQLite database instance
 * @throws ValidationError if the backend is not SQLite
 */
export function requireSqliteAuthoritativeStorageBackend(storage) {
    if (storage.driver !== "sqlite") {
        throw new ValidationError(`storage.expected_sqlite_got_postgres:${storage.driver}`, `storage.expected_sqlite_got_postgres:${storage.driver}`);
    }
    return storage.sqlite;
}
/**
 * Type guard to extract PostgreSQL handle from a storage backend.
 * @param storage - The storage backend handle
 * @returns The PostgreSQL storage handle
 * @throws ValidationError if the backend is not PostgreSQL
 */
export function requirePostgresAuthoritativeStorageBackend(storage) {
    if (storage.driver !== "postgres") {
        throw new ValidationError(`storage.expected_postgres_got_sqlite:${storage.driver}`, `storage.expected_postgres_got_sqlite:${storage.driver}`);
    }
    return storage;
}
export function requireSyncCompatibleAuthoritativeSqlDatabase(storage, reasonCode = "storage.postgres_shadow_sqlite_required_for_sync_compatibility") {
    if (storage.driver === "sqlite") {
        return storage.sql;
    }
    if (storage.shadowSqlite != null) {
        return storage.shadowSqlite;
    }
    throw new StorageError(reasonCode, reasonCode, {
        retryable: false,
        details: {
            driver: storage.driver,
            postgresFilePath: storage.postgres.filePath,
        },
    });
}
/**
 * Creates a facade that provides AuthoritativeSqlDatabase interface
 * for PostgreSQL but throws errors indicating sync operations are not supported.
 *
 * PostgreSQL operations are async, but the authoritative task store expects sync transactions.
 * This facade prevents sync usage while clearly indicating the limitation.
 *
 * @param pgDb - The PostgreSQL database instance
 * @returns A facade that throws on sync operations
 */
function createUnsupportedPostgresSyncFacade(pgDb) {
    const unsupported = (operation) => {
        throw new StorageError(`storage.postgres_sync_api_unsupported:${operation}`, `storage.postgres_sync_api_unsupported:${operation}`);
    };
    return {
        filePath: pgDb.filePath,
        connection: pgDb.connection,
        migrate() {
            return unsupported("migrate");
        },
        getSchemaStatus() {
            return unsupported("getSchemaStatus");
        },
        assertSchemaCurrent() {
            return unsupported("assertSchemaCurrent");
        },
        integrityCheck() {
            return unsupported("integrityCheck");
        },
        transaction(_work) {
            return unsupported("transaction");
        },
        readTransaction(_work) {
            return unsupported("readTransaction");
        },
        backendType: "postgres",
        async healthCheck() {
            return pgDb.healthCheck();
        },
    };
}
/**
 * Resolves the runtime environment from options or process environment.
 * @param options - Options containing optional environment override
 * @returns The resolved environment name
 */
function resolveEnvironment(options) {
    const resolveEnvOptions = {};
    if (options.environment != null) {
        resolveEnvOptions.environment = options.environment;
    }
    if (options.env != null) {
        resolveEnvOptions.env = options.env;
    }
    return resolveConfigEnvironment(resolveEnvOptions);
}
function resolveSyncSqliteTarget(options, plan) {
    if (plan.runtimeProfile.driver !== "postgres") {
        return {
            dbPath: options.dbPath,
            runtimeProfile: plan.runtimeProfile,
        };
    }
    const shadowSqlitePath = plan.runtimeProfile.postgres?.shadowSqlitePath ?? null;
    if (shadowSqlitePath == null || shadowSqlitePath.length === 0) {
        throw new StorageError("storage.postgres_shadow_sqlite_required_for_sync_backend", "storage.postgres_shadow_sqlite_required_for_sync_backend", {
            retryable: false,
            details: {
                requestedDbPath: options.dbPath,
                driver: plan.runtimeProfile.driver,
                dualRun: plan.runtimeProfile.postgres?.dualRun ?? false,
            },
        });
    }
    return {
        dbPath: shadowSqlitePath,
        runtimeProfile: plan.runtimeProfile,
    };
}
/**
 * Creates a plan for opening a storage backend, validating configuration.
 * This does not actually open the database, just validates and plans.
 *
 * @param options - Configuration options for the storage backend
 * @returns A plan indicating whether the backend can be opened and any issues
 */
export function planAuthoritativeStorageBackend(options) {
    const env = options.env ?? process.env;
    const environment = resolveEnvironment(options);
    const sandboxPolicy = options.sandboxPolicy ?? createWorkspaceWritePolicy(dirname(options.dbPath));
    const runtimeProfile = inspectStorageBackendConfig({
        environment,
        env,
        sandboxPolicy,
    });
    if (runtimeProfile.issues.length > 0) {
        return {
            environment,
            runtimeProfile,
            executable: false,
            openErrorCode: `storage.backend_config_invalid:${runtimeProfile.issues.join(",")}`,
        };
    }
    // PostgreSQL is architecturally supported via openPostgresAuthoritativeStorageBackend.
    // When AA_STORAGE_DRIVER=postgres is set, use the async openPostgresAuthoritativeStorageBackend.
    return {
        environment,
        runtimeProfile,
        executable: true,
        openErrorCode: null,
    };
}
/**
 * Opens a synchronous authoritative storage backend.
 *
 * For PostgreSQL dual-run configurations this returns the configured shadow
 * SQLite compatibility database so existing synchronous callers remain usable
 * while the native PostgreSQL path is handled via the async openers.
 *
 * @param options - Configuration options for the storage backend
 * @returns The open storage backend handle
 * @throws StorageError if opening fails
 */
export function openAuthoritativeStorageBackend(options) {
    const plan = planAuthoritativeStorageBackend(options);
    if (!plan.executable) {
        throw new StorageError(plan.openErrorCode ?? "storage.backend_open_failed", plan.openErrorCode ?? "storage.backend_open_failed");
    }
    const target = resolveSyncSqliteTarget(options, plan);
    const db = new SqliteDatabase(target.dbPath, options.sqliteOptions);
    const asyncAdapter = new SqliteAsyncAdapter(db);
    return {
        driver: "sqlite",
        runtimeProfile: target.runtimeProfile,
        sql: db,
        asyncSql: asyncAdapter,
        asyncRepos: createAsyncRepositoryRegistry(asyncAdapter),
        sqlite: db,
        migrate() {
            db.migrate();
        },
        close() {
            db.close();
        },
    };
}
/**
 * Opens a PostgreSQL authoritative storage backend.
 *
 * This function is async because PostgreSQL connection establishment
 * involves network I/O and pool initialization.
 *
 * **Note:** This function requires the `postgres` npm package as a runtime
 * dependency. When a dual-run shadow SQLite path is configured, the returned
 * handle also exposes that shadow database through `sql` for synchronous
 * compatibility callers.
 *
 * @param options - The storage backend options including dsn, pool config, etc.
 * @returns A promise that resolves to the PostgreSQL storage handle
 * @throws Error if the postgres driver is unavailable or connection fails
 */
export async function openPostgresAuthoritativeStorageBackend(options) {
    const plan = planAuthoritativeStorageBackend(options);
    if (!plan.executable) {
        throw new StorageError(plan.openErrorCode ?? "storage.backend_open_failed", plan.openErrorCode ?? "storage.backend_open_failed");
    }
    if (plan.runtimeProfile.driver !== "postgres") {
        throw new ValidationError(`storage.expected_postgres_got:${plan.runtimeProfile.driver}`, `storage.expected_postgres_got:${plan.runtimeProfile.driver}`);
    }
    const profile = plan.runtimeProfile.postgres;
    if (!profile) {
        throw new StorageError("storage.postgres_profile_missing", "storage.postgres_profile_missing");
    }
    // Attempt to load the postgres driver
    try {
        // Using require to check if the module is available
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        runtimeRequire("postgres");
    }
    catch (error) {
        throw new StorageError("storage.postgres_driver_not_installed", "storage.postgres_driver_not_installed:PostgreSQL support requires the locked runtime dependencies. Re-run npm ci or npm install before enabling AA_STORAGE_DRIVER=postgres.");
    }
    // Driver is available - import and use the PgDatabase implementation
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { PgDatabase } = runtimeRequire("./postgres/pg-database.js");
    const pgDb = await PgDatabase.open({
        dsn: profile.dsnConfigured ? String(profile.dsnValue ?? "") : "",
        schema: profile.schema ?? "public",
        poolMin: profile.poolMin ?? 0,
        poolMax: profile.poolMax ?? 20,
        ssl: profile.sslmode === "require" || profile.sslmode === "verify-full",
    });
    const shadowSqlitePath = profile.shadowSqlitePath ?? null;
    const shadowSqlite = shadowSqlitePath == null || shadowSqlitePath.length === 0
        ? undefined
        : new SqliteDatabase(shadowSqlitePath, options.sqliteOptions);
    const sql = shadowSqlite ?? createUnsupportedPostgresSyncFacade(pgDb);
    const handle = {
        driver: "postgres",
        runtimeProfile: plan.runtimeProfile,
        sql,
        asyncSql: pgDb, // PgDatabase implements AsyncSqlDatabase
        asyncRepos: createAsyncRepositoryRegistry(pgDb),
        postgres: pgDb,
        ...(shadowSqlite ? { shadowSqlite } : {}),
        async migrate() {
            shadowSqlite?.migrate();
            await pgDb.migrate();
        },
        async close() {
            try {
                shadowSqlite?.close();
            }
            finally {
                await pgDb.close();
            }
        },
    };
    return handle;
}
/**
 * Opens a storage backend and returns a context including the authoritative task store.
 * This is the main entry point for getting a fully configured storage stack.
 *
 * @param options - Configuration options for the storage backend
 * @returns The storage context with the authoritative task store included
 */
export function openAuthoritativeStorageContext(options) {
    const storage = openAuthoritativeStorageBackend(options);
    return {
        ...storage,
        store: decorateAuthoritativeTaskStore(new AuthoritativeTaskStore(storage.sql)),
    };
}
/**
 * Opens a storage backend asynchronously.
 * Works with both SQLite and PostgreSQL backends.
 *
 * @param options - Configuration options for the storage backend
 * @returns The open storage backend handle
 */
export async function openAsyncAuthoritativeStorageBackend(options) {
    const plan = planAuthoritativeStorageBackend(options);
    if (!plan.executable) {
        throw new StorageError(plan.openErrorCode ?? "storage.backend_open_failed", plan.openErrorCode ?? "storage.backend_open_failed");
    }
    if (plan.runtimeProfile.driver === "postgres") {
        return openPostgresAuthoritativeStorageBackend(options);
    }
    return openAuthoritativeStorageBackend(options);
}
/**
 * Opens a storage context asynchronously.
 *
 * PostgreSQL-backed contexts require a dual-run shadow SQLite path so the
 * existing synchronous AuthoritativeTaskStore remains available while the
 * PostgreSQL backend owns connection lifecycle and migrations.
 *
 * @param options - Configuration options for the storage backend
 * @returns The async storage context with the authoritative task store included
 */
export async function openAsyncAuthoritativeStorageContext(options) {
    const plan = planAuthoritativeStorageBackend(options);
    if (!plan.executable) {
        throw new StorageError(plan.openErrorCode ?? "storage.backend_open_failed", plan.openErrorCode ?? "storage.backend_open_failed");
    }
    if (plan.runtimeProfile.driver === "postgres") {
        const shadowSqlitePath = plan.runtimeProfile.postgres?.shadowSqlitePath ?? null;
        if (shadowSqlitePath == null || shadowSqlitePath.length === 0) {
            throw new StorageError("storage.postgres_shadow_sqlite_required_for_async_context", "storage.postgres_shadow_sqlite_required_for_async_context");
        }
        const storage = await openPostgresAuthoritativeStorageBackend(options);
        const shadowSqlite = storage.shadowSqlite ?? new SqliteDatabase(shadowSqlitePath, options.sqliteOptions);
        return {
            ...storage,
            sql: shadowSqlite,
            store: decorateAuthoritativeTaskStore(new AuthoritativeTaskStore(shadowSqlite)),
            shadowSqlite,
            async migrate() {
                await storage.migrate();
            },
            async close() {
                await storage.close();
            },
        };
    }
    const storage = await openAsyncAuthoritativeStorageBackend(options);
    return {
        ...storage,
        store: decorateAuthoritativeTaskStore(new AuthoritativeTaskStore(storage.sql)),
    };
}
//# sourceMappingURL=storage-backend-factory.js.map