import assert from "node:assert/strict";
import test from "node:test";

import { MigrationRunner } from "../../../../../src/platform/state-evidence/truth/migration-runner.js";
import type { AuthoritativeStorageBackendHandle } from "../../../../../src/platform/state-evidence/truth/storage-backend-factory.js";

test("MigrationRunner status returns sqlite schema status", async () => {
  const runner = new MigrationRunner({
    driver: "sqlite",
    runtimeProfile: { driver: "sqlite", environment: "dev", issues: [], postgres: null },
    sql: {
      getSchemaStatus: () => ({
        currentVersion: 2,
        expectedVersion: 3,
        upToDate: false,
        pendingVersions: [3],
        checksumMismatches: [],
      }),
    },
    asyncSql: {} as never,
    asyncRepos: {} as never,
    sqlite: {} as never,
    migrate: () => {},
    close: () => {},
  } as unknown as AuthoritativeStorageBackendHandle);

  const result = await runner.status();
  assert.equal(result.action, "status");
  assert.equal(result.driver, "sqlite");
  assert.equal(result.status.currentVersion, 2);
  assert.deepEqual(result.status.pendingVersions, [3]);
  assert.equal(result.rollbackSupported, false);
});

test("MigrationRunner up runs storage migrate before reading status", async () => {
  const calls: string[] = [];
  const runner = new MigrationRunner({
    driver: "postgres",
    runtimeProfile: {
      driver: "postgres",
      environment: "dev",
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
    postgres: {
      getSchemaStatus: async () => {
        calls.push("status");
        return {
          currentVersion: 4,
          expectedVersion: 4,
          upToDate: true,
          pendingVersions: [],
          checksumMismatches: [],
        };
      },
      healthCheck: async () => true,
    },
    migrate: async () => {
      calls.push("migrate");
    },
    close: async () => {},
  } as unknown as AuthoritativeStorageBackendHandle);

  const result = await runner.up();
  assert.deepEqual(calls, ["migrate", "status"]);
  assert.equal(result.action, "up");
  assert.equal(result.status.upToDate, true);
});

test("MigrationRunner down reports fail-closed rollback status", async () => {
  const runner = new MigrationRunner({
    driver: "sqlite",
    runtimeProfile: { driver: "sqlite", environment: "dev", issues: [], postgres: null },
    sql: {
      getSchemaStatus: () => ({
        currentVersion: 1,
        expectedVersion: 1,
        upToDate: true,
        pendingVersions: [],
        checksumMismatches: [],
      }),
    },
    asyncSql: {} as never,
    asyncRepos: {} as never,
    sqlite: {} as never,
    migrate: () => {},
    close: () => {},
  } as unknown as AuthoritativeStorageBackendHandle);

  const result = await runner.down();
  assert.equal(result.action, "down");
  assert.equal(result.rollbackSupported, false);
  assert.match(result.rollbackReason ?? "", /not supported/);
});
