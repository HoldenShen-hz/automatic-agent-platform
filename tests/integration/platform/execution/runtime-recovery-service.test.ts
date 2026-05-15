import assert from "node:assert/strict";
import { join } from "node:path";
import test from "node:test";

import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import { runSingleTaskExecution } from "../../../../src/platform/five-plane-execution/execution-engine/single-task-execution.js";
import { RuntimeRecoveryService } from "../../../../src/platform/five-plane-execution/recovery/runtime-recovery-service-root.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { newId } from "../../../../src/platform/contracts/types/ids.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";

test("runtime recovery service builds a task recovery view from persisted prechecks and repair events", async () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-");
  const dbPath = join(workspace, "runtime-recovery.db");

  try {
    const snapshot = await runSingleTaskExecution({
      dbPath,
      title: "Runtime recovery view",
      request: "Persist runtime precheck state for recovery inspection.",
    });

    const db = new SqliteDatabase(dbPath);
    const store = new AuthoritativeTaskStore(db);
    const recovery = new RuntimeRecoveryService(store);

    store.insertEvent({
      id: newId("evt"),
      taskId: snapshot.task.id,
      executionId: snapshot.execution?.id ?? null,
      eventType: "recovery:repair_applied",
      eventTier: "tier_2",
      payloadJson: JSON.stringify({
        repairAction: "requeue_execution",
        targetId: snapshot.execution?.id ?? null,
      }),
      traceId: snapshot.execution?.traceId ?? null,
      createdAt: "2026-04-04T10:05:00.000Z",
    });

    const precheck = store.getExecutionPrecheck(snapshot.execution?.id ?? "");
    const view = recovery.buildRuntimeRecoveryView(snapshot.task.id);

    assert.equal(precheck?.allowed, 1);
    assert.equal(view.candidates.length, 1);
    assert.equal(view.candidates[0]?.latestPrecheck?.allowed, true);
    assert.equal(view.candidates[0]?.latestPrecheck?.resolvedSandboxMode, "workspace_write");
    assert.equal(view.deadLetters.length, 0);
    assert.equal(view.latestCheckpoint?.stepId, "analyze_request");
    assert.equal(view.latestCheckpoint?.summary, "Analyzed request for Runtime recovery view");
    assert.deepEqual(view.latestCheckpoint?.outputKeys, ["analysis"]);
    assert.equal(view.recentRecoveryEvents[0]?.repairAction, "requeue_execution");

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});

test("runtime recovery service groups stale and approval-blocked runs by division", () => {
  const workspace = createTempWorkspace("aa-runtime-recovery-divisions-");

  try {
    const db = new SqliteDatabase(join(workspace, "runtime-recovery-divisions.db"));
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const approvalService = new ApprovalService(db, store);

    db.transaction(() => {
      store.insertTask({
        id: "task-general-stale",
        parentId: null,
        rootId: "task-general-stale",
        divisionId: "general_ops",
        title: "General stale task",
        status: "in_progress",
        source: "user",
        priority: "normal",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: "2026-04-04T09:00:00.000Z",
        updatedAt: "2026-04-04T09:00:00.000Z",
        completedAt: null,
      });
      store.insertExecution({
        id: "exec-general-stale",
        taskId: "task-general-stale",
        workflowId: "single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-general",
        roleId: "general_executor",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace-general-stale",
        attempt: 1,
        timeoutMs: 1200,
        budgetUsdLimit: 1,
        requiresApproval: 0,
        sandboxMode: "workspace_write",
        allowedToolsJson: JSON.stringify(["analysis"]),
        allowedPathsJson: JSON.stringify([]),
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: "2026-04-04T09:00:00.000Z",
        finishedAt: null,
        createdAt: "2026-04-04T09:00:00.000Z",
        updatedAt: "2026-04-04T09:01:00.000Z",
      });
      store.insertExecutionPrecheck({
        id: "precheck-general-stale",
        executionId: "exec-general-stale",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 1,
        resolvedTimeoutMs: 1200,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T09:00:05.000Z",
      });
      store.insertHeartbeatSnapshot({
        id: "hb-general-stale",
        executionId: "exec-general-stale",
        agentId: "agent-general",
        runtimeInstanceId: null,
        restartGeneration: 0,
        status: "executing",
        progressMessage: "still running",
        cpuPct: 12,
        memoryMb: 64,
        sampledAt: "2026-04-04T09:01:30.000Z",
      });

      store.insertTask({
        id: "task-engineering-blocked",
        parentId: null,
        rootId: "task-engineering-blocked",
        divisionId: "engineering_ops",
        title: "Engineering blocked task",
        status: "in_progress",
        source: "user",
        priority: "high",
        inputJson: "{}",
        normalizedInputJson: "{}",
        outputJson: null,
        estimatedCostUsd: 0,
        actualCostUsd: 0,
        errorCode: null,
        createdAt: "2026-04-04T09:10:00.000Z",
        updatedAt: "2026-04-04T09:10:00.000Z",
        completedAt: null,
      });
      store.insertExecution({
        id: "exec-engineering-blocked",
        taskId: "task-engineering-blocked",
        workflowId: "engineering_single_agent_minimal",
        parentExecutionId: null,
        agentId: "agent-engineering",
        roleId: "engineer",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: "trace-engineering-blocked",
        attempt: 1,
        timeoutMs: 1800,
        budgetUsdLimit: 2,
        requiresApproval: 1,
        sandboxMode: "workspace_write",
        allowedToolsJson: JSON.stringify(["analysis"]),
        allowedPathsJson: JSON.stringify([]),
        maxRetries: 1,
        retryBackoff: "linear",
        lastErrorCode: "approval_required",
        lastErrorMessage: "approval pending",
        startedAt: "2026-04-04T09:10:00.000Z",
        finishedAt: null,
        createdAt: "2026-04-04T09:10:00.000Z",
        updatedAt: "2026-04-04T09:11:00.000Z",
      });
      store.insertExecutionPrecheck({
        id: "precheck-engineering-blocked",
        executionId: "exec-engineering-blocked",
        allowed: 1,
        reasonCode: null,
        resolvedBudgetUsd: 2,
        resolvedTimeoutMs: 1800,
        resolvedSandboxMode: "workspace_write",
        resolvedToolsJson: JSON.stringify(["analysis"]),
        resolvedPathsJson: JSON.stringify([]),
        checkedAt: "2026-04-04T09:10:05.000Z",
      });
    });

    approvalService.createRequest({
      taskId: "task-engineering-blocked",
      executionId: "exec-engineering-blocked",
      sourceAgentId: "agent-engineering",
      reason: "Need engineering approval",
      riskLevel: "high",
      options: ["approve", "reject"],
      context: { source: "runtime-recovery-test" },
      timeoutPolicy: "reject",
    });

    const recovery = new RuntimeRecoveryService(store);
    const staleRuns = recovery.listStaleRuns("2026-04-04T09:05:00.000Z");
    const blockedRuns = recovery.listBlockedRunsAwaitingApproval();
    const overview = recovery.listDivisionRecoveryOverview("2026-04-04T09:05:00.000Z");

    assert.equal(staleRuns.length, 1);
    assert.equal(staleRuns[0]?.executionId, "exec-general-stale");
    assert.equal(staleRuns[0]?.suggestedAction, "retry_new_ticket");
    assert.equal(blockedRuns.length, 1);
    assert.equal(blockedRuns[0]?.executionId, "exec-engineering-blocked");
    assert.equal(blockedRuns[0]?.suggestedAction, "escalate_takeover");
    assert.equal(overview.length, 2);
    assert.deepEqual(
      overview.map((item) => ({
        divisionId: item.divisionId,
        blockedApprovalCount: item.blockedApprovalCount,
        staleExecutionCount: item.staleExecutionCount,
      })),
      [
        {
          divisionId: "engineering_ops",
          blockedApprovalCount: 1,
          staleExecutionCount: 0,
        },
        {
          divisionId: "general_ops",
          blockedApprovalCount: 0,
          staleExecutionCount: 1,
        },
      ],
    );

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
