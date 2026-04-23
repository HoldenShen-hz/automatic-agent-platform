// @ts-nocheck
import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { SqliteDatabase } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { SqliteAsyncAdapter } from "../../../../../../src/platform/state-evidence/truth/sqlite/sqlite-async-adapter.js";
import { AsyncApprovalRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/approval-repository.js";
import { AsyncTaskRepository } from "../../../../../../src/platform/state-evidence/truth/async-repositories/task-repository.js";
import { createTempWorkspace, cleanupPath } from "../../../../../helpers/fs.js";
import type { ApprovalRecord, TaskRecord } from "../../../../../../src/platform/contracts/types/domain.js";

test.skip("AsyncApprovalRepository", (group) => {
  let harness: {
    workspace: string;
    dbPath: string;
    db: SqliteDatabase;
    adapter: SqliteAsyncAdapter;
    approvalRepo: AsyncApprovalRepository;
    taskRepo: AsyncTaskRepository;
    cleanup: () => void;
  };

  group.beforeEach(async () => {
    const workspace = createTempWorkspace("aa-async-approval-repo-");
    const dbPath = join(workspace, "approval-repo.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const adapter = new SqliteAsyncAdapter(db);
    const approvalRepo = new AsyncApprovalRepository(adapter.asyncConnection);
    const taskRepo = new AsyncTaskRepository(adapter.asyncConnection);

    harness = {
      workspace,
      dbPath,
      db,
      adapter,
      approvalRepo,
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
      status: "pending_approval",
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

  test("insertApproval and getApproval roundtrip", async () => {
    await insertTestTask("task-approval-001", "tenant-approval");

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
    await insertTestTask("task-approval-tenant", "tenant-a");

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
    await insertTestTask("task-approval-list", "tenant-approval-list");

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
    await insertTestTask("task-approval-update", "tenant-approval-update");

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
    await insertTestTask("task-approval-status", "tenant-approval-status");

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
    await insertTestTask("task-takeover-001", "tenant-takeover");

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
    await insertTestTask("task-takeover-close", "tenant-takeover-close");

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
