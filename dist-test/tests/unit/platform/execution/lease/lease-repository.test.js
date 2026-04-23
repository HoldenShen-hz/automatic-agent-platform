import assert from "node:assert/strict";
import test from "node:test";
import { createLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository.js";
import { SqliteLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-sqlite.js";
import { PostgresLeaseRepository } from "../../../../../src/platform/execution/lease/lease-repository-postgres.js";
test("createLeaseRepository returns SqliteLeaseRepository for sqlite backend", () => {
    const backend = {
        driver: "sqlite",
        sql: {
            connection: { exec: () => { }, prepare: () => ({ run: () => { } }) },
            filePath: ":memory:",
            backendType: "sqlite",
            migrate: () => { },
            getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 }),
            assertSchemaCurrent: () => { },
            integrityCheck: () => [],
            healthCheck: () => Promise.resolve(true),
            transaction: (work) => work(),
            readTransaction: (work) => work(),
        },
    };
    const repo = createLeaseRepository(backend);
    assert.ok(repo instanceof SqliteLeaseRepository);
});
test("createLeaseRepository returns PostgresLeaseRepository for postgres backend", () => {
    const backend = {
        driver: "postgres",
        asyncSql: {
            asyncConnection: {
                query: async () => ({ rows: [] }),
                execute: async () => { },
            },
            backendType: "postgres",
        },
    };
    const repo = createLeaseRepository(backend);
    assert.ok(repo instanceof PostgresLeaseRepository);
});
test("createLeaseRepository interface is satisfied - SqliteLeaseRepository has all required methods", () => {
    const backend = {
        driver: "sqlite",
        sql: {
            connection: { exec: () => { }, prepare: () => ({ run: () => { } }) },
            filePath: ":memory:",
            backendType: "sqlite",
            migrate: () => { },
            getSchemaStatus: () => ({ currentVersion: 1, pendingMigrations: 0 }),
            assertSchemaCurrent: () => { },
            integrityCheck: () => [],
            healthCheck: () => Promise.resolve(true),
            transaction: (work) => work(),
            readTransaction: (work) => work(),
        },
    };
    const repo = createLeaseRepository(backend);
    // Verify all required methods exist
    assert.equal(typeof repo.insertLease, "function");
    assert.equal(typeof repo.getLease, "function");
    assert.equal(typeof repo.getActiveLeaseForExecution, "function");
    assert.equal(typeof repo.getLatestFencingToken, "function");
    assert.equal(typeof repo.listExecutionLeases, "function");
    assert.equal(typeof repo.updateLeaseStatus, "function");
    assert.equal(typeof repo.updateLeaseHeartbeat, "function");
    assert.equal(typeof repo.updateLeaseRelease, "function");
    assert.equal(typeof repo.insertLeaseAudit, "function");
    assert.equal(typeof repo.listLeaseAudits, "function");
});
test("createLeaseRepository interface is satisfied - PostgresLeaseRepository has all required methods", () => {
    const backend = {
        driver: "postgres",
        asyncSql: {
            asyncConnection: {
                query: async () => ({ rows: [] }),
                execute: async () => { },
            },
            backendType: "postgres",
        },
    };
    const repo = createLeaseRepository(backend);
    // Verify all required methods exist
    assert.equal(typeof repo.insertLease, "function");
    assert.equal(typeof repo.getLease, "function");
    assert.equal(typeof repo.getActiveLeaseForExecution, "function");
    assert.equal(typeof repo.getLatestFencingToken, "function");
    assert.equal(typeof repo.listExecutionLeases, "function");
    assert.equal(typeof repo.updateLeaseStatus, "function");
    assert.equal(typeof repo.updateLeaseHeartbeat, "function");
    assert.equal(typeof repo.updateLeaseRelease, "function");
    assert.equal(typeof repo.insertLeaseAudit, "function");
    assert.equal(typeof repo.listLeaseAudits, "function");
});
//# sourceMappingURL=lease-repository.test.js.map