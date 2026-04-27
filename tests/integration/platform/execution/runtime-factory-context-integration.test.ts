/**
 * Integration Tests: Runtime Factory and Context
 *
 * Tests the integration between runtime factory services and context propagation.
 * Uses real SQLite backend for testing.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createRuntimeServices, runtimeFactories } from "../../../../src/platform/execution/execution-engine/runtime-factory.js";
import {
  provideContext,
  getContext,
  getContextOrNull,
  withContextPatch,
  getTenantId,
  getWorkspaceId,
  hasTenantContext,
  hasWorkspaceContext,
} from "../../../../src/platform/shared/context/runtime-context.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import type { PostgresAuthoritativeStorageBackendHandle } from "../../../../src/platform/state-evidence/truth/storage-backend-factory.js";
import type { RuntimeContextSnapshot } from "../../../../src/platform/shared/context/runtime-context.js";

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

function createSnapshot(overrides: Partial<RuntimeContextSnapshot> = {}): RuntimeContextSnapshot {
  return {
    traceId: "int-trace-123",
    taskId: "int-task-456",
    executionId: "int-exec-789",
    workflowId: "int-wf-101",
    sessionId: "int-session-202",
    agentId: "int-agent-303",
    divisionId: "int-div-404",
    workdir: "/tmp",
    requestId: "int-req-505",
    approvalId: "int-approval-606",
    abortSignalRef: "int-signal-707",
    budgetScopeId: "int-budget-808",
    tenantId: "int-tenant-909",
    workspaceId: "int-workspace-101",
    spanId: null,
    parentSpanId: null,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Factory + Context Integration
// ---------------------------------------------------------------------------

test("createRuntimeServices works within context propagation", () => {
  const workspace = createTempWorkspace("aa-int-factory-context-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "factory-tenant" });

    provideContext(snapshot, () => {
      const services = createRuntimeServices(backend);

      // Context is available inside service creation
      assert.ok(hasTenantContext());
      assert.equal(getTenantId(), "factory-tenant");

      // All services should be created
      assert.ok(services.ha);
      assert.ok(services.leases);
      assert.ok(services.hotUpgrade);
      assert.ok(services.dispatch);
      assert.ok(services.handshake);
      assert.ok(services.writeback);
      assert.ok(services.preemption);

      // Context still available after service creation
      assert.equal(getTenantId(), "factory-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("individual factory services work within context propagation", () => {
  const workspace = createTempWorkspace("aa-int-individual-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ workspaceId: "factory-workspace" });

    provideContext(snapshot, () => {
      const dispatch = runtimeFactories.createDispatchService(backend);
      const handshake = runtimeFactories.createHandshakeService(backend);
      const writeback = runtimeFactories.createWritebackService(backend);
      const preemption = runtimeFactories.createPreemptionService(backend);

      assert.ok(dispatch);
      assert.ok(handshake);
      assert.ok(writeback);
      assert.ok(preemption);

      assert.ok(hasWorkspaceContext());
      assert.equal(getWorkspaceId(), "factory-workspace");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("withContextPatch works with factory services", () => {
  const workspace = createTempWorkspace("aa-int-patch-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "original-tenant", workspaceId: "original-workspace" });

    provideContext(snapshot, () => {
      // Create original services
      const originalServices = createRuntimeServices(backend);
      assert.ok(originalServices.dispatch);
      assert.equal(getTenantId(), "original-tenant");

      // Patch context and create new services
      const patchedServices = withContextPatch(
        { tenantId: "patched-tenant" },
        () => {
          const services = createRuntimeServices(backend);
          assert.ok(services.dispatch);
          assert.equal(getTenantId(), "patched-tenant");
          return services;
        },
      );

      assert.ok(patchedServices.dispatch);

      // Original context should be restored
      assert.equal(getTenantId(), "original-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Nested context with factory services
// ---------------------------------------------------------------------------

test("nested context with factory services preserves isolation", () => {
  const workspace = createTempWorkspace("aa-int-nested-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const outerSnapshot = createSnapshot({ tenantId: "outer-tenant" });
    const innerSnapshot = createSnapshot({ tenantId: "inner-tenant", workspaceId: "inner-workspace" });

    provideContext(outerSnapshot, () => {
      const outerServices = createRuntimeServices(backend);
      assert.ok(outerServices.dispatch);
      assert.equal(getTenantId(), "outer-tenant");

      provideContext(innerSnapshot, () => {
        const innerServices = createRuntimeServices(backend);
        assert.ok(innerServices.dispatch);
        assert.equal(getTenantId(), "inner-tenant");
        assert.equal(getWorkspaceId(), "inner-workspace");
      });

      // Outer context restored
      assert.equal(getTenantId(), "outer-tenant");
      assert.ok(outerServices.dispatch);
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Async context propagation with factory services
// ---------------------------------------------------------------------------

test("async context propagation works with factory services", async () => {
  const workspace = createTempWorkspace("aa-int-async-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "async-tenant", workspaceId: "async-workspace" });

    await provideContext(snapshot, async () => {
      const services = createRuntimeServices(backend);
      assert.ok(services.dispatch);

      // Simulate async operation
      await new Promise<void>((resolve) => setImmediate(resolve));

      // Context should still be available
      assert.ok(hasTenantContext());
      assert.equal(getTenantId(), "async-tenant");
      assert.equal(getWorkspaceId(), "async-workspace");

      return services;
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("async context patch with factory services", async () => {
  const workspace = createTempWorkspace("aa-int-async-patch-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "async-original" });

    const result = await provideContext(snapshot, async () => {
      const services1 = createRuntimeServices(backend);
      assert.equal(getTenantId(), "async-original");

      return withContextPatch({ tenantId: "async-patched" }, async () => {
        const services2 = createRuntimeServices(backend);
        assert.equal(getTenantId(), "async-patched");

        await new Promise<void>((resolve) => setImmediate(resolve));

        return {
          originalServices: services1,
          patchedServices: services2,
        };
      });
    });

    assert.ok(result.originalServices.dispatch);
    assert.ok(result.patchedServices.dispatch);

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Context isolation verification
// ---------------------------------------------------------------------------

test("context is properly isolated between test sections", () => {
  const workspace = createTempWorkspace("aa-int-isolation-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    // First context
    const snapshot1 = createSnapshot({ tenantId: "isolation-tenant-1" });
    provideContext(snapshot1, () => {
      const services1 = createRuntimeServices(backend);
      assert.ok(services1.dispatch);
      assert.equal(getTenantId(), "isolation-tenant-1");
    });

    // Second context (should not leak from first)
    const snapshot2 = createSnapshot({ tenantId: "isolation-tenant-2", workspaceId: "isolation-workspace-2" });
    provideContext(snapshot2, () => {
      const services2 = createRuntimeServices(backend);
      assert.ok(services2.dispatch);
      assert.equal(getTenantId(), "isolation-tenant-2");
      assert.equal(getWorkspaceId(), "isolation-workspace-2");
    });

    // Verify no context leaks outside
    const leakedContext = getContextOrNull();
    assert.equal(leakedContext, null);

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Service creation consistency
// ---------------------------------------------------------------------------

test("multiple service creations within same context return valid services", () => {
  const workspace = createTempWorkspace("aa-int-multi-create-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot();

    provideContext(snapshot, () => {
      const dispatch1 = runtimeFactories.createDispatchService(backend);
      const dispatch2 = runtimeFactories.createDispatchService(backend);
      const handshake1 = runtimeFactories.createHandshakeService(backend);
      const handshake2 = runtimeFactories.createHandshakeService(backend);

      assert.ok(dispatch1);
      assert.ok(dispatch2);
      assert.ok(handshake1);
      assert.ok(handshake2);

      // All should be functional (different instances)
      assert.ok(dispatch1 !== dispatch2);
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Error handling in context
// ---------------------------------------------------------------------------

test("factory throws are properly propagated within context", () => {
  const workspace = createTempWorkspace("aa-int-error-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "error-tenant" });

    provideContext(snapshot, () => {
      // This should throw due to missing shadow sqlite on postgres backend
      const invalidBackend = {
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
        async migrate(): Promise<void> { return undefined; },
        async close(): Promise<void> { return undefined; },
      } as unknown as PostgresAuthoritativeStorageBackendHandle;

      assert.throws(
        () => createRuntimeServices(invalidBackend),
        /storage\.postgres_shadow_sqlite_required_for_runtime_services/,
      );

      // Context should still be valid after throw
      assert.equal(getTenantId(), "error-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});
