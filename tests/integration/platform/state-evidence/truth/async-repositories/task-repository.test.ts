import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import type { TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { cleanupPath, createTempWorkspace } from "../../../../../helpers/fs.js";

function createHarness() {
  const workspace = createTempWorkspace("aa-async-task-repo-");
  const dbPath = join(workspace, "task-repo.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const adapter = new SqliteAsyncAdapter(db);
  const repo = new AsyncTaskRepository(adapter.asyncConnection);

  return {
    workspace,
    dbPath,
    db,
    adapter,
    repo,
    cleanup() {
      db.close();
      cleanupPath(workspace);
    },
  };
}

function createTask(overrides: Partial<TaskRecord> & Pick<TaskRecord, "id" | "tenantId" | "title">): TaskRecord {
  const createdAt = overrides.createdAt ?? "2026-04-23T10:00:00.000Z";
  const baseTask: TaskRecord = {
    id: overrides.id,
    parentId: null,
    rootId: overrides.rootId ?? overrides.id,
    divisionId: "div-001",
    title: overrides.title,
    status: "queued",
    source: "user",
    priority: "normal",
    inputJson: "{}",
    normalizedInputJson: "{}",
    outputJson: null,
    estimatedCostUsd: null,
    actualCostUsd: 0,
    errorCode: null,
    createdAt,
    updatedAt: overrides.updatedAt ?? createdAt,
    completedAt: null,
  };
  const task = { ...baseTask, ...overrides };
  if (overrides.tenantId !== undefined) {
    task.tenantId = overrides.tenantId;
  }
  return task;
}

test("AsyncTaskRepository insertTask and getTask roundtrip", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-async-001",
      tenantId: "tenant-test",
      title: "Test Task",
      inputJson: '{"input":"value"}',
      normalizedInputJson: '{"input":"value"}',
    }));

    const retrieved = await harness.repo.getTask("task-async-001", "tenant-test");

    assert.equal(retrieved?.id, "task-async-001");
    assert.equal(retrieved?.title, "Test Task");
    assert.equal(retrieved?.status, "queued");
    assert.equal(retrieved?.tenantId, "tenant-test");
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository getTask returns null for non-existent task", async () => {
  const harness = createHarness();
  try {
    const result = await harness.repo.getTask("non-existent-task");
    assert.equal(result, null);
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository getTask with tenant scoping returns null when tenant mismatch", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-async-002",
      tenantId: "tenant-a",
      title: "Tenant A Task",
    }));

    const result = await harness.repo.getTask("task-async-002", "tenant-b");
    assert.equal(result, null);
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository listTasks returns tasks ordered by updated_at desc", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-list-001",
      tenantId: "tenant-list",
      title: "First Task",
      priority: "low",
      updatedAt: "2026-04-23T09:00:00.000Z",
    }));
    await harness.repo.insertTask(createTask({
      id: "task-list-002",
      tenantId: "tenant-list",
      title: "Second Task",
      priority: "high",
      createdAt: "2026-04-23T10:01:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    }));

    const listed = await harness.repo.listTasks(10, "tenant-list");

    assert.equal(listed.length, 2);
    assert.equal(listed[0]!.id, "task-list-002");
    assert.equal(listed[1]!.id, "task-list-001");
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository listTasks applies limit", async () => {
  const harness = createHarness();
  try {
    for (let i = 0; i < 5; i++) {
      await harness.repo.insertTask(createTask({
        id: `task-limit-${i}`,
        tenantId: "tenant-limit",
        title: `Task ${i}`,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      }));
    }

    const listed = await harness.repo.listTasks(3, "tenant-limit");
    assert.equal(listed.length, 3);
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository updateTaskStatus updates status and timestamp", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-update-001",
      tenantId: "tenant-update",
      title: "Update Test",
    }));

    await harness.repo.updateTaskStatus("task-update-001", "in_progress", "2026-04-23T11:00:00.000Z", null, null);

    const retrieved = await harness.repo.getTask("task-update-001");
    assert.equal(retrieved?.status, "in_progress");
    assert.equal(retrieved?.updatedAt, "2026-04-23T11:00:00.000Z");
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository updateTaskStatusCas uses optimistic locking", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-cas-001",
      tenantId: "tenant-cas",
      title: "CAS Test",
    }));

    const affected1 = await harness.repo.updateTaskStatusCas(
      "task-cas-001",
      "queued",
      "in_progress",
      "2026-04-23T11:00:00.000Z",
      null,
      null,
    );
    assert.equal(affected1, 1);

    const affected2 = await harness.repo.updateTaskStatusCas(
      "task-cas-001",
      "queued",
      "done",
      "2026-04-23T12:00:00.000Z",
      null,
      null,
    );
    assert.equal(affected2, 0);
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository updateTaskOutput updates output and timestamp", async () => {
  const harness = createHarness();
  try {
    await harness.repo.insertTask(createTask({
      id: "task-output-001",
      tenantId: "tenant-output",
      title: "Output Test",
    }));

    await harness.repo.updateTaskOutput("task-output-001", '{"result":"success"}', "2026-04-23T11:00:00.000Z");

    const retrieved = await harness.repo.getTask("task-output-001");
    assert.equal(retrieved?.outputJson, '{"result":"success"}');
  } finally {
    harness.cleanup();
  }
});

test("AsyncTaskRepository countQueuedTasks counts pending and queued tasks", async () => {
  const harness = createHarness();
  try {
    const statuses: TaskRecord["status"][] = ["queued", "pending", "in_progress", "done", "queued"];

    for (let i = 0; i < statuses.length; i++) {
      await harness.repo.insertTask(createTask({
        id: `task-count-${i}`,
        tenantId: "tenant-count",
        title: `Task ${i}`,
        status: statuses[i]!,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      }));
    }

    const count = await harness.repo.countQueuedTasks("tenant-count");
    assert.equal(count, 3);
  } finally {
    harness.cleanup();
  }
});
