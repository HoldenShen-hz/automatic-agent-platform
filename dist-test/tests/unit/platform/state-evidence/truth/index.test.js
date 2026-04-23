import assert from "node:assert/strict";
import test from "node:test";
// Re-export test for barrel file
import { openAuthoritativeStorageBackend, } from "../../../../../src/platform/state-evidence/truth/index.js";
test("StorageDriver type accepts valid values", () => {
    const drivers = ["sqlite", "postgres"];
    assert.equal(drivers.length, 2);
});
test("StorageBackendConfigValidationOptions structure is correct", () => {
    const options = {
        environment: "test",
    };
    assert.equal(options.environment, "test");
});
test("PostgresStorageBackendRuntimeProfile structure is correct", () => {
    const profile = {
        dsnConfigured: true,
        dsnSource: "env",
        dsnValue: "postgresql://agent:secret@postgres.internal/testdb?sslmode=require",
        host: "localhost",
        database: "testdb",
        sslmode: "require",
        poolMin: 2,
        poolMax: 10,
        dualRun: false,
        shadowSqlitePath: null,
        schema: "public",
    };
    assert.equal(profile.dsnConfigured, true);
    assert.equal(profile.host, "localhost");
    assert.equal(profile.poolMin, 2);
});
test("StorageBackendRuntimeProfile structure is correct", () => {
    const profile = {
        environment: "development",
        driver: "sqlite",
        issues: [],
        postgres: null,
    };
    assert.equal(profile.environment, "development");
    assert.equal(profile.driver, "sqlite");
    assert.deepEqual(profile.issues, []);
});
test("StorageBackendRuntimeProfile with postgres", () => {
    const profile = {
        environment: "production",
        driver: "postgres",
        issues: [],
        postgres: {
            dsnConfigured: true,
            dsnSource: "env",
            dsnValue: "postgresql://agent:secret@db.example.com/prod?sslmode=require",
            host: "db.example.com",
            database: "prod",
            sslmode: "require",
            poolMin: 5,
            poolMax: 20,
            dualRun: true,
            shadowSqlitePath: "/tmp/shadow.db",
            schema: "public",
        },
    };
    assert.equal(profile.driver, "postgres");
    assert.ok(profile.postgres !== null);
    assert.equal(profile.postgres.host, "db.example.com");
});
test("storage barrel exports backend opener", () => {
    assert.equal(typeof openAuthoritativeStorageBackend, "function");
});
//# sourceMappingURL=index.test.js.map