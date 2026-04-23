// @ts-nocheck
import assert from "node:assert/strict";
import test from "node:test";

import { AsyncOperationsRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/operations-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/state-evidence/truth/async-sql-database.js";
import type {
  AnalyticsFactRecord,
  ArchiveBundleRecord,
  DataMovementJobRecord,
  ReplayDatasetRecord,
} from "../../../../../../src/platform/contracts/types/domain.js";

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

function analyticsFactRecord(overrides: Partial<AnalyticsFactRecord> = {}): AnalyticsFactRecord {
  return {
    factId: "fact-1",
    namespaceId: "ns-1",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    metricName: "task_completion",
    dimensionJson: '{"region":"us-east"}',
    value: 42,
    windowStart: "2026-04-01T00:00:00.000Z",
    windowEnd: "2026-04-01T23:59:59.999Z",
    sourceRef: "task_system",
    capturedAt: now,
    ...overrides,
  };
}

function archiveBundleRecord(overrides: Partial<ArchiveBundleRecord> = {}): ArchiveBundleRecord {
  return {
    bundleId: "bundle-1",
    namespaceId: "ns-1",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    bundleType: "task_archive",
    sourceRefsJson: '["task-1","task-2"]',
    summaryRef: null,
    createdAt: now,
    ...overrides,
  };
}

function replayDatasetRecord(overrides: Partial<ReplayDatasetRecord> = {}): ReplayDatasetRecord {
  return {
    datasetId: "dataset-1",
    namespaceId: "ns-1",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    datasetType: "test_suite",
    sampleRefsJson: '["sample-1"]',
    truthRefsJson: '["truth-1"]',
    version: "1.0",
    createdAt: now,
    ...overrides,
  };
}

function dataMovementJobRecord(overrides: Partial<DataMovementJobRecord> = {}): DataMovementJobRecord {
  return {
    jobId: "job-1",
    tenantId: "tenant-a",
    organizationId: "org-1",
    workspaceId: "ws-1",
    sourceNamespaceId: "ns-source",
    targetNamespaceId: "ns-target",
    sourcePlane: "source-plane",
    targetPlane: "target-plane",
    movementType: "export",
    inputRefsJson: '["ref-1"]',
    status: "in_progress",
    startedAt: now,
    finishedAt: null,
    reportJson: null,
    ...overrides,
  };
}

// === Analytics Tests ===

test("AsyncOperationsRepository insertAnalyticsFactRecord inserts fact", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncOperationsRepository(connection);

  await repo.insertAnalyticsFactRecord(fact);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO analytics_facts/);
  assert.match(calls[0]!.sql, /fact_id, namespace_id/);
});

test("AsyncOperationsRepository listAnalyticsFactRecords returns facts without filters", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ queryRows: [[fact]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listAnalyticsFactRecords();

  assert.deepEqual(result, [fact]);
  assert.match(calls[0]!.sql, /FROM analytics_facts/);
  assert.match(calls[0]!.sql, /ORDER BY captured_at DESC/);
});

test("AsyncOperationsRepository listAnalyticsFactRecords filters by namespaceId", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ queryRows: [[fact]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listAnalyticsFactRecords({ namespaceId: "ns-1" });

  assert.deepEqual(result, [fact]);
  assert.match(calls[0]!.sql, /namespace_id = \$1/);
});

test("AsyncOperationsRepository listAnalyticsFactRecords filters by tenantId", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ queryRows: [[fact]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listAnalyticsFactRecords({ tenantId: "tenant-a" });

  assert.deepEqual(result, [fact]);
  assert.match(calls[0]!.sql, /tenant_id IS \$/);
});

test("AsyncOperationsRepository listAnalyticsFactRecords filters by metricName", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ queryRows: [[fact]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listAnalyticsFactRecords({ metricName: "task_completion" });

  assert.deepEqual(result, [fact]);
  assert.match(calls[0]!.sql, /metric_name = \$1/);
});

test("AsyncOperationsRepository listAnalyticsFactRecords respects limit", async () => {
  const fact = analyticsFactRecord();
  const { connection, calls } = createConnection({ queryRows: [[fact]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listAnalyticsFactRecords({ limit: 5 });

  assert.deepEqual(result, [fact]);
  assert.match(calls[0]!.sql, /LIMIT \$/);
  assert.deepEqual(calls[0]!.params.slice(-1), [5]);
});

// === Archive Bundle Tests ===

test("AsyncOperationsRepository insertArchiveBundleRecord inserts bundle", async () => {
  const bundle = archiveBundleRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncOperationsRepository(connection);

  await repo.insertArchiveBundleRecord(bundle);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO archive_bundles/);
});

test("AsyncOperationsRepository listArchiveBundleRecords returns bundles without filters", async () => {
  const bundle = archiveBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[bundle]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listArchiveBundleRecords();

  assert.deepEqual(result, [bundle]);
  assert.match(calls[0]!.sql, /FROM archive_bundles/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
});

test("AsyncOperationsRepository listArchiveBundleRecords filters by namespaceId", async () => {
  const bundle = archiveBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[bundle]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listArchiveBundleRecords({ namespaceId: "ns-1" });

  assert.deepEqual(result, [bundle]);
  assert.match(calls[0]!.sql, /namespace_id = \$1/);
});

test("AsyncOperationsRepository listArchiveBundleRecords filters by bundleType", async () => {
  const bundle = archiveBundleRecord();
  const { connection, calls } = createConnection({ queryRows: [[bundle]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listArchiveBundleRecords({ bundleType: "task_archive" });

  assert.deepEqual(result, [bundle]);
  assert.match(calls[0]!.sql, /bundle_type = \$1/);
});

// === Replay Dataset Tests ===

test("AsyncOperationsRepository insertReplayDatasetRecord inserts dataset", async () => {
  const dataset = replayDatasetRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncOperationsRepository(connection);

  await repo.insertReplayDatasetRecord(dataset);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO replay_datasets/);
});

test("AsyncOperationsRepository listReplayDatasetRecords returns datasets without filters", async () => {
  const dataset = replayDatasetRecord();
  const { connection, calls } = createConnection({ queryRows: [[dataset]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listReplayDatasetRecords();

  assert.deepEqual(result, [dataset]);
  assert.match(calls[0]!.sql, /FROM replay_datasets/);
  assert.match(calls[0]!.sql, /ORDER BY created_at DESC/);
});

test("AsyncOperationsRepository listReplayDatasetRecords filters by namespaceId", async () => {
  const dataset = replayDatasetRecord();
  const { connection, calls } = createConnection({ queryRows: [[dataset]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listReplayDatasetRecords({ namespaceId: "ns-1" });

  assert.deepEqual(result, [dataset]);
  assert.match(calls[0]!.sql, /namespace_id = \$1/);
});

test("AsyncOperationsRepository listReplayDatasetRecords filters by datasetType", async () => {
  const dataset = replayDatasetRecord();
  const { connection, calls } = createConnection({ queryRows: [[dataset]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listReplayDatasetRecords({ datasetType: "test_suite" });

  assert.deepEqual(result, [dataset]);
  assert.match(calls[0]!.sql, /dataset_type = \$1/);
});

// === Data Movement Job Tests ===

test("AsyncOperationsRepository upsertDataMovementJobRecord inserts job", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncOperationsRepository(connection);

  await repo.upsertDataMovementJobRecord(job);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO data_movement_jobs/);
  assert.match(calls[0]!.sql, /ON CONFLICT\(job_id\) DO UPDATE SET/);
});

test("AsyncOperationsRepository getDataMovementJobRecord returns job when found", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryOneRows: [job] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.getDataMovementJobRecord("job-1");

  assert.deepEqual(result, job);
  assert.match(calls[0]!.sql, /FROM data_movement_jobs/);
  assert.match(calls[0]!.sql, /WHERE job_id = \$1/);
});

test("AsyncOperationsRepository getDataMovementJobRecord returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.getDataMovementJobRecord("job-missing");

  assert.equal(result, null);
});

test("AsyncOperationsRepository listDataMovementJobRecords returns jobs without filters", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listDataMovementJobRecords();

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /FROM data_movement_jobs/);
});

test("AsyncOperationsRepository listDataMovementJobRecords filters by tenantId", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listDataMovementJobRecords({ tenantId: "tenant-a" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /tenant_id = \$1/);
});

test("AsyncOperationsRepository listDataMovementJobRecords filters by status", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listDataMovementJobRecords({ status: "in_progress" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /status = \$1/);
});

test("AsyncOperationsRepository listDataMovementJobRecords filters by movementType", async () => {
  const job = dataMovementJobRecord();
  const { connection, calls } = createConnection({ queryRows: [[job]] });
  const repo = new AsyncOperationsRepository(connection);

  const result = await repo.listDataMovementJobRecords({ movementType: "export" });

  assert.deepEqual(result, [job]);
  assert.match(calls[0]!.sql, /movement_type = \$1/);
});
