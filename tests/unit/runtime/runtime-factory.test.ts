import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createRuntimeServices, runtimeFactories } from "../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js";
import { createExecutionLeaseService } from "../../../src/platform/five-plane-execution/lease/execution-lease-factory.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import type { PostgresAuthoritativeStorageBackendHandle } from "../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";

function createPostgresHandle(options: {
  sql: SqliteDatabase | PostgresAuthoritativeStorageBackendHandle["sql"];
  shadowSqlite?: SqliteDatabase;
}): PostgresAuthoritativeStorageBackendHandle {
  return {
    driver: "postgres",
    runtimeProfile: {
      environment: "dev",
      driver: "postgres",
      issues: [],
      postgres: {
        dsnConfigured: true,
        dsnSource: "AA_STORAGE_POSTGRES_DSN",
        dsnValue: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        host: "postgres.internal",
        database: "agent_company_os",
        sslmode: "require",
        poolMin: 0,
        poolMax: 20,
        dualRun: true,
        shadowSqlitePath: options.shadowSqlite?.filePath ?? null,
        schema: null,
      },
    },
    sql: options.sql,
    asyncSql: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
      backendType: "postgres",
      asyncConnection: {} as never,
      transaction: async <T>(work: () => Promise<T>) => work(),
      close: async () => undefined,
    } as never,
    asyncRepos: {} as never,
    cas: null,
    postgres: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
    } as never,
    ...(options.shadowSqlite ? { shadowSqlite: options.shadowSqlite } : {}),
    async migrate(): Promise<void> {
      return undefined;
    },
    async close(): Promise<void> {
      return undefined;
    },
  };
}

test("runtime factory creates services for postgres backend when shadow sqlite compatibility is available [runtime-factory]", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = new SqliteDatabase(shadowPath);
    shadowSqlite.migrate();
    const backend = createPostgresHandle({
      sql: shadowSqlite,
      shadowSqlite,
    });

    const services = createRuntimeServices(backend);
    const dispatch = runtimeFactories.createDispatchService(backend);
    const leases = createExecutionLeaseService(backend);

    assert.ok(services.ha);
    assert.ok(services.leases);
    assert.ok(services.hotUpgrade);
    assert.ok(services.dispatch);
    assert.ok(services.handshake);
    assert.ok(services.writeback);
    assert.ok(services.preemption);
    assert.ok(dispatch);
    assert.ok(leases);

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime factory fail-closes postgres backend without shadow sqlite compatibility [runtime-factory]", () => {
  const unsupportedSql = {
    filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
    backendType: "postgres" as const,
    connection: {} as never,
    migrate(): void {
      throw new Error("unsupported");
    },
    getSchemaStatus(): never {
      throw new Error("unsupported");
    },
    assertSchemaCurrent(): never {
      throw new Error("unsupported");
    },
    integrityCheck(): never {
      throw new Error("unsupported");
    },
    transaction<T>(): T {
      throw new Error("unsupported");
    },
    readTransaction<T>(): T {
      throw new Error("unsupported");
    },
    healthCheck: async (): Promise<boolean> => false,
    close(): void {
      return undefined;
    },
  };
  const backend = createPostgresHandle({
    sql: unsupportedSql,
  });

  assert.throws(
    () => createRuntimeServices(backend),
    /storage\.postgres_shadow_sqlite_required_for_runtime_services/,
  );
  assert.throws(
    () => runtimeFactories.createDispatchService(backend),
    /storage\.postgres_shadow_sqlite_required_for_dispatch_service/,
  );
  assert.throws(
    () => createExecutionLeaseService(backend),
    /storage\.postgres_shadow_sqlite_required_for_execution_lease_service/,
  );
});
