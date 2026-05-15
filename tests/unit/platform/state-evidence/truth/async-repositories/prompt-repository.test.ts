import assert from "node:assert/strict";
import test from "node:test";

import { AsyncPromptRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/prompt-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { PromptBundleRecord, PromptVersionRecord, PromptAbTestRecord } from "../../../../../../src/platform/contracts/types/domain.js";

type SqlCall = {
  method: "query" | "queryOne" | "execute";
  sql: string;
  params: unknown[];
};

function createConnection(options: {
  queryRows?: unknown[][];
  queryOneRows?: unknown[];
  executeResults?: number[];
} = {}) {
  const calls: SqlCall[] = [];
  let queryIndex = 0;
  let queryOneIndex = 0;
  let executeIndex = 0;

  const connection: AsyncSqlConnection = {
    async query<T>(sql: string, ...params: unknown[]): Promise<AsyncQueryResult<T>> {
      calls.push({ method: "query", sql, params });
      const rows = (options.queryRows?.[queryIndex++] ?? []) as T[];
      return { rows, rowCount: rows.length, changes: rows.length };
    },
    async queryOne<T>(sql: string, ...params: unknown[]): Promise<T | undefined> {
      calls.push({ method: "queryOne", sql, params });
      return options.queryOneRows?.[queryOneIndex++] as T | undefined;
    },
    async execute(sql: string, ...params: unknown[]): Promise<number> {
      calls.push({ method: "execute", sql, params });
      return options.executeResults?.[executeIndex++] ?? 1;
    },
  };

  return { connection, calls };
}

const now = "2026-04-23T10:00:00.000Z";

function promptBundleRecord(overrides: Partial<PromptBundleRecord> = {}): PromptBundleRecord {
  return {
    bundleId: "bundle-1",
    name: "test-prompt",
    version: "1.0.0",
    domain: "coding",
    taskType: "implementation",
    packId: null,
    systemPromptContent: "You are a helpful assistant.",
    userPromptContent: null,
    fewShotExamplesJson: null,
    constraintsJson: "{}",
    metadataJson: "{}",
    deprecated: 0,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function promptVersionRecord(overrides: Partial<PromptVersionRecord> = {}): PromptVersionRecord {
  return {
    versionId: "ver-1",
    bundleId: "bundle-1",
    version: "1.0.0",
    isCurrent: 1,
    trafficWeight: 100,
    trafficAllocationJson: null,
    createdAt: now,
    deprecatedAt: null,
    ...overrides,
  };
}

function promptAbTestRecord(overrides: Partial<PromptAbTestRecord> = {}): PromptAbTestRecord {
  return {
    testId: "test-1",
    bundleId: "bundle-1",
    testName: "A/B Test",
    controlVersion: "1.0.0",
    treatmentVersion: "2.0.0",
    trafficSplitPercent: 50,
    status: "running",
    startTime: now,
    endTime: null,
    metricsJson: "{}",
    resultsJson: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// === InsertPromptBundle Tests ===

test("AsyncPromptRepository insertPromptBundle inserts bundle", async () => {
  const bundle = promptBundleRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptBundle(bundle);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO prompt_bundles/);
});

test("AsyncPromptRepository insertPromptBundle uses correct parameters", async () => {
  const bundle = promptBundleRecord({ name: "my-bundle", version: "2.0" });
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptBundle(bundle);

  assert.equal(calls[0]!.params[1], "my-bundle");
  assert.equal(calls[0]!.params[2], "2.0");
});

// === GetPromptBundle Tests ===

test("AsyncPromptRepository getPromptBundle returns bundle when found", async () => {
  const bundle = promptBundleRecord();
  const { connection, calls } = createConnection({ queryOneRows: [bundle] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptBundle("bundle-1");

  assert.deepEqual(result, bundle);
  assert.match(calls[0]?.sql ?? "", /FROM prompt_bundles/);
});

test("AsyncPromptRepository getPromptBundle returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptBundle("nonexistent");

  assert.equal(result, null);
});

// === GetPromptBundleByNameVersion Tests ===

test("AsyncPromptRepository getPromptBundleByNameVersion returns bundle", async () => {
  const bundle = promptBundleRecord();
  const { connection, calls } = createConnection({ queryOneRows: [bundle] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptBundleByNameVersion("test-prompt", "1.0.0");

  assert.deepEqual(result, bundle);
  assert.match(calls[0]?.sql ?? "", /WHERE name = \$1 AND version = \$2/);
});

// === ListPromptBundlesByDomain Tests ===

test("AsyncPromptRepository listPromptBundlesByDomain returns bundles", async () => {
  const bundle = promptBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[bundle]] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.listPromptBundlesByDomain("coding");

  assert.deepEqual(result, [bundle]);
  assert.match(calls[0]?.sql ?? "", /WHERE domain = \$1/);
});

test("AsyncPromptRepository listPromptBundlesByDomain filters by taskType", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncPromptRepository(connection);

  await repo.listPromptBundlesByDomain("coding", "implementation");

  assert.match(calls[0]!.sql, /task_type = \$2/);
});

test("AsyncPromptRepository listPromptBundlesByDomain excludes deprecated", async () => {
  const { connection, calls } = createConnection({ queryRows: [[]] });
  const repo = new AsyncPromptRepository(connection);

  await repo.listPromptBundlesByDomain("coding");

  assert.match(calls[0]!.sql, /deprecated = 0/);
});

// === ListActivePromptBundles Tests ===

test("AsyncPromptRepository listActivePromptBundles returns bundles", async () => {
  const bundle = promptBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[bundle]] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.listActivePromptBundles();

  assert.deepEqual(result, [bundle]);
  assert.match(calls[0]?.sql ?? "", /deprecated = 0/);
});

// === InsertPromptVersion Tests ===

test("AsyncPromptRepository insertPromptVersion inserts version", async () => {
  const version = promptVersionRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptVersion(version);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO prompt_versions/);
});

// === SetCurrentVersion Tests ===

test("AsyncPromptRepository setCurrentVersion updates versions", async () => {
  const { connection, calls } = createConnection({ executeResults: [1, 1] });
  const repo = new AsyncPromptRepository(connection);

  await repo.setCurrentVersion("bundle-1", "ver-1");

  assert.equal(calls.length, 2);
  assert.match(calls[0]!.sql, /is_current = 0/);
  assert.match(calls[0]!.sql, /bundle_id = \$1/);
  assert.match(calls[1]!.sql, /is_current = 1/);
});

// === GetPromptVersion Tests ===

test("AsyncPromptRepository getPromptVersion returns version", async () => {
  const version = promptVersionRecord();
  const { connection } = createConnection({ queryOneRows: [version] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptVersion("ver-1");

  assert.deepEqual(result, version);
});

// === ListPromptVersions Tests ===

test("AsyncPromptRepository listPromptVersions returns versions", async () => {
  const version = promptVersionRecord();
  const { connection, calls } = createConnection({ queryRows: [[version]] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.listPromptVersions("bundle-1");

  assert.deepEqual(result, [version]);
  assert.match(calls[0]?.sql ?? "", /WHERE bundle_id = \$1/);
});

// === GetCurrentVersion Tests ===

test("AsyncPromptRepository getCurrentVersion returns current version", async () => {
  const version = promptVersionRecord({ isCurrent: 1 });
  const { connection, calls } = createConnection({ queryOneRows: [version] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getCurrentVersion("bundle-1");

  assert.deepEqual(result, version);
  assert.match(calls[0]?.sql ?? "", /is_current = 1/);
});

// === InsertPromptAbTest Tests ===

test("AsyncPromptRepository insertPromptAbTest inserts test", async () => {
  const test = promptAbTestRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncPromptRepository(connection);

  await repo.insertPromptAbTest(test);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO prompt_ab_tests/);
});

// === GetPromptAbTest Tests ===

test("AsyncPromptRepository getPromptAbTest returns test", async () => {
  const test = promptAbTestRecord();
  const { connection } = createConnection({ queryOneRows: [test] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptAbTest("test-1");

  assert.deepEqual(result, test);
});

test("AsyncPromptRepository getPromptAbTest returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.getPromptAbTest("nonexistent");

  assert.equal(result, null);
});

// === ListPromptAbTestsByBundle Tests ===

test("AsyncPromptRepository listPromptAbTestsByBundle returns tests", async () => {
  const test = promptAbTestRecord();
  const { connection, calls } = createConnection({ queryRows: [[test]] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.listPromptAbTestsByBundle("bundle-1");

  assert.deepEqual(result, [test]);
  assert.match(calls[0]?.sql ?? "", /WHERE bundle_id = \$1/);
});

// === ListActiveAbTests Tests ===

test("AsyncPromptRepository listActiveAbTests returns running tests", async () => {
  const test = promptAbTestRecord({ status: "running" });
  const { connection, calls } = createConnection({ queryRows: [[test]] });
  const repo = new AsyncPromptRepository(connection);

  const result = await repo.listActiveAbTests();

  assert.deepEqual(result, [test]);
  assert.match(calls[0]?.sql ?? "", /status = 'running'/);
});