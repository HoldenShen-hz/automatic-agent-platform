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

test.skip("AsyncExecutionRepository", (group) => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    executionRepo: AsyncExecutionRepository;
    taskRepo: AsyncTaskRepository;
    cleanup: () => void;
  };

  group.beforeEach(async () => {
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

  group.afterEach(() => {
    harness.cleanup();
  });

  async function insertTestTask(taskId: string, tenantId: string): Promise<void> {
    const task: TaskRecord = {
      id: taskId,
      parentId: null,
      rootId: null,
      divisionId: "div-001",
      tenantId,
      title: "Test Task",
      status: "queued",
      source: "test",
      priority: "medium",
      inputJson: "{}",
      normalizedInputJson: "{}",
      outputJson: null,
      estimatedCostUsd: null,
      actualCostUsd: null,
      errorCode: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
      completedAt: null,
    };
    await harness.taskRepo.insertTask(task);
  }

  test("insertExecution and getExecution roundtrip", async () => {
    await insertTestTask("task-exec-001", "tenant-exec");

    const execution: ExecutionRecord = {
      id: "exec-001",
      taskId: "task-exec-001",
      workflowId: "wf-001",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: null,
      runKind: "execute",
      status: "pending",
      inputRef: null,
      traceId: null,
      attempt: 1,
      timeoutMs: 300000,
      budgetUsdLimit: null,
      requiresApproval: false,
      sandboxMode: "standard",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };

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
      {
        id: "exec-list-001",
        taskId: "task-exec-list",
        workflowId: "wf-001",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: null,
        runKind: "execute",
        status: "pending",
        inputRef: null,
        traceId: null,
        attempt: 1,
        timeoutMs: 300000,
        budgetUsdLimit: null,
        requiresApproval: false,
        sandboxMode: "standard",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      },
      {
        id: "exec-list-002",
        taskId: "task-exec-list",
        workflowId: "wf-001",
        parentExecutionId: null,
        agentId: "agent-002",
        roleId: null,
        runKind: "execute",
        status: "pending",
        inputRef: null,
        traceId: null,
        attempt: 1,
        timeoutMs: 300000,
        budgetUsdLimit: null,
        requiresApproval: false,
        sandboxMode: "standard",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-04-23T10:01:00.000Z",
        updatedAt: "2026-04-23T10:01:00.000Z",
      },
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
      const exec: ExecutionRecord = {
        id: execIds[i],
        taskId: "task-exec-status",
        workflowId: "wf-001",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: null,
        runKind: "execute",
        status: statuses[i],
        inputRef: null,
        traceId: null,
        attempt: 1,
        timeoutMs: 300000,
        budgetUsdLimit: null,
        requiresApproval: false,
        sandboxMode: "standard",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      };
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

    const exec: ExecutionRecord = {
      id: "exec-update-001",
      taskId: "task-exec-update",
      workflowId: "wf-001",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: null,
      runKind: "execute",
      status: "pending",
      inputRef: null,
      traceId: null,
      attempt: 1,
      timeoutMs: 300000,
      budgetUsdLimit: null,
      requiresApproval: false,
      sandboxMode: "standard",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: null,
      finishedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };
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

    const exec: ExecutionRecord = {
      id: "exec-fail-001",
      taskId: "task-exec-fail",
      workflowId: "wf-001",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: null,
      runKind: "execute",
      status: "executing",
      inputRef: null,
      traceId: null,
      attempt: 1,
      timeoutMs: 300000,
      budgetUsdLimit: null,
      requiresApproval: false,
      sandboxMode: "standard",
      allowedToolsJson: "[]",
      allowedPathsJson: "[]",
      maxRetries: 3,
      retryBackoff: "exponential",
      lastErrorCode: null,
      lastErrorMessage: null,
      startedAt: "2026-04-23T10:00:00.000Z",
      finishedAt: null,
      createdAt: "2026-04-23T10:00:00.000Z",
      updatedAt: "2026-04-23T10:00:00.000Z",
    };
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
      const exec: ExecutionRecord = {
        id: `exec-active-${i}`,
        taskId: "task-exec-active",
        workflowId: "wf-001",
        parentExecutionId: null,
        agentId: "agent-001",
        roleId: null,
        runKind: "execute",
        status: statuses[i],
        inputRef: null,
        traceId: null,
        attempt: 1,
        timeoutMs: 300000,
        budgetUsdLimit: null,
        requiresApproval: false,
        sandboxMode: "standard",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 3,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      };
      await harness.executionRepo.insertExecution(exec);
    }

    const count = await harness.executionRepo.countActiveExecutions();
    assert.equal(count, 3); // 2 executing + 1 prechecking
  });
});
