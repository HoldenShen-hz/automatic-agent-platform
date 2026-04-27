/**
 * Unit Tests: Runtime Factory
 *
 * Tests the runtime factory for creating services with proper backend selection.
 * Uses real SQLite backend for integration-style unit tests.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createRuntimeServices, runtimeFactories } from "../../../../../src/platform/execution/execution-engine/runtime-factory.js";
import { createExecutionLeaseService } from "../../../../../src/platform/execution/lease/execution-lease-factory.js";
import { createHaCoordinatorService } from "../../../../../src/platform/execution/ha/ha-coordinator-factory.js";
import { createHotUpgradeService } from "../../../../../src/platform/execution/hot-upgrade/hot-upgrade-factory.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import type { PostgresAuthoritativeStorageBackendHandle } from "../../../../../src/platform/state-evidence/truth/storage-backend-factory.js";
import type { RuntimeServices } from "../../../../../src/platform/execution/execution-engine/runtime-factory.js";

function createSqliteBackend(dbPath: string): SqliteDatabase {
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  return db;
}

function createPostgresHandleWithShadow(shadowDb: SqliteDatabase): PostgresAuthoritativeStorageBackendHandle {
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
        shadowSqlitePath: shadowDb.filePath,
        schema: null,
      },
    },
    sql: shadowDb,
    asyncSql: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
      backendType: "postgres",
      asyncConnection: {} as never,
      transaction: async <T>(work: () => Promise<T>) => work(),
      close: async () => undefined,
    } as never,
    asyncRepos: {} as never,
    postgres: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
    } as never,
    shadowSqlite: shadowDb,
    async migrate(): Promise<void> {
      return undefined;
    },
    async close(): Promise<void> {
      return undefined;
    },
  };
}

function createPostgresHandleWithoutShadow(): PostgresAuthoritativeStorageBackendHandle {
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
        dualRun: false,
        shadowSqlitePath: null,
        schema: null,
      },
    },
    sql: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
      backendType: "postgres",
      migrate(): void { throw new Error("unsupported"); },
      getSchemaStatus(): never { throw new Error("unsupported"); },
      assertSchemaCurrent(): void { throw new Error("unsupported"); },
      integrityCheck(): string[] { throw new Error("unsupported"); },
      transaction<T>(): T { throw new Error("unsupported"); },
      readTransaction<T>(): T { throw new Error("unsupported"); },
      healthCheck: async (): Promise<boolean> => false,
    },
    asyncSql: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
      backendType: "postgres",
      asyncConnection: {} as never,
      transaction: async <T>(work: () => Promise<T>) => work(),
      close: async () => undefined,
    } as never,
    asyncRepos: {} as never,
    postgres: {
      filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
    } as never,
    async migrate(): Promise<void> {
      return undefined;
    },
    async close(): Promise<void> {
      return undefined;
    },
  };
}

// ---------------------------------------------------------------------------
// createRuntimeServices
// ---------------------------------------------------------------------------

test("createRuntimeServices creates all runtime services with valid postgres backend", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-unit-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const services = createRuntimeServices(backend);

    assert.ok(services.ha, "should have ha service");
    assert.ok(services.leases, "should have leases service");
    assert.ok(services.hotUpgrade, "should have hotUpgrade service");
    assert.ok(services.dispatch, "should have dispatch service");
    assert.ok(services.handshake, "should have handshake service");
    assert.ok(services.writeback, "should have writeback service");
    assert.ok(services.preemption, "should have preemption service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("createRuntimeServices throws without shadow sqlite for postgres", () => {
  const backend = createPostgresHandleWithoutShadow();

  assert.throws(
    () => createRuntimeServices(backend),
    /storage\.postgres_shadow_sqlite_required_for_runtime_services/,
  );
});

// ---------------------------------------------------------------------------
// runtimeFactories
// ---------------------------------------------------------------------------

test("runtimeFactories.createHaCoordinatorService creates ha service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-ha-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const haService = runtimeFactories.createHaCoordinatorService(backend);
    assert.ok(haService, "createHaCoordinatorService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createExecutionLeaseService creates lease service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-lease-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const leaseService = runtimeFactories.createExecutionLeaseService(backend);
    assert.ok(leaseService, "createExecutionLeaseService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createHotUpgradeService creates hot upgrade service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-hotup-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const hotUpgradeService = runtimeFactories.createHotUpgradeService(backend);
    assert.ok(hotUpgradeService, "createHotUpgradeService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createDispatchService creates dispatch service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-dispatch-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const dispatchService = runtimeFactories.createDispatchService(backend);
    assert.ok(dispatchService, "createDispatchService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createHandshakeService creates handshake service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-handshake-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const handshakeService = runtimeFactories.createHandshakeService(backend);
    assert.ok(handshakeService, "createHandshakeService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createWritebackService creates writeback service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-writeback-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const writebackService = runtimeFactories.createWritebackService(backend);
    assert.ok(writebackService, "createWritebackService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createPreemptionService creates preemption service", () => {
  const workspace = createTempWorkspace("aa-runtime-factory-preempt-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const preemptionService = runtimeFactories.createPreemptionService(backend);
    assert.ok(preemptionService, "createPreemptionService should return a service");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Individual factory error cases
// ---------------------------------------------------------------------------

test("runtimeFactories.createDispatchService throws without shadow sqlite", () => {
  const backend = createPostgresHandleWithoutShadow();

  assert.throws(
    () => runtimeFactories.createDispatchService(backend),
    /storage\.postgres_shadow_sqlite_required_for_dispatch_service/,
  );
});

test("runtimeFactories.createHandshakeService throws without shadow sqlite", () => {
  const backend = createPostgresHandleWithoutShadow();

  assert.throws(
    () => runtimeFactories.createHandshakeService(backend),
    /storage\.postgres_shadow_sqlite_required_for_handshake_service/,
  );
});

test("runtimeFactories.createWritebackService throws without shadow sqlite", () => {
  const backend = createPostgresHandleWithoutShadow();

  assert.throws(
    () => runtimeFactories.createWritebackService(backend),
    /storage\.postgres_shadow_sqlite_required_for_writeback_service/,
  );
});

test("runtimeFactories.createPreemptionService throws without shadow sqlite", () => {
  const backend = createPostgresHandleWithoutShadow();

  assert.throws(
    () => runtimeFactories.createPreemptionService(backend),
    /storage\.postgres_shadow_sqlite_required_for_preemption_service/,
  );
});

// ---------------------------------------------------------------------------
// Type exports
// ---------------------------------------------------------------------------

test("RuntimeServices interface structure is correct", () => {
  // This verifies the type is properly structured
  const services: RuntimeServices = {
    ha: null as unknown as ReturnType<typeof createHaCoordinatorService>,
    leases: null as unknown as ReturnType<typeof createExecutionLeaseService>,
    hotUpgrade: null as unknown as ReturnType<typeof createHotUpgradeService>,
    dispatch: null as unknown as ReturnType<typeof runtimeFactories.createDispatchService>,
    handshake: null as unknown as ReturnType<typeof runtimeFactories.createHandshakeService>,
    writeback: null as unknown as ReturnType<typeof runtimeFactories.createWritebackService>,
    preemption: null as unknown as ReturnType<typeof runtimeFactories.createPreemptionService>,
  };

  assert.ok("ha" in services);
  assert.ok("leases" in services);
  assert.ok("hotUpgrade" in services);
  assert.ok("dispatch" in services);
  assert.ok("handshake" in services);
  assert.ok("writeback" in services);
  assert.ok("preemption" in services);
});

test("all runtimeFactories methods are functions", () => {
  assert.equal(typeof runtimeFactories.createHaCoordinatorService, "function");
  assert.equal(typeof runtimeFactories.createExecutionLeaseService, "function");
  assert.equal(typeof runtimeFactories.createHotUpgradeService, "function");
  assert.equal(typeof runtimeFactories.createDispatchService, "function");
  assert.equal(typeof runtimeFactories.createHandshakeService, "function");
  assert.equal(typeof runtimeFactories.createWritebackService, "function");
  assert.equal(typeof runtimeFactories.createPreemptionService, "function");
});

test("each runtimeFactories function is distinct", () => {
  const factories = [
    runtimeFactories.createHaCoordinatorService,
    runtimeFactories.createExecutionLeaseService,
    runtimeFactories.createHotUpgradeService,
    runtimeFactories.createDispatchService,
    runtimeFactories.createHandshakeService,
    runtimeFactories.createWritebackService,
    runtimeFactories.createPreemptionService,
  ];

  const uniqueSet = new Set(factories);
  assert.equal(uniqueSet.size, factories.length);
});
