import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import {
  openAuthoritativeStorageBackend,
  openAuthoritativeStorageContext,
  openAsyncAuthoritativeStorageBackend,
  openAsyncAuthoritativeStorageContext,
  openPostgresAuthoritativeStorageBackend,
  planAuthoritativeStorageBackend,
  requirePostgresAuthoritativeStorageBackend,
  requireSyncCompatibleAuthoritativeSqlDatabase,
  requireSqliteAuthoritativeStorageBackend,
} from "../../../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import { cleanupPath, createFile, createTempWorkspace } from "../../../../helpers/fs.js";

interface MockPgDatabase {
  filePath: string;
  connection: object;
  migrate(): Promise<void>;
  close(): Promise<void>;
  healthCheck(): Promise<boolean>;
}

test("storage backend factory opens sqlite by default", () => {
  const workspace = createTempWorkspace("aa-storage-backend-factory-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    assert.equal(plan.environment, "dev");
    assert.equal(plan.runtimeProfile.driver, "sqlite");
    assert.equal(plan.executable, true);
    assert.equal(plan.openErrorCode, null);

    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });
    const sqliteStorage = requireSqliteAuthoritativeStorageBackend(storage);
    assert.equal(sqliteStorage.filePath, dbPath);
    storage.migrate();
    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory exposes a bound authoritative store context", () => {
  const workspace = createTempWorkspace("aa-storage-backend-context-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const storage = openAuthoritativeStorageContext({
      dbPath,
      environment: "dev",
      env: {},
    });
    storage.migrate();
    storage.store.insertTask({
      id: "task-storage-context",
      parentId: null,
      rootId: "task-storage-context",
      divisionId: "general-ops",
      title: "storage context task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-09T00:00:00.000Z",
      updatedAt: "2026-04-09T00:00:00.000Z",
      completedAt: null,
    });

    const tasks = storage.store.listTasks(5);
    assert.equal(tasks.length, 1);
    assert.equal(tasks[0]?.id, "task-storage-context");
    assert.equal(storage.sql.filePath, dbPath);
    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory routes synchronous postgres dual-run access through shadow sqlite", () => {
  const workspace = createTempWorkspace("aa-storage-backend-factory-");
  const dbPath = join(workspace, "runtime.db");
  const shadowPath = join(workspace, "shadow", "runtime.db");

  try {
    createFile(shadowPath, "");
    const env = {
      AA_STORAGE_DRIVER: "postgres",
      AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
      AA_STORAGE_POSTGRES_POOL_MIN: "2",
      AA_STORAGE_POSTGRES_POOL_MAX: "10",
      AA_STORAGE_POSTGRES_DUAL_RUN: "true",
      AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
    };

    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "staging",
      env,
    });

    assert.equal(plan.runtimeProfile.driver, "postgres");
    assert.deepEqual(plan.runtimeProfile.issues, []);
    assert.equal(plan.executable, true);
    const storage = openAuthoritativeStorageBackend({
      dbPath,
      environment: "staging",
      env,
    });
    assert.equal(storage.driver, "sqlite");
    assert.equal(storage.sql.filePath, shadowPath);
    storage.migrate();
    storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory sync opener requires shadow sqlite for postgres dual-run compatibility", () => {
  const workspace = createTempWorkspace("aa-storage-backend-factory-sync-postgres-");
  const dbPath = join(workspace, "runtime.db");

  try {
    assert.throws(
      () =>
        openAuthoritativeStorageBackend({
          dbPath,
          environment: "dev",
          env: {
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os",
          },
        }),
      /storage\.(postgres_shadow_sqlite_required_for_sync_backend|backend_config_invalid:)/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory fail-closes invalid backend configuration before open", () => {
  const workspace = createTempWorkspace("aa-storage-backend-factory-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const plan = planAuthoritativeStorageBackend({
      dbPath,
      environment: "staging",
      env: {
        AA_STORAGE_DRIVER: "postgres",
        AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os?sslmode=disable",
      },
    });

    assert.equal(plan.runtimeProfile.driver, "postgres");
    assert.equal(plan.executable, false);
    assert.ok(plan.openErrorCode?.startsWith("storage.backend_config_invalid:"));
    assert.ok(plan.runtimeProfile.issues.includes("storage.postgres.host_not_production_ready:localhost"));
    assert.ok(plan.runtimeProfile.issues.includes("storage.postgres.sslmode_required"));
    assert.ok(plan.runtimeProfile.issues.includes("storage.postgres.dual_run_required"));
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory sync opener fail-closes invalid backend plans", () => {
  const workspace = createTempWorkspace("aa-storage-backend-factory-sync-invalid-");
  const dbPath = join(workspace, "runtime.db");

  try {
    assert.throws(
      () =>
        openAuthoritativeStorageBackend({
          dbPath,
          environment: "staging",
          env: {
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os?sslmode=disable",
          },
        }),
      /storage\.backend_config_invalid:/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory async sqlite helpers open usable backends and contexts", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-async-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const backend = await openAsyncAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });
    assert.equal(backend.driver, "sqlite");
    backend.migrate();
    await backend.close();

    const context = await openAsyncAuthoritativeStorageContext({
      dbPath,
      environment: "dev",
      env: {},
    });
    context.migrate();
    context.store.insertTask({
      id: "task-async-storage-context",
      parentId: null,
      rootId: "task-async-storage-context",
      divisionId: "general-ops",
      title: "async storage context task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      completedAt: null,
    });
    assert.equal(context.store.listTasks(5).length, 1);
    await context.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory guard helpers reject the wrong backend driver", () => {
  const workspace = createTempWorkspace("aa-storage-backend-guards-");
  const dbPath = join(workspace, "runtime.db");

  try {
    const sqliteBackend = openAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env: {},
    });

    const postgresHandle = requirePostgresAuthoritativeStorageBackend({
      driver: "postgres",
      runtimeProfile: {
        environment: "dev",
        driver: "postgres",
        issues: [],
        postgres: {
          dsnConfigured: true,
          dsnSource: "AA_STORAGE_POSTGRES_DSN",
          host: "localhost",
          database: "agent_company_os",
          sslmode: null,
          poolMin: 0,
          poolMax: 20,
          dualRun: false,
          shadowSqlitePath: null,
          schema: null,
        },
      },
      sql: {} as never,
      asyncSql: {} as never,
      asyncRepos: {} as never,
      postgres: {} as never,
      migrate() {
        return Promise.resolve();
      },
      close() {
        return Promise.resolve();
      },
    });

    assert.equal(postgresHandle.driver, "postgres");
    assert.throws(() => requirePostgresAuthoritativeStorageBackend(sqliteBackend), /storage\.expected_postgres_got_sqlite:sqlite/);
    assert.throws(() => requireSqliteAuthoritativeStorageBackend(postgresHandle), /storage\.expected_sqlite_got_postgres:postgres/);

    sqliteBackend.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory async postgres context requires a shadow sqlite path before opening", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-async-postgres-");
  const dbPath = join(workspace, "runtime.db");

  try {
    await assert.rejects(
      () =>
        openAsyncAuthoritativeStorageContext({
          dbPath,
          environment: "dev",
          env: {
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os",
          },
        }),
      /storage\.postgres_shadow_sqlite_required_for_async_context/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory async helpers fail-close invalid backend plans before opening", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-async-invalid-");
  const dbPath = join(workspace, "runtime.db");
  const env = {
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os?sslmode=disable",
  };

  try {
    await assert.rejects(
      () =>
        openAsyncAuthoritativeStorageBackend({
          dbPath,
          environment: "staging",
          env,
        }),
      /storage\.backend_config_invalid:/,
    );
    await assert.rejects(
      () =>
        openAsyncAuthoritativeStorageContext({
          dbPath,
          environment: "staging",
          env,
        }),
      /storage\.backend_config_invalid:/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory postgres opener rejects sqlite runtime plans", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-postgres-guard-");
  const dbPath = join(workspace, "runtime.db");

  try {
    await assert.rejects(
      () =>
        openPostgresAuthoritativeStorageBackend({
          dbPath,
          environment: "dev",
          env: {},
        }),
      /storage\.expected_postgres_got:sqlite/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory postgres opener fail-closes invalid postgres plans before driver loading", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-postgres-invalid-");
  const dbPath = join(workspace, "runtime.db");

  try {
    await assert.rejects(
      () =>
        openPostgresAuthoritativeStorageBackend({
          dbPath,
          environment: "staging",
          env: {
            AA_STORAGE_DRIVER: "postgres",
            AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@localhost/agent_company_os?sslmode=disable",
          },
        }),
      /storage\.backend_config_invalid:/,
    );
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory postgres opener exposes shadow sqlite compatibility alongside async pg handle", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-postgres-success-");
  const dbPath = join(workspace, "runtime.db");
  const shadowPath = join(workspace, "shadow", "runtime.db");
  const env = {
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=verify-full",
    AA_STORAGE_POSTGRES_POOL_MIN: "2",
    AA_STORAGE_POSTGRES_POOL_MAX: "10",
    AA_STORAGE_POSTGRES_SCHEMA: "agent_runtime",
    AA_STORAGE_POSTGRES_DUAL_RUN: "true",
    AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
  };

  const calls = {
    migrate: 0,
    close: 0,
  };
  let openOptions: Record<string, unknown> | null = null;
  const fakePgDb: MockPgDatabase = {
    filePath: "postgres://fake/agent_company_os",
    connection: { dialect: "postgres" },
    async migrate(): Promise<void> {
      calls.migrate += 1;
    },
    async close(): Promise<void> {
      calls.close += 1;
    },
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };

  try {
    createFile(shadowPath, "");

    const storage = await openPostgresAuthoritativeStorageBackend({
      dbPath,
      environment: "staging",
      env,
      runtimeModules: {
        postgres: {},
        "./postgres/pg-database.js": {
          PgDatabase: {
            async open(options: Record<string, unknown>): Promise<MockPgDatabase> {
              openOptions = options;
              return fakePgDb;
            },
          },
        },
      },
    });

    assert.equal(storage.driver, "postgres");
    assert.equal(storage.asyncSql, fakePgDb);
    assert.equal(storage.postgres, fakePgDb);
    assert.equal(storage.shadowSqlite?.filePath, shadowPath);
    assert.deepEqual(openOptions, {
      dsn: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=verify-full",
      schema: "agent_runtime",
      poolMin: 2,
      poolMax: 10,
      ssl: true,
    });
    assert.equal(storage.sql.filePath, shadowPath);
    storage.sql.migrate();

    await storage.migrate();
    await storage.close();

    assert.equal(calls.migrate, 1);
    assert.equal(calls.close, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory async postgres context wires shadow sqlite lifecycle around async pg handle", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-async-postgres-success-");
  const dbPath = join(workspace, "runtime.db");
  const shadowPath = join(workspace, "shadow", "runtime.db");
  const env = {
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
    AA_STORAGE_POSTGRES_DUAL_RUN: "true",
    AA_STORAGE_POSTGRES_SHADOW_SQLITE_PATH: shadowPath,
  };

  const calls = {
    migrate: 0,
    close: 0,
  };
  try {
    createFile(shadowPath, "");

    const context = await openAsyncAuthoritativeStorageContext({
      dbPath,
      environment: "staging",
      env,
      runtimeModules: {
        postgres: {},
        "./postgres/pg-database.js": {
          PgDatabase: {
            async open(): Promise<MockPgDatabase> {
              return {
                filePath: "postgres://fake/agent_company_os",
                connection: { dialect: "postgres" },
                async migrate(): Promise<void> {
                  calls.migrate += 1;
                },
                async close(): Promise<void> {
                  calls.close += 1;
                },
                async healthCheck(): Promise<boolean> {
                  return true;
                },
              };
            },
          },
        },
      },
    });

    assert.equal(context.driver, "postgres");
    assert.equal(context.sql.filePath, shadowPath);
    assert.equal(context.shadowSqlite?.filePath, shadowPath);
    await context.migrate();

    context.store.insertTask({
      id: "task-async-postgres-shadow-context",
      parentId: null,
      rootId: "task-async-postgres-shadow-context",
      divisionId: "general-ops",
      title: "async postgres shadow task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-16T00:00:00.000Z",
      updatedAt: "2026-04-16T00:00:00.000Z",
      completedAt: null,
    });
    assert.equal(context.store.listTasks(5).length, 1);

    await context.close();

    assert.equal(calls.migrate, 1);
    assert.equal(calls.close, 1);
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory postgres opener exposes unsupported sync facade without shadow sqlite", async () => {
  const workspace = createTempWorkspace("aa-storage-backend-postgres-noshadow-");
  const dbPath = join(workspace, "runtime.db");
  const env = {
    AA_STORAGE_DRIVER: "postgres",
    AA_STORAGE_POSTGRES_DSN: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
  };

  const fakePgDb: MockPgDatabase = {
    filePath: "postgres://fake/agent_company_os",
    connection: { dialect: "postgres" },
    async migrate(): Promise<void> {},
    async close(): Promise<void> {},
    async healthCheck(): Promise<boolean> {
      return true;
    },
  };

  try {
    const storage = await openPostgresAuthoritativeStorageBackend({
      dbPath,
      environment: "dev",
      env,
      runtimeModules: {
        postgres: {},
        "./postgres/pg-database.js": {
          PgDatabase: {
            async open(): Promise<MockPgDatabase> {
              return fakePgDb;
            },
          },
        },
      },
    });

    assert.equal(storage.shadowSqlite, undefined);
    assert.equal(storage.sql.filePath, fakePgDb.filePath);
    await assert.rejects(async () => storage.sql.migrate(), /storage\.postgres_sync_api_unsupported:migrate/);
    assert.throws(() => storage.sql.getSchemaStatus(), /storage\.postgres_sync_api_unsupported:getSchemaStatus/);
    assert.throws(() => storage.sql.assertSchemaCurrent(), /storage\.postgres_sync_api_unsupported:assertSchemaCurrent/);
    assert.throws(() => storage.sql.integrityCheck(), /storage\.postgres_sync_api_unsupported:integrityCheck/);
    assert.throws(() => storage.sql.transaction(() => "nope"), /storage\.postgres_sync_api_unsupported:transaction/);
    assert.throws(() => storage.sql.readTransaction(() => "nope"), /storage\.postgres_sync_api_unsupported:readTransaction/);
    await assert.doesNotReject(() => storage.sql.healthCheck());
    await storage.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("storage backend factory sync compatibility helper returns shadow sqlite and fail-closes without it", () => {
  const sqliteWorkspace = createTempWorkspace("aa-storage-backend-sync-compat-");
  const sqliteDbPath = join(sqliteWorkspace, "runtime.db");

  try {
    const sqliteStorage = openAuthoritativeStorageBackend({
      dbPath: sqliteDbPath,
      environment: "dev",
      env: {},
    });

    assert.equal(requireSyncCompatibleAuthoritativeSqlDatabase(sqliteStorage).filePath, sqliteDbPath);

    const postgresLike = {
      driver: "postgres" as const,
      runtimeProfile: {
        environment: "dev",
        driver: "postgres" as const,
        issues: [],
        postgres: {
          dsnConfigured: true,
          dsnSource: "AA_STORAGE_POSTGRES_DSN",
          host: "postgres.internal",
          database: "agent_company_os",
          sslmode: "require" as const,
          poolMin: 0,
          poolMax: 20,
          dualRun: false,
          shadowSqlitePath: null,
          schema: null,
        },
      },
      sql: sqliteStorage.sql,
      asyncSql: sqliteStorage.asyncSql,
      asyncRepos: sqliteStorage.asyncRepos,
      postgres: {
        filePath: "postgres://fake/agent_company_os",
      },
      migrate() {
        return Promise.resolve();
      },
      close() {
        return Promise.resolve();
      },
    };

    assert.throws(
      () => requireSyncCompatibleAuthoritativeSqlDatabase(postgresLike as any),
      /storage\.postgres_shadow_sqlite_required_for_sync_compatibility/,
    );

    sqliteStorage.close();
  } finally {
    cleanupPath(sqliteWorkspace);
  }
});
