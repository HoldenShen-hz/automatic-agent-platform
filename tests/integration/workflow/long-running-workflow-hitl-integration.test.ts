import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ApprovalService } from "../../../src/platform/control-plane/approval-center/approval-service.js";
import { newId, nowIso } from "../../../src/platform/contracts/types/ids.js";
import { LongRunningWorkflowService } from "../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { HitlApprovalOrchestrationService } from "../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { HITLExplainabilityService } from "../../../src/platform/orchestration/hitl/hitl-explainability-service.js";
import { AuthoritativeTaskStore } from "../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../helpers/fs.js";

test("integration: workflow sleep and HITL approval resolve into resumable workflow state", async () => {
  const workspace = createTempWorkspace("aa-workflow-hitl-integration-");
  const dbPath = join(workspace, "workflow-hitl.db");

  try {
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    const now = nowIso();
    const taskId = newId("task");
    const executionId = newId("exec");

    db.transaction(() => {
      store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Workflow with approval wait",
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
        workflowId: "wf_ops",
        parentExecutionId: null,
        agentId: "agent_ops",
        roleId: "operator",
        runKind: "task_run",
        status: "blocked",
        inputRef: null,
        traceId: newId("trace"),
        attempt: 1,
        timeoutMs: 60000,
        budgetUsdLimit: 1,
        requiresApproval: 1,
        sandboxMode: null,
        allowedToolsJson: "[]",
        allowedPathsJson: "[]",
        maxRetries: 0,
        retryBackoff: "none",
        lastErrorCode: null,
        lastErrorMessage: null,
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
      store.insertWorkflowState({
        taskId,
        divisionId: "general_ops",
        workflowId: "wf_ops",
        currentStepIndex: 1,
        status: "running",
        outputsJson: JSON.stringify({ intake: "done" }),
        lastErrorCode: null,
        retryCount: 0,
        resumableFromStep: null,
        startedAt: now,
        updatedAt: now,
      });
    });

    const workflowService = new LongRunningWorkflowService(store);
    const approvalService = new ApprovalService(db, store);
    const explainabilityService = new HITLExplainabilityService(store);
    const hitlService = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const suspension = workflowService.suspend({
      taskId,
      executionId,
      reasonCode: "awaiting_approval",
      waitKind: "human_input",
      resumableFromStep: "manual_approval",
      timeoutPolicy: "remain_pending",
      resumeAfter: "2026-04-20T10:00:00.000Z",
    });
    const packet = await hitlService.requestApproval({
      taskId,
      executionId,
      sourceAgentId: "agent_ops",
      title: "Approve rollout",
      reason: "Need operator approval before rollout",
      riskLevel: "high",
      stageRef: "release",
      options: [
        { optionId: "advance_rollout", label: "Advance", style: "primary", requiresConfirm: true },
        { optionId: "rollback", label: "Rollback", style: "danger", requiresConfirm: true },
      ],
      recommendedOptionId: "advance_rollout",
      timeoutPolicy: "reject",
    });

    assert.equal(store.getWorkflowState(taskId)?.status, "paused");
    assert.equal(packet.feedbackLink.stageRef, "release");

    workflowService.markDue("2026-04-20T10:01:00.000Z");
    hitlService.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "option_selected",
      selectedOptionId: "advance_rollout",
      respondedBy: "operator_release",
      respondedAt: "2026-04-20T10:01:00.000Z",
    });
    const resume = workflowService.resume(suspension.suspensionId, "2026-04-20T10:01:00.000Z");

    assert.equal(resume.allowed, true);
    assert.equal(store.getWorkflowState(taskId)?.status, "resuming");
    assert.equal(store.listEventsForTask(taskId).some((event) => event.eventType === "workflow:resume_requested"), true);

    db.close();
  } finally {
    cleanupPath(workspace);
  }
});
