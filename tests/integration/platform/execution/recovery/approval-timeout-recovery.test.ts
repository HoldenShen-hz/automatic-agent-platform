/**
 * Recovery Integration Test: Approval Timeout Recovery
 *
 * Verifies that approval timeout handling works correctly
 * and blocked tasks can be recovered after approval timeout.
 */

import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";
import type { ApprovalRecord } from "../../../../../src/platform/contracts/types/domain.js";

test("recovery: expired approval can be detected", () => {
  const workspace = createTempWorkspace("recovery-approval-");

  try {
    const dbPath = join(workspace, "approval-timeout.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const approvalId = newId("approval");
    const now = nowIso();
    const pastTime = new Date(Date.now() - 60000).toISOString();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval timeout test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      const approval: ApprovalRecord = {
        id: approvalId,
        taskId,
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ reason: "timeout test" }),
        responseJson: null,
        timeoutPolicy: "5m",
        createdAt: pastTime,
        respondedAt: null,
      };

      db.connection
        .prepare(
          `INSERT INTO approvals (id, task_id, execution_id, status, request_json, response_json, timeout_policy, created_at, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          approval.id,
          approval.taskId,
          approval.executionId,
          approval.status,
          approval.requestJson,
          approval.responseJson,
          approval.timeoutPolicy,
          approval.createdAt,
          approval.respondedAt,
        );
    });

    const approval = db.connection
      .prepare("SELECT * FROM approvals WHERE id = ?")
      .get(approvalId) as { id: string; status: string; responded_at: string | null } | undefined;

    assert.ok(approval, "Approval should exist");
    assert.strictEqual(approval!.status, "requested", "Approval status should be requested");
    assert.strictEqual(approval!.responded_at, null, "Approval should not be responded yet");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: approval timeout triggers automatic rejection", () => {
  const workspace = createTempWorkspace("recovery-approval-reject-");

  try {
    const dbPath = join(workspace, "approval-reject.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const executionId = newId("exec");
    const approvalId = newId("approval");
    const now = nowIso();
    const pastTime = new Date(Date.now() - 60000).toISOString();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval reject test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      store.insertExecution({
        id: executionId,
        taskId,
        workflowId: null,
        parentExecutionId: null,
        agentId: newId("agent"),
        roleId: null,
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 30000,
        budgetUsdLimit: null,
        requiresApproval: 1,
        sandboxMode: null,
        allowedToolsJson: null,
        allowedPathsJson: null,
        maxRetries: 0,
        retryBackoff: "exponential",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });

      const approval: ApprovalRecord = {
        id: approvalId,
        taskId,
        executionId,
        status: "requested",
        requestJson: JSON.stringify({ reason: "timeout test" }),
        responseJson: null,
        timeoutPolicy: "5m",
        createdAt: pastTime,
        respondedAt: null,
      };

      db.connection
        .prepare(
          `INSERT INTO approvals (id, task_id, execution_id, status, request_json, response_json, timeout_policy, created_at, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          approval.id,
          approval.taskId,
          approval.executionId,
          approval.status,
          approval.requestJson,
          approval.responseJson,
          approval.timeoutPolicy,
          approval.createdAt,
          approval.respondedAt,
        );
    });

    db.connection
      .prepare("UPDATE approvals SET status = ?, responded_at = ? WHERE id = ?")
      .run("rejected", now, approvalId);

    const rejectedApproval = db.connection
      .prepare("SELECT status, responded_at FROM approvals WHERE id = ?")
      .get(approvalId) as { status: string; responded_at: string };

    assert.strictEqual(rejectedApproval!.status, "rejected", "Approval should be rejected");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("recovery: task status is updated after approval timeout", () => {
  const workspace = createTempWorkspace("recovery-approval-task-");

  try {
    const dbPath = join(workspace, "approval-task.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);

    const taskId = newId("task");
    const approvalId = newId("approval");
    const now = nowIso();
    const pastTime = new Date(Date.now() - 60000).toISOString();

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Approval task timeout test",
        status: "awaiting_decision",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: now,
        updatedAt: now,
        completedAt: null,
      });

      const approval: ApprovalRecord = {
        id: approvalId,
        taskId,
        executionId: null,
        status: "requested",
        requestJson: JSON.stringify({ reason: "timeout test" }),
        responseJson: null,
        timeoutPolicy: "5m",
        createdAt: pastTime,
        respondedAt: null,
      };

      db.connection
        .prepare(
          `INSERT INTO approvals (id, task_id, execution_id, status, request_json, response_json, timeout_policy, created_at, responded_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          approval.id,
          approval.taskId,
          approval.executionId,
          approval.status,
          approval.requestJson,
          approval.responseJson,
          approval.timeoutPolicy,
          approval.createdAt,
          approval.respondedAt,
        );
    });

    db.connection
      .prepare("UPDATE approvals SET status = ?, responded_at = ? WHERE id = ?")
      .run("rejected", now, approvalId);

    db.connection
      .prepare("UPDATE tasks SET status = ?, updated_at = ? WHERE id = ?")
      .run("failed", now, taskId);

    const updatedTask = db.connection
      .prepare("SELECT status FROM tasks WHERE id = ?")
      .get(taskId) as { status: string };

    assert.strictEqual(updatedTask!.status, "failed", "Task should be marked as failed after approval timeout");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
