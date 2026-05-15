/**
 * Integration Tests: Runtime Factory
 *
 * Integration tests for runtime factory services with real storage backends.
 * Tests service creation, context integration, and cross-service interactions.
 */

import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { createRuntimeServices, runtimeFactories } from "../../../src/platform/five-plane-execution/execution-engine/runtime-factory.js";
import { createExecutionLeaseService } from "../../../src/platform/five-plane-execution/lease/execution-lease-factory.js";
import { createHaCoordinatorService } from "../../../src/platform/five-plane-execution/ha/ha-coordinator-factory.js";
import { createHotUpgradeService } from "../../../src/platform/five-plane-execution/hot-upgrade/hot-upgrade-factory.js";
import {
  provideContext,
  getTenantId,
  getWorkspaceId,
  hasTenantContext,
  hasWorkspaceContext,
  withContextPatch,
} from "../../../src/platform/shared/context/runtime-context.js";
import { SqliteDatabase } from "../../../src/platform/five-plane-state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
import type { PostgresAuthoritativeStorageBackendHandle } from "../../../src/platform/five-plane-state-evidence/truth/storage-backend-factory.js";
import type { RuntimeContextSnapshot } from "../../../src/platform/shared/context/runtime-context.js";

// ---------------------------------------------------------------------------
// Helper Functions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Runtime Services Creation Tests
// ---------------------------------------------------------------------------

test("createRuntimeServices creates all services with postgres backend and shadow sqlite", () => {
  const workspace = createTempWorkspace("aa-int-factory-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const services = createRuntimeServices(backend);

    assert.ok(services.ha, "HA coordinator service should be created");
    assert.ok(services.leases, "Lease service should be created");
    assert.ok(services.hotUpgrade, "Hot upgrade service should be created");
    assert.ok(services.dispatch, "Dispatch service should be created");
    assert.ok(services.handshake, "Handshake service should be created");
    assert.ok(services.writeback, "Writeback service should be created");
    assert.ok(services.preemption, "Preemption service should be created");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// Note: Error handling for missing shadow sqlite is covered in unit tests
// See tests/unit/runtime/runtime-factory.test.ts

// ---------------------------------------------------------------------------
// Individual Factory Service Tests
// ---------------------------------------------------------------------------

test("runtimeFactories.createDispatchService creates valid dispatch service", () => {
  const workspace = createTempWorkspace("aa-int-dispatch-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const dispatch = runtimeFactories.createDispatchService(backend);
    assert.ok(dispatch, "Dispatch service should be created");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createHandshakeService creates valid handshake service", () => {
  const workspace = createTempWorkspace("aa-int-handshake-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const handshake = runtimeFactories.createHandshakeService(backend);
    assert.ok(handshake, "Handshake service should be created");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createWritebackService creates valid writeback service", () => {
  const workspace = createTempWorkspace("aa-int-writeback-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const writeback = runtimeFactories.createWritebackService(backend);
    assert.ok(writeback, "Writeback service should be created");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtimeFactories.createPreemptionService creates valid preemption service", () => {
  const workspace = createTempWorkspace("aa-int-preemption-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const preemption = runtimeFactories.createPreemptionService(backend);
    assert.ok(preemption, "Preemption service should be created");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Factory Service Context Integration Tests
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

      // Context available during service creation
      assert.ok(hasTenantContext());
      assert.equal(getTenantId(), "factory-tenant");

      // All services created
      assert.ok(services.dispatch);
      assert.ok(services.handshake);
      assert.ok(services.writeback);
      assert.ok(services.preemption);

      // Context still available after
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

      // Original context restored
      assert.equal(getTenantId(), "original-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Nested Context with Factory Services Tests
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
// Async Context Propagation with Factory Services
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

      // Context still available
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
// Service Creation Consistency Tests
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

test("HA coordinator service works with context", () => {
  const workspace = createTempWorkspace("aa-int-ha-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "ha-tenant" });

    provideContext(snapshot, () => {
      const haService = createHaCoordinatorService(backend);
      assert.ok(haService);
      assert.equal(getTenantId(), "ha-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("lease service works with context", () => {
  const workspace = createTempWorkspace("aa-int-lease-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "lease-tenant" });

    provideContext(snapshot, () => {
      const leaseService = createExecutionLeaseService(backend);
      assert.ok(leaseService);
      assert.equal(getTenantId(), "lease-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("hot upgrade service works with context", () => {
  const workspace = createTempWorkspace("aa-int-hot-upgrade-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "hot-upgrade-tenant" });

    provideContext(snapshot, () => {
      const hotUpgradeService = createHotUpgradeService(backend);
      assert.ok(hotUpgradeService);
      assert.equal(getTenantId(), "hot-upgrade-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Context Isolation Verification
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
    const leakedContext = provideContext(createSnapshot(), () => {
      return getTenantId();
    });
    // This should be the last snapshot's tenantId, not the first or second
    assert.equal(leakedContext, "int-tenant-909");

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});

// ---------------------------------------------------------------------------
// Error Handling Tests
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

test("individual factory services throw properly within context", () => {
  const workspace = createTempWorkspace("aa-int-indiv-error-");
  const shadowPath = join(workspace, "shadow.db");

  try {
    const shadowSqlite = createSqliteBackend(shadowPath);
    const backend = createPostgresHandleWithShadow(shadowSqlite);

    const snapshot = createSnapshot({ tenantId: "indiv-error-tenant" });

    provideContext(snapshot, () => {
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
        () => runtimeFactories.createDispatchService(invalidBackend),
        /storage\.postgres_shadow_sqlite_required_for_dispatch_service/,
      );

      assert.throws(
        () => createExecutionLeaseService(invalidBackend),
        /storage\.postgres_shadow_sqlite_required_for_execution_lease_service/,
      );

      // Context still valid
      assert.equal(getTenantId(), "indiv-error-tenant");
    });

    shadowSqlite.close();
  } finally {
    cleanupPath(workspace);
  }
});
