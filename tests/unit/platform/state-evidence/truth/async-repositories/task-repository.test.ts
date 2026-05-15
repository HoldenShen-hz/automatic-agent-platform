import assert from "node:assert/strict";
import test from "node:test";

import { AsyncTaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/task-repository.js";
import type { AsyncSqlConnection, AsyncQueryResult } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-sql-database.js";
import type { TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

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

function taskRecord(overrides: Partial<TaskRecord> = {}): TaskRecord {
  return {
    id: "task-1",
    parentId: null,
    rootId: "task-root",
    divisionId: "div-1",
    tenantId: "tenant-a",
    title: "Test Task",
    status: "pending",
    source: "api",
    priority: "medium",
    inputJson: '{"input":"value"}',
    normalizedInputJson: '{"normalized":true}',
    outputJson: null,
    estimatedCostUsd: 0.5,
    actualCostUsd: null,
    errorCode: null,
    createdAt: now,
    updatedAt: now,
    completedAt: null,
    ...overrides,
  };
}

test("AsyncTaskRepository insertTask inserts task record", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  await repo.insertTask(task);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /INSERT INTO tasks/);
  assert.match(calls[0]!.sql, /id, parent_id, root_id/);
});

test("AsyncTaskRepository getTask returns task when found without tenant", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryOneRows: [task] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.getTask("task-1");

  assert.deepEqual(result, task);
  assert.match(calls[0]!.sql, /FROM tasks WHERE id = \$1/);
});

test("AsyncTaskRepository getTask returns task when found with tenant", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryOneRows: [task] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.getTask("task-1", "tenant-a");

  assert.deepEqual(result, task);
  assert.match(calls[0]!.sql, /FROM tasks t WHERE t\.id = \$1 AND t\.tenant_id = \$2/);
});

test("AsyncTaskRepository getTask returns null when not found", async () => {
  const { connection } = createConnection({ queryOneRows: [undefined] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.getTask("task-missing");

  assert.equal(result, null);
});

test("AsyncTaskRepository listTasks returns tasks without tenant scoping", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryRows: [[task]] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.listTasks();

  assert.deepEqual(result, [task]);
  assert.match(calls[0]!.sql, /FROM tasks/);
  assert.match(calls[0]!.sql, /ORDER BY updated_at DESC, id DESC/);
});

test("AsyncTaskRepository listTasks returns tasks with tenant scoping", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryRows: [[task]] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.listTasks(undefined, "tenant-a");

  assert.deepEqual(result, [task]);
  assert.match(calls[0]!.sql, /WHERE tenant_id = \$1/);
  assert.deepEqual(calls[0]!.params, ["tenant-a"]);
});

test("AsyncTaskRepository listTasks respects limit", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryRows: [[task]] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.listTasks(10);

  assert.deepEqual(result, [task]);
  assert.match(calls[0]!.sql, /LIMIT \$1/);
  assert.deepEqual(calls[0]!.params, [10]);
});

test("AsyncTaskRepository listTasks respects cursor", async () => {
  const task = taskRecord();
  const { connection, calls } = createConnection({ queryRows: [[task]] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.listTasks(undefined, undefined, "2026-04-22T00:00:00.000Z");

  assert.deepEqual(result, [task]);
  assert.match(calls[0]!.sql, /updated_at < \$1/);
  assert.deepEqual(calls[0]!.params, ["2026-04-22T00:00:00.000Z"]);
});

test("AsyncTaskRepository updateTaskStatus updates task status", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  await repo.updateTaskStatus("task-1", "running", now, null, null);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE tasks SET status = \$1/);
  assert.deepEqual(calls[0]!.params, ["running", now, null, null, "task-1"]);
});

test("AsyncTaskRepository updateTaskStatusCas returns affected row count", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.updateTaskStatusCas("task-1", "pending", "running", now, null, null);

  assert.equal(result, 1);
  assert.match(calls[0]!.sql, /WHERE id = \$5 AND status = \$6/);
});

test("AsyncTaskRepository setTaskState sets task state fields", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  await repo.setTaskState({
    taskId: "task-1",
    status: "completed",
    updatedAt: now,
    errorCode: null,
    completedAt: now,
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE tasks SET status = \$1/);
  assert.deepEqual(calls[0]!.params, ["completed", now, null, now, "task-1"]);
});

test("AsyncTaskRepository updateTaskOutput updates output", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  await repo.updateTaskOutput("task-1", '{"result":"done"}', now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE tasks SET output_json = \$1/);
  assert.deepEqual(calls[0]!.params, ['{"result":"done"}', now, "task-1"]);
});

test("AsyncTaskRepository updateTaskInput updates input fields", async () => {
  const { connection, calls } = createConnection({ executeResults: [1] });
  const repo = new AsyncTaskRepository(connection);

  await repo.updateTaskInput("task-1", '{"new":"input"}', '{"normalized":true}', now);

  assert.equal(calls.length, 1);
  assert.match(calls[0]!.sql, /UPDATE tasks SET input_json = \$1/);
  assert.deepEqual(calls[0]!.params, ['{"new":"input"}', '{"normalized":true}', now, "task-1"]);
});

test("AsyncTaskRepository countQueuedTasks returns count without tenant", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 42 }] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.countQueuedTasks();

  assert.equal(result, 42);
  assert.match(calls[0]!.sql, /COUNT\(\*\) AS count/);
  assert.match(calls[0]!.sql, /status IN \('queued', 'pending'\)/);
});

test("AsyncTaskRepository countQueuedTasks returns count with tenant", async () => {
  const { connection, calls } = createConnection({ queryOneRows: [{ count: 7 }] });
  const repo = new AsyncTaskRepository(connection);

  const result = await repo.countQueuedTasks("tenant-a");

  assert.equal(result, 7);
  assert.match(calls[0]!.sql, /AND tenant_id = \$1/);
  assert.deepEqual(calls[0]!.params, ["tenant-a"]);
});
