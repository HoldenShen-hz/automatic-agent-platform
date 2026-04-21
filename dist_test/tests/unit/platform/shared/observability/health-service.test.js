import assert from "node:assert/strict";
import test from "node:test";
import { HealthService } from "../../../../../src/platform/shared/observability/health-service.js";
/**
 * Mock AuthoritativeSqlDatabase for testing health-service routing logic.
 */
function createMockDb(overrides = {}) {
    return {
        filePath: "/tmp/test.db",
        backendType: "sqlite",
        connection: {
            exec: () => { },
            prepare: () => ({ get: () => ({ count: 0 }) }),
        },
        migrate: () => { },
        getSchemaStatus: () => ({ current: 1, target: 1, missing: [] }),
        assertSchemaCurrent: () => { },
        integrityCheck: () => [],
        healthCheck: () => Promise.resolve(true),
        transaction: (work) => work(),
        readTransaction: (work) => work(),
        ...overrides,
    };
}
/**
 * Minimal mock for AuthoritativeTaskStore — only needed for buildQueueGovernanceSummary
 * and buildWorkerHealthSummary. HealthService calls store.worker.listExecutionTicketsByStatuses
 * and store.worker.listWorkerSnapshots / listStaleWorkerSnapshots.
 */
function createMockStore(overrides = {}) {
    return {
        worker: {
            listExecutionTicketsByStatuses: () => [],
            listWorkerSnapshots: () => [],
            listStaleWorkerSnapshots: () => [],
        },
        ...overrides,
    };
}
test("getReportAsync delegates postgres health check", async () => {
    const mockDb = createMockDb({
        backendType: "postgres",
        healthCheck: async () => true,
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = await service.getReportAsync();
    assert.equal(report.dbWritable, true, "postgres backend should use async healthCheck");
});
test("checkDbWritable returns true for sqlite backendType when probe succeeds", () => {
    const execCalls = [];
    const mockDb = createMockDb({
        backendType: "sqlite",
        connection: {
            exec: (sql) => { execCalls.push(sql); },
            prepare: () => ({ get: () => ({ count: 0 }) }),
        },
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = service.getReport();
    assert.equal(report.dbWritable, true, "sqlite backend should report dbWritable=true");
    assert.ok(execCalls.length > 0, "sqlite probe should have called exec");
});
test("checkDbWritable returns false for sqlite backendType when probe throws", () => {
    const mockDb = createMockDb({
        backendType: "sqlite",
        connection: {
            exec: () => { throw new Error("read-only filesystem"); },
            prepare: () => ({ get: () => ({ count: 0 }) }),
        },
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = service.getReport();
    assert.equal(report.dbWritable, false, "sqlite backend with failing probe should report dbWritable=false");
});
test("getReport returns status unhealthy when sqlite probe fails", () => {
    const mockDb = createMockDb({
        backendType: "sqlite",
        connection: {
            exec: () => { throw new Error("read-only"); },
            prepare: () => ({ get: () => ({ count: 0 }) }),
        },
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = service.getReport();
    assert.equal(report.status, "unhealthy", "status should be unhealthy when sqlite probe fails");
    assert.ok(report.findings.includes("db_not_writable"), "findings should include db_not_writable");
});
test("getReport returns degradationMode read_only_operations_only when sqlite probe fails", () => {
    const mockDb = createMockDb({
        backendType: "sqlite",
        connection: {
            exec: () => { throw new Error("read-only"); },
            prepare: () => ({ get: () => ({ count: 0 }) }),
        },
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = service.getReport();
    assert.equal(report.degradationMode, "read_only_operations_only", "degradationMode should be read_only_operations_only");
});
test("getReportAsync returns unhealthy when postgres health check fails", async () => {
    const mockDb = createMockDb({
        backendType: "postgres",
        healthCheck: async () => false,
    });
    const mockStore = createMockStore();
    const service = new HealthService(mockDb, mockStore);
    const report = await service.getReportAsync();
    assert.equal(report.status, "unhealthy");
    assert.equal(report.dbWritable, false);
});
//# sourceMappingURL=health-service.test.js.map