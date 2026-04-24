// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { ExecutionRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("AsyncExecutionRepository", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    executionRepo: AsyncExecutionRepository;
    taskRepo: AsyncTaskRepository;
    cleanup: () => void;
  };

  test.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-exec-repo-");
    const dbPath = join(workspace, "exec-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const executionRepo = new AsyncExecutionRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      executionRepo,
      taskRepo,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  test.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: taskId,
      divisionId: "general_ops",
      tenantId,
      title: "Test Task",
      status: "queued",
      source: "user",
      priority: "normal",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: 0,
      actualCostUsd: 0,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: null,
    };
    await harness.taskRepo.insertTask(task);
  }

  function createExecution(overrides: Partial<ExecutionRecord> & Pick<ExecutionRecord, "id" | "taskId" | "status">): ExecutionRecord {
    return {
      id: overrides.id,
      taskId: overrides.taskId,
      workflowId: overrides.workflowId ?? "single_agent_minimal",
      parentExecutionId: overrides.parentExecutionId ?? null,
      agentId: overrides.agentId ?? "agent-001",
      roleId: overrides.roleId ?? "general_executor",
      runKind: overrides.runKind ?? "task_run",
      status: overrides.status,
      inputRef: overrides.inputRef ?? null,
      traceId: overrides.traceId ?? `trace-${overrides.id}`,
      attempt: overrides.attempt ?? 1,
      timeoutMs: overrides.timeoutMs ?? 60000,
      budgetUsdLimit: overrides.budgetUsdLimit ?? 1,
      requiresApproval: overrides.requiresApproval ?? 0,
      sandboxMode: overrides.sandboxMode ?? "workspace_write",
      allowedToolsJson: overrides.allowedToolsJson ?? "[]",
      allowedPathsJson: overrides.allowedPathsJson ?? "[]",
      maxRetries: overrides.maxRetries ?? 0,
      retryBackoff: overrides.retryBackoff ?? "none",
      lastErrorCode: overrides.lastErrorCode ?? null,
      lastErrorMessage: overrides.lastErrorMessage ?? null,
      startedAt: overrides.startedAt ?? null,
      finishedAt: overrides.finishedAt ?? null,
      createdAt: overrides.createdAt ?? "2026-04-23T10:00:00.000Z",
      updatedAt: overrides.updatedAt ?? (overrides.createdAt ?? "2026-04-23T10:00:00.000Z"),
    };
  }

  test("insertExecution and getExecution roundtrip", async () => {
    await insertTestTask("task-exec-001", "tenant-exec");

    const execution = createExecution({
      id: "exec-001",
      taskId: "task-exec-001",
      status: "pending",
    });

    await harness.executionRepo.insertExecution(execution);
    const retrieved = await harness.executionRepo.getExecution("exec-001");

    assert.equal(retrieved?.id, "exec-001");
    assert.equal(retrieved?.taskId, "task-exec-001");
    assert.equal(retrieved?.status, "pending");
    assert.equal(retrieved?.attempt, 1);
  });

  test("getExecution returns null for non-existent execution", async () => {
    const result = await harness.executionRepo.getExecution("non-existent-exec");
    assert.equal(result, null);
  });

  test("listExecutionsByTask returns all executions for a task", async () => {
    await insertTestTask("task-exec-list", "tenant-exec-list");

    const executions: ExecutionRecord[] = [
      createExecution({
        id: "exec-list-001",
        taskId: "task-exec-list",
        status: "pending",
        attempt: 1,
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      }),
      createExecution({
        id: "exec-list-002",
        taskId: "task-exec-list",
        status: "pending",
        agentId: "agent-002",
        attempt: 2,
        createdAt: "2026-04-23T10:01:00.000Z",
        updatedAt: "2026-04-23T10:01:00.000Z",
      }),
    ];

    for (const exec of executions) {
      await harness.executionRepo.insertExecution(exec);
    }

    const listed = await harness.executionRepo.listExecutionsByTask("task-exec-list", "tenant-exec-list");
    assert.equal(listed.length, 2);
  });

  test("listExecutionsByStatuses filters by status list", async () => {
    await insertTestTask("task-exec-status", "tenant-exec-status");

    const statuses: Array<ExecutionRecord["status"]> = ["pending", "executing", "completed", "pending"];
    const execIds = ["exec-status-001", "exec-status-002", "exec-status-003", "exec-status-004"];

    for (let i = 0; i < statuses.length; i++) {
      const exec = createExecution({
        id: execIds[i],
        taskId: "task-exec-status",
        status: statuses[i],
        attempt: i + 1,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      });
      await harness.executionRepo.insertExecution(exec);
    }

    const pending = await harness.executionRepo.listExecutionsByStatuses(["pending"]);
    assert.equal(pending.length, 2);

    const executing = await harness.executionRepo.listExecutionsByStatuses(["executing"]);
    assert.equal(executing.length, 1);

    const multiple = await harness.executionRepo.listExecutionsByStatuses(["pending", "executing"]);
    assert.equal(multiple.length, 3);
  });

  test("listExecutionsByStatuses returns empty array for empty status list", async () => {
    const result = await harness.executionRepo.listExecutionsByStatuses([]);
    assert.deepEqual(result, []);
  });

  test("updateExecutionStatus updates status and timestamps", async () => {
    await insertTestTask("task-exec-update", "tenant-exec-update");

    const exec = createExecution({
      id: "exec-update-001",
      taskId: "task-exec-update",
      status: "pending",
    });
    await harness.executionRepo.insertExecution(exec);

    const affected = await harness.executionRepo.updateExecutionStatus(
      "exec-update-001",
      "executing",
      "2026-04-23T10:05:00.000Z",
      "2026-04-23T10:05:00.000Z",
      null,
      null,
    );
    assert.equal(affected, 1);

    const retrieved = await harness.executionRepo.getExecution("exec-update-001");
    assert.equal(retrieved?.status, "executing");
  });

  test("updateExecutionFailure updates failure info", async () => {
    await insertTestTask("task-exec-fail", "tenant-exec-fail");

    const exec = createExecution({
      id: "exec-fail-001",
      taskId: "task-exec-fail",
      status: "executing",
      startedAt: "2026-04-23T10:00:00.000Z",
    });
    await harness.executionRepo.insertExecution(exec);

    await harness.executionRepo.updateExecutionFailure({
      executionId: "exec-fail-001",
      status: "failed",
      updatedAt: "2026-04-23T10:30:00.000Z",
      finishedAt: "2026-04-23T10:30:00.000Z",
      lastErrorCode: "ERR_TIMEOUT",
      lastErrorMessage: "Execution timed out",
    });

    const retrieved = await harness.executionRepo.getExecution("exec-fail-001");
    assert.equal(retrieved?.status, "failed");
    assert.equal(retrieved?.lastErrorCode, "ERR_TIMEOUT");
  });

  test("countActiveExecutions counts executing and prechecking", async () => {
    await insertTestTask("task-exec-active", "tenant-exec-active");

    const statuses: Array<ExecutionRecord["status"]> = ["executing", "prechecking", "pending", "completed", "executing"];

    for (let i = 0; i < statuses.length; i++) {
      const exec = createExecution({
        id: `exec-active-${i}`,
        taskId: "task-exec-active",
        status: statuses[i],
        attempt: i + 1,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      });
      await harness.executionRepo.insertExecution(exec);
    }

    const count = await harness.executionRepo.countActiveExecutions();
    assert.equal(count, 3); // 2 executing + 1 prechecking
  });
});
