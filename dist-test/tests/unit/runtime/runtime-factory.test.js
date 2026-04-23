import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";
import { createRuntimeServices, runtimeFactories } from "../../../src/platform/execution/execution-engine/runtime-factory.js";
import { createExecutionLeaseService } from "../../../src/platform/execution/lease/execution-lease-factory.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";
function createPostgresHandle(options) {
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
            asyncConnection: {},
            transaction: async (work) => work(),
            close: async () => undefined,
        },
        asyncRepos: {},
        postgres: {
            filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        },
        ...(options.shadowSqlite ? { shadowSqlite: options.shadowSqlite } : {}),
        async migrate() {
            return undefined;
        },
        async close() {
            return undefined;
        },
    };
}
test("runtime factory creates services for postgres backend when shadow sqlite compatibility is available", () => {
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
    }
    finally {
        cleanupPath(workspace);
    }
});
test("runtime factory fail-closes postgres backend without shadow sqlite compatibility", () => {
    const unsupportedSql = {
        filePath: "postgresql://agent:secret@postgres.internal/agent_company_os?sslmode=require",
        backendType: "postgres",
        connection: {},
        migrate() {
            throw new Error("unsupported");
        },
        getSchemaStatus() {
            throw new Error("unsupported");
        },
        assertSchemaCurrent() {
            throw new Error("unsupported");
        },
        integrityCheck() {
            throw new Error("unsupported");
        },
        transaction() {
            throw new Error("unsupported");
        },
        readTransaction() {
            throw new Error("unsupported");
        },
        healthCheck: async () => false,
    };
    const backend = createPostgresHandle({
        sql: unsupportedSql,
    });
    assert.throws(() => createRuntimeServices(backend), /storage\.postgres_shadow_sqlite_required_for_runtime_services/);
    assert.throws(() => runtimeFactories.createDispatchService(backend), /storage\.postgres_shadow_sqlite_required_for_dispatch_service/);
    assert.throws(() => createExecutionLeaseService(backend), /storage\.postgres_shadow_sqlite_required_for_execution_lease_service/);
});
//# sourceMappingURL=runtime-factory.test.js.map