import assert from "node:assert/strict";
import test from "node:test";

import { createAsyncRepositoryRegistry } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repository-registry.js";
import type { AsyncSqlConnection, AsyncSqlDatabase } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";

function createConnection(): AsyncSqlConnection {
  return {
    async query() {
      return { rows: [], rowCount: 0 };
    },
    async queryOne() {
      return undefined;
    },
    async execute() {
      return 0;
    },
  };
}

test("async repository registry creates all repositories from connection", () => {
  const registry = createAsyncRepositoryRegistry(createConnection());
  assert.ok(registry.approval);
  assert.ok(registry.artifact);
  assert.ok(registry.billing);
  assert.ok(registry.dispatch);
  assert.ok(registry.division);
  assert.ok(registry.event);
  assert.ok(registry.evolution);
  assert.ok(registry.execution);
  assert.ok(registry.intelligence);
  assert.ok(registry.lease);
  assert.ok(registry.lock);
  assert.ok(registry.marketplace);
  assert.ok(registry.memory);
  assert.ok(registry.operations);
  assert.ok(registry.organization);
  assert.ok(registry.release);
  assert.ok(registry.secret);
  assert.ok(registry.session);
  assert.ok(registry.task);
  assert.ok(registry.worker);
  assert.ok(registry.workflow);
});

test("async repository registry accepts AsyncSqlDatabase wrapper", () => {
  const connection = createConnection();
  const registry = createAsyncRepositoryRegistry({
    filePath: ":memory:",
    asyncConnection: connection,
    async migrate() {},
    async getSchemaStatus() {
      return { currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] };
    },
    async assertSchemaCurrent() {},
    async integrityCheck() {
      return ["ok"];
    },
    async transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(connection);
    },
    async readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(connection);
    },
    async close() {},
  } as AsyncSqlDatabase);
  assert.ok(registry.task);
  assert.ok(registry.secret);
});

test("async repository registry creates all 22 repositories", () => {
  const registry = createAsyncRepositoryRegistry(createConnection());
  const repoKeys = [
    "approval", "artifact", "billing", "dispatch", "division", "event",
    "evolution", "execution", "intelligence", "lease", "lock", "marketplace",
    "memory", "operations", "organization", "release", "secret", "session",
    "task", "worker", "workflow",
  ];
  assert.equal(repoKeys.length, 21);
  repoKeys.forEach((key) => {
    assert.ok(registry[key as keyof typeof registry] !== undefined, `Missing repository: ${key}`);
  });
});

test("async repository registry resolves connection from AsyncSqlDatabase wrapper", () => {
  const connection = createConnection();
  const wrapper = {
    filePath: ":memory:",
    asyncConnection: connection,
    async migrate() {},
    async getSchemaStatus() {
      return { currentVersion: 1, expectedVersion: 1, upToDate: true, pendingVersions: [], checksumMismatches: [] };
    },
    async assertSchemaCurrent() {},
    async integrityCheck() {
      return ["ok"];
    },
    async transaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(connection);
    },
    async readTransaction<T>(work: (conn: AsyncSqlConnection) => Promise<T>): Promise<T> {
      return work(connection);
    },
    async close() {},
  } as AsyncSqlDatabase;
  const registry = createAsyncRepositoryRegistry(wrapper);
  assert.ok(registry.task);
  assert.ok(registry.secret);
});

test("async repository registry resolves connection from plain AsyncSqlConnection", () => {
  const connection = createConnection();
  const registry = createAsyncRepositoryRegistry(connection);
  assert.ok(registry.task);
  assert.ok(registry.execution);
});
