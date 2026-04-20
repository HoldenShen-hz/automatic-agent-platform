import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { ApprovalService } from "../../../../src/platform/control-plane/approval-center/approval-service.js";
import { LongRunningWorkflowService } from "../../../../src/platform/interface/scheduler/long-running-workflow-service.js";
import { HitlApprovalOrchestrationService } from "../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { HITLExplainabilityService } from "../../../../src/platform/orchestration/hitl/hitl-explainability-service.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";

function createHarness(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "workflow-hitl-contracts.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("contract: workflow cannot resume before its sleep window is due", () => {
  const h = createHarness("aa-workflow-contract-not-due-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_contract_sleep_1", executionId: "exec_contract_sleep_1" });
    const now = nowIso();
    h.store.insertWorkflowState({
      taskId: "task_contract_sleep_1",
      divisionId: "general_ops",
      workflowId: "wf_contract",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    const suspension = service.suspend({
      taskId: "task_contract_sleep_1",
      executionId: "exec_contract_sleep_1",
      reasonCode: "wait_human",
      waitKind: "human_input",
      resumableFromStep: "approval_step",
      resumeAfter: "2026-04-20T10:00:00.000Z",
      timeoutPolicy: "remain_pending",
    });

    const decision = service.resume(suspension.suspensionId, "2026-04-20T09:59:00.000Z");
    assert.equal(decision.allowed, false);
    assert.equal(decision.reasonCode, "workflow_sleep.resume_not_due");
    assert.equal(h.store.getWorkflowState("task_contract_sleep_1")?.status, "paused");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("contract: expired workflow sleep with fail policy must move workflow into failed state", () => {
  const h = createHarness("aa-workflow-contract-expire-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_contract_sleep_2", executionId: "exec_contract_sleep_2" });
    const now = nowIso();
    h.store.insertWorkflowState({
      taskId: "task_contract_sleep_2",
      divisionId: "general_ops",
      workflowId: "wf_contract",
      currentStepIndex: 1,
      status: "running",
      outputsJson: "{}",
      lastErrorCode: null,
      retryCount: 0,
      resumableFromStep: null,
      startedAt: now,
      updatedAt: now,
    });

    const service = new LongRunningWorkflowService(h.store);
    service.suspend({
      taskId: "task_contract_sleep_2",
      executionId: "exec_contract_sleep_2",
      reasonCode: "timer_expired",
      waitKind: "timer",
      resumableFromStep: "delayed_step",
      expiresAt: "2026-04-20T10:00:00.000Z",
      timeoutPolicy: "fail_workflow",
    });

    service.sweepExpired("2026-04-20T10:01:00.000Z");
    assert.equal(h.store.getWorkflowState("task_contract_sleep_2")?.status, "failed");
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});

test("contract: critical HITL approvals cannot default to approve on timeout without break-glass", async () => {
  const h = createHarness("aa-hitl-contract-critical-");
  try {
    seedTaskAndExecution(h.db, h.store, { taskId: "task_contract_hitl_1", executionId: "exec_contract_hitl_1" });
    const approvalService = new ApprovalService(h.db, h.store);
    const explainability = new HITLExplainabilityService(h.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainability);

    await assert.rejects(async () => {
      await service.requestApproval({
        taskId: "task_contract_hitl_1",
        executionId: "exec_contract_hitl_1",
        sourceAgentId: "agent_release",
        title: "Critical rollout approval",
        reason: "Prod release",
        riskLevel: "critical",
        stageRef: "release",
        options: [
          { optionId: "advance_rollout", label: "Advance", style: "primary", requiresConfirm: true },
        ],
        timeoutPolicy: "approve",
      });
    }, /hitl_approval\.critical_timeout_auto_approve_forbidden/);
  } finally {
    h.db.close();
    cleanupPath(h.workspace);
  }
});
