// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncApprovalRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/approval-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { AsyncExecutionRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/execution-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { ApprovalRecord, ExecutionRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.describe("AsyncApprovalRepository", () => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    approvalRepo: AsyncApprovalRepository;
    taskRepo: AsyncTaskRepository;
    executionRepo: AsyncExecutionRepository;
    cleanup: () => void;
  };

  test.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-approval-repo-");
    const dbPath = join(workspace, "approval-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const approvalRepo = new AsyncApprovalRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);
    const executionRepo = new AsyncExecutionRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      approvalRepo,
      taskRepo,
      executionRepo,
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
      status: "pending_approval",
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

  async function insertTestExecution(executionId: string, taskId: string, tenantId: string): Promise<void> {
    await insertTestTask(taskId, tenantId);
    const execution: ExecutionRecord = {
      id: executionId,
      taskId,
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-001",
      roleId: "general_executor",
      runKind: "task_run",
      status: "pending",
      inputRef: null,
      traceId: `trace-${executionId}`,
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
    await harness.executionRepo.insertExecution(execution);
  }

  test("insertApproval and getApproval roundtrip", async () => {
    await insertTestExecution("exec-approval-001", "task-approval-001", "tenant-approval");

    const approval: ApprovalRecord = {
      id: "approval-001",
      taskId: "task-approval-001",
      executionId: "exec-approval-001",
      status: "pending",
      requestJson: '{"reason":"high_priority_task"}',
      responseJson: null,
      timeoutPolicy: '{"timeout_seconds":3600}',
      createdAt: "2026-04-23T10:00:00.000Z",
      respondedAt: null,
    };

    await harness.approvalRepo.insertApproval(approval);
    const retrieved = await harness.approvalRepo.getApproval("approval-001", "tenant-approval");

    assert.equal(retrieved?.id, "approval-001");
    assert.equal(retrieved?.taskId, "task-approval-001");
    assert.equal(retrieved?.status, "pending");
    assert.equal(retrieved?.executionId, "exec-approval-001");
  });

  test("getApproval returns null for non-existent approval", async () => {
    const result = await harness.approvalRepo.getApproval("non-existent-approval");
    assert.equal(result, null);
  });

  test("getApproval with tenant scoping returns null when tenant mismatch", async () => {
    await insertTestExecution("exec-tenant", "task-approval-tenant", "tenant-a");

    const approval: ApprovalRecord = {
      id: "approval-tenant-001",
      taskId: "task-approval-tenant",
      executionId: "exec-tenant",
      status: "pending",
      requestJson: "{}",
      responseJson: null,
      timeoutPolicy: "{}",
      createdAt: "2026-04-23T10:00:00.000Z",
      respondedAt: null,
    };

    await harness.approvalRepo.insertApproval(approval);
    const result = await harness.approvalRepo.getApproval("approval-tenant-001", "tenant-b");
    assert.equal(result, null);
  });

  test("listApprovalsByTask returns all approvals for a task", async () => {
    await insertTestExecution("exec-list-001", "task-approval-list", "tenant-approval-list");
    await harness.executionRepo.insertExecution({
      id: "exec-list-002",
      taskId: "task-approval-list",
      workflowId: "single_agent_minimal",
      parentExecutionId: null,
      agentId: "agent-002",
      roleId: "general_executor",
      runKind: "task_run",
      status: "pending",
      inputRef: null,
      traceId: "trace-exec-list-002",
      attempt: 2,
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
      createdAt: "2026-04-23T10:01:00.000Z",
      updatedAt: "2026-04-23T10:01:00.000Z",
    });

    const approvals: ApprovalRecord[] = [
      {
        id: "approval-list-001",
        taskId: "task-approval-list",
        executionId: "exec-list-001",
        status: "pending",
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "{}",
        createdAt: "2026-04-23T10:00:00.000Z",
        respondedAt: null,
      },
      {
        id: "approval-list-002",
        taskId: "task-approval-list",
        executionId: "exec-list-002",
        status: "approved",
        requestJson: "{}",
        responseJson: '{"decision":"approved"}',
        timeoutPolicy: "{}",
        createdAt: "2026-04-23T10:01:00.000Z",
        respondedAt: "2026-04-23T10:30:00.000Z",
      },
    ];

    for (const approval of approvals) {
      await harness.approvalRepo.insertApproval(approval);
    }

    const listed = await harness.approvalRepo.listApprovalsByTask("task-approval-list", "tenant-approval-list");
    assert.equal(listed.length, 2);
  });

  test("updateApprovalDecision updates status, response, and timestamp", async () => {
    await insertTestExecution("exec-update-001", "task-approval-update", "tenant-approval-update");

    const approval: ApprovalRecord = {
      id: "approval-update-001",
      taskId: "task-approval-update",
      executionId: "exec-update-001",
      status: "pending",
      requestJson: '{"cost_estimate":500}',
      responseJson: null,
      timeoutPolicy: '{"timeout_seconds":3600}',
      createdAt: "2026-04-23T10:00:00.000Z",
      respondedAt: null,
    };

    await harness.approvalRepo.insertApproval(approval);

    const affected = await harness.approvalRepo.updateApprovalDecision({
      approvalId: "approval-update-001",
      status: "approved",
      responseJson: '{"decision":"approved","approver":"admin"}',
      respondedAt: "2026-04-23T10:30:00.000Z",
    });
    assert.equal(affected, 1);

    const retrieved = await harness.approvalRepo.getApproval("approval-update-001");
    assert.equal(retrieved?.status, "approved");
    assert.ok(retrieved?.responseJson.includes("approved"));
  });

  test("listApprovalsByStatus filters by status", async () => {
    await insertTestExecution("exec-status-0", "task-approval-status", "tenant-approval-status");
    for (let i = 1; i < 4; i++) {
      await harness.executionRepo.insertExecution({
        id: `exec-status-${i}`,
        taskId: "task-approval-status",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: `agent-${i}`,
        roleId: "general_executor",
        runKind: "task_run",
        status: "pending",
        inputRef: null,
        traceId: `trace-exec-status-${i}`,
        attempt: i + 1,
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
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        updatedAt: new Date(2026, 3, 23, 10, i).toISOString(),
      });
    }

    const approvals: Array<ApprovalRecord["status"]> = ["pending", "approved", "pending", "rejected"];
    const approvalIds = ["approval-status-001", "approval-status-002", "approval-status-003", "approval-status-004"];

    for (let i = 0; i < approvals.length; i++) {
      const approval: ApprovalRecord = {
        id: approvalIds[i],
        taskId: "task-approval-status",
        executionId: `exec-status-${i}`,
        status: approvals[i],
        requestJson: "{}",
        responseJson: null,
        timeoutPolicy: "{}",
        createdAt: new Date(2026, 3, 23, 10, i).toISOString(),
        respondedAt: approvals[i] !== "pending" ? new Date(2026, 3, 23, 11, i).toISOString() : null,
      };
      await harness.approvalRepo.insertApproval(approval);
    }

    const pending = await harness.approvalRepo.listApprovalsByStatus("pending");
    assert.equal(pending.length, 2);

    const approved = await harness.approvalRepo.listApprovalsByStatus("approved");
    assert.equal(approved.length, 1);

    const rejected = await harness.approvalRepo.listApprovalsByStatus("rejected");
    assert.equal(rejected.length, 1);
  });

  test("insertTakeoverSession and getTakeoverSession roundtrip", async () => {
    await insertTestExecution("exec-takeover-001", "task-takeover-001", "tenant-takeover");

    const session = {
      id: "takeover-001",
      taskId: "task-takeover-001",
      executionId: "exec-takeover-001",
      operatorId: "operator-001",
      status: "active" as const,
      reasonCode: "manual_intervention",
      startedAt: "2026-04-23T10:00:00.000Z",
      closedAt: null,
    };

    await harness.approvalRepo.insertTakeoverSession(session);
    const retrieved = await harness.approvalRepo.getTakeoverSession("takeover-001", "tenant-takeover");

    assert.equal(retrieved?.id, "takeover-001");
    assert.equal(retrieved?.operatorId, "operator-001");
    assert.equal(retrieved?.status, "active");
  });

  test("closeTakeoverSession updates status and closed_at", async () => {
    await insertTestExecution("exec-takeover-close", "task-takeover-close", "tenant-takeover-close");

    const session = {
      id: "takeover-close-001",
      taskId: "task-takeover-close",
      executionId: "exec-takeover-close",
      operatorId: "operator-001",
      status: "active" as const,
      reasonCode: "manual_intervention",
      startedAt: "2026-04-23T10:00:00.000Z",
      closedAt: null,
    };

    await harness.approvalRepo.insertTakeoverSession(session);
    const affected = await harness.approvalRepo.closeTakeoverSession("takeover-close-001", "2026-04-23T11:00:00.000Z");
    assert.equal(affected, 1);

    const retrieved = await harness.approvalRepo.getTakeoverSession("takeover-close-001", "tenant-takeover-close");
    assert.equal(retrieved?.status, "closed");
    assert.equal(retrieved?.closedAt, "2026-04-23T11:00:00.000Z");
  });
});
