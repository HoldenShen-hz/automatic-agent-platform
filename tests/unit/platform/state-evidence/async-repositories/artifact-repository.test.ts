import assert from "node:assert/strict";
import test from "node:test";

import { AsyncArtifactRepository } from "../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/artifact-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { ArtifactRecord } from "../../../../../src/platform/contracts/types/domain.js";

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

function artifactRecord(overrides: Partial<ArtifactRecord> = {}): ArtifactRecord {
  return {
    artifactId: "art-1",
    taskId: "task-1",
    executionId: "exec-1",
    stepId: "step-1",
    kind: "output",
    storagePath: "/artifacts/art-1.json",
    fileName: "output.json",
    mimeType: "application/json",
    sizeBytes: 1024,
    checksum: "abc123",
    lineageJson: "[]",
    createdAt: now,
    ...overrides,
  };
}

test("AsyncArtifactRepository insertArtifact inserts artifact record", async () => {
  const artifact = artifactRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncArtifactRepository(connection);

  await repo.insertArtifact(artifact);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO artifacts/);
  assert.match(calls[0]!.sql, /artifact_id, task_id, execution_id/);
});

test("AsyncArtifactRepository getArtifact returns artifact when found", async () => {
  const artifact = artifactRecord();
  const { connection, calls } = createConnection({ queryOneRows: [artifact] });
  const repo = new AsyncArtifactRepository(connection);

  const result = await repo.getArtifact("art-1");

  assert.deepEqual(result, artifact);
  assert.match(calls[0]!.sql, /FROM artifacts/);
  assert.match(calls[0]!.sql, /WHERE artifact_id = \$1/);
});

test("AsyncArtifactRepository getArtifact returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncArtifactRepository(connection);

  const result = await repo.getArtifact("art-missing");

  assert.equal(result, null);
});

test("AsyncArtifactRepository listArtifactsByTask returns artifacts without tenant", async () => {
  const artifact = artifactRecord();
  const { connection, calls } = createConnection({ queryRows: [[artifact]] });
  const repo = new AsyncArtifactRepository(connection);

  const result = await repo.listArtifactsByTask("task-1");

  assert.deepEqual(result, [artifact]);
  assert.match(calls[0]!.sql, /FROM artifacts/);
  assert.match(calls[0]!.sql, /WHERE task_id = \$1/);
  assert.match(calls[0]!.sql, /ORDER BY created_at ASC/);
  assert.doesNotMatch(calls[0]!.sql, /INNER JOIN tasks/);
});

test("AsyncArtifactRepository listArtifactsByTask returns artifacts with tenant", async () => {
  const artifact = artifactRecord();
  const { connection, calls } = createConnection({ queryRows: [[artifact]] });
  const repo = new AsyncArtifactRepository(connection);

  const result = await repo.listArtifactsByTask("task-1", "tenant-a");

  assert.deepEqual(result, [artifact]);
  assert.match(calls[0]!.sql, /INNER JOIN tasks t ON t\.id = a\.task_id/);
  assert.match(calls[0]!.sql, /t\.tenant_id = \$2/);
});