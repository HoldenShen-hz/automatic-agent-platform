import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/task-repository.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/five-plane-state-evidence/truth/async-repositories/execution-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { TaskRecord, ExecutionRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("Async Repository Transactions", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    cleanup: () => void;
  };

  test.beforeEach(() => {
    const workspace = createTempWorkspace("aa-async-txn-");
    const dbPath = join(workspace, "txn-test.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      cleanup() {
        db.close();
        cleanupPath(workspace);
      },
    };
  });

  test.afterEach(() => {
    harness.cleanup();
  });

  test("transaction rolls back on error", async () => {
    const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);

    const task: TaskRecord = {
      id: "txn-rollback-task",
      parentId: null,
      rootId: "txn-rollback-task",
      divisionId: "general_ops",
      tenantId: "tenant-txn-rb",
      title: "Rollback Test",
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

    await taskRepo.insertTask(task);

    // Execute a transaction that should fail midway
    try {
      await harness.adapter.transaction(async (conn) => {
        const execRepo = new AsyncExecutionRepository(conn);

        // Insert execution successfully
        const execution: ExecutionRecord = {
          id: "txn-rollback-exec",
          taskId: "txn-rollback-task",
          workflowId: "single_agent_minimal",
          parentExecutionId: null,
          agentId: "agent-txn",
          roleId: "general_executor",
          runKind: "task_run",
          status: "pending",
          inputRef: null,
          traceId: "trace-txn-rollback",
          attempt: 1,
          timeoutMs: 60000,
          budgetUsdLimit: 1,
          requiresApproval: 0,
          sandboxMode: "workspace_write",
          allowedToolsJson: "[]",
          allowedPathsJson: "[]",
          maxRetries: 0,
          retryBackoff: "none",
          lastErrorCode: null,
          lastErrorMessage: null,
          startedAt: null,
          finishedAt: null,
          createdAt: "2026-04-23T10:00:00.000Z",
          updatedAt: "2026-04-23T10:00:00.000Z",
        };
        await execRepo.insertExecution(execution);

        // Now insert with a duplicate ID to cause failure
        await execRepo.insertExecution(execution);
      });
      assert.fail("Expected transaction to fail");
    } catch {
      // Transaction should have rolled back
    }

    // Verify only the task exists (execution should have been rolled back)
    const retrieved = await taskRepo.getTask("txn-rollback-task");
    assert.equal(retrieved?.id, "txn-rollback-task");

    const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);
    const executions = await execRepo.listExecutionsByTask("txn-rollback-task");
    assert.equal(executions.length, 0, "Execution should have been rolled back");
  });

  test("transaction commits on success", async () => {
    const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);

    const task: TaskRecord = {
      id: "txn-commit-task",
      parentId: null,
      rootId: "txn-commit-task",
      divisionId: "general_ops",
      tenantId: "tenant-txn-commit",
      title: "Commit Test",
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

    await taskRepo.insertTask(task);

    const result = await harness.adapter.transaction(async (conn) => {
      const execRepo = new AsyncExecutionRepository(conn);

      const execution: ExecutionRecord = {
        id: "txn-commit-exec",
        taskId: "txn-commit-task",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-commit",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: "trace-txn-commit",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      };
      await execRepo.insertExecution(execution);

      return "success";
    });

    assert.equal(result, "success");

    const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);
    const executions = await execRepo.listExecutionsByTask("txn-commit-task");
    assert.equal(executions.length, 1);
    assert.equal(executions[0].id, "txn-commit-exec");
  });

  test("readTransaction for read-only operations", async () => {
    const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);

    const task: TaskRecord = {
      id: "read-txn-task",
      parentId: null,
      rootId: "read-txn-task",
      divisionId: "general_ops",
      tenantId: "tenant-read-txn",
      title: "Read Transaction Test",
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

    await taskRepo.insertTask(task);

    const result = await harness.adapter.readTransaction(async (conn) => {
      const readRepo = new AsyncTaskRepository(conn);
      const tasks = await readRepo.listTasks(10, "tenant-read-txn");
      return tasks.length;
    });

    assert.equal(result, 1);
  });

  test("multiple operations in single transaction", async () => {
    const taskRepo = new AsyncTaskRepository(harness.adapter.asyncConnection);
    const execRepo = new AsyncExecutionRepository(harness.adapter.asyncConnection);

    await harness.adapter.transaction(async (conn) => {
      const txnTaskRepo = new AsyncTaskRepository(conn);
      const txnExecRepo = new AsyncExecutionRepository(conn);

      // Insert multiple tasks in transaction
      for (let i = 0; i < 3; i++) {
        const task: TaskRecord = {
          id: `txn-multi-task-${i}`,
          parentId: null,
          rootId: `txn-multi-task-${i}`,
          divisionId: "general_ops",
          tenantId: "tenant-multi",
          title: `Multi Task ${i}`,
          status: "queued",
          source: "user",
          priority: "normal",
          inputJson: "{}",
          normalizedInputJson: "{}",
          outputJson: null,
          estimatedCostUsd: 0,
          actualCostUsd: 0,
          errorCode: null,
          createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
          updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
          completedAt: null,
        };
        await txnTaskRepo.insertTask(task);
      }

      // Insert execution linked to first task
      const execution: ExecutionRecord = {
        id: "txn-multi-exec",
        taskId: "txn-multi-task-0",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-multi",
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: "trace-txn-multi",
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: null,
        finishedAt: null,
        createdAt: "2026-04-23T10:00:00.000Z",
        updatedAt: "2026-04-23T10:00:00.000Z",
      };
      await txnExecRepo.insertExecution(execution);
    });

    // Verify all data is committed
    const tasks = await taskRepo.listTasks(10, "tenant-multi");
    assert.equal(tasks.length, 3);

    const executions = await execRepo.listExecutionsByTask("txn-multi-task-0");
    assert.equal(executions.length, 1);
  });
});
