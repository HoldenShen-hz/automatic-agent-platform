/**
 * Integration Test: Harness Workflow Integration
 *
 * Tests harness workflow execution with task store integration,
 * verifying multi-step orchestration with constraint packs.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessDecisionAction,
} from "../../../../../src/platform/orchestration/harness/index.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createWorkflowContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/workflow.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Harness workflow progresses through planner->generator->evaluator with guardrail escalation recorded", () => {
  const ctx = createWorkflowContext("aa-harness-wf-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001", "policy_002"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash", "read", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: ["execution_trace"], redactSensitiveData: true },
      budget: { maxSteps: 20, maxCost: 2.0, maxDurationMs: 120000 },
    };

    const run = service.runLoop({
      taskId: "task_wf_001",
      domainId: "coding",
      constraintPack,
      plannerOutput: { planId: "plan_wf_001", summary: "Test workflow plan", checkpoints: ["step1", "step2"] },
      generatorOutput: { stepOutputs: [{ stepName: "execute", result: "success" }], toolCalls: [] },
      evaluatorOutput: { score: 0.85, verdict: "accept", evidenceRefs: ["exec_trace_001"] },
      evaluatorScore: 0.85,
      producedEvidenceRefs: ["exec_trace_001"],
    });

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");
    assert.equal(run.steps.length, 3);
    assert.equal(run.steps[0]?.role, "planner");
    assert.equal(run.steps[1]?.role, "generator");
    assert.equal(run.steps[2]?.role, "evaluator");
    assert.ok(run.decision);
    assert.equal(run.decision?.action, "escalate_to_human");
    assert.equal(run.hitlRequest?.reason, "guardrail_or_operator_escalation");
    assert.ok(run.feedbackEnvelope);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow decision logic exposes replan when evaluator score < 0.5", () => {
  const ctx = createWorkflowContext("aa-harness-replan-wf-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_replan_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task_replan_001" },
      outputs: { planId: "plan_bad_001", summary: "Bad plan" },
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan_bad_001" },
      outputs: { stepOutputs: [], toolCalls: [] },
    });

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: { stepOutputs: [] },
      outputs: { score: 0.3, verdict: "replan" },
    });

    const decision = service.decide({ evaluatorScore: 0.3 });
    assert.equal(decision.action, "replan");

    assert.equal(run.feedbackEnvelope, null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow opens HITL review when requiresHuman is true", () => {
  const ctx = createWorkflowContext("aa-harness-hitl-wf-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: ["security_scan"], redactSensitiveData: true },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_hitl_001",
      domainId: "security",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task_hitl_001" },
      outputs: { planId: "plan_hitl_001" },
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan_hitl_001" },
      outputs: { stepOutputs: [{ stepName: "security_scan", flags: ["-v"] }], toolCalls: [] },
    });

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: { stepOutputs: [] },
      outputs: { score: 0.6, verdict: "escalate" },
    });

    run = service.openHitlReview(run, "Security scan requires human review", ["security_scan_result"]);

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.reason, "Security scan requires human review");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow resolves HITL approval and continues", () => {
  const ctx = createWorkflowContext("aa-harness-resolve-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_resolve_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.openHitlReview(run, "Needs approval", ["evidence_001"]);

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");

    run = service.resolveHitlReview(run, "approved", "operator_001");

    assert.equal(run.status, "running");
    assert.ok(run.hitlRequest?.resolvedAt);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow aborts when max iterations reached", () => {
  const ctx = createWorkflowContext("aa-harness-max-iter-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 3, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_max_iter_001",
      domainId: "coding",
      constraintPack,
    });

    for (let i = 0; i < 3; i++) {
      run = service.appendStep(run, {
        role: "planner",
        stage: "plan",
        inputs: { iteration: i + 1 },
        outputs: { planId: `plan_iter_${i + 1}` },
        iteration: i + 1,
      });
      run = service.appendStep(run, {
        role: "generator",
        stage: "execute",
        inputs: { planId: `plan_iter_${i + 1}` },
        outputs: { stepOutputs: [] },
        iteration: i + 1,
      });
      run = service.appendStep(run, {
        role: "evaluator",
        stage: "evaluate",
        inputs: {},
        outputs: { score: 0.6 },
        iteration: i + 1,
      });
    }

    assert.equal(run.steps.length, 9);
    assert.equal(run.currentIteration, 3);

    const decision = service.decide({ evaluatorScore: 0.6, maxIterationsReached: true });
    assert.equal(decision.action, "abort");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow recovers from checkpoint", () => {
  const ctx = createWorkflowContext("aa-harness-recover-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "none",
      autonomyMode: "auto",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 70 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_recover_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: {},
      outputs: { planId: "plan_recover_001" },
    });

    run = service.recover(run);

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "recovery");
    assert.ok(run.recoveryCheckpoint);
    assert.ok(run.recoveryCheckpoint?.lastCompletedStepId);
    assert.equal(run.recoveryCheckpoint?.statusBeforeRecovery, "created");

    run = service.resume(run);
    assert.equal(run.status, "running");
    assert.ok(!run.recoveryCheckpoint);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness workflow stores task and execution in SQLite via store", () => {
  const ctx = createWorkflowContext("aa-harness-store-");
  try {
    const taskId = "task_store_001";
    const executionId = "exec_store_001";
    const now = nowIso();

    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "general_ops",
        title: "Harness workflow store test",
        status: "in_progress",
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

      ctx.store.insertExecution({
        id: executionId,
        taskId,
        workflowId: "harness_workflow",
        parentExecutionId: null,
        agentId: "harness_agent",
        roleId: "planner",
        runKind: "task_run",
        status: "executing",
        inputRef: null,
        traceId: "trace_harness_001",
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
        startedAt: now,
        finishedAt: null,
        createdAt: now,
        updatedAt: now,
      });
    });

    const persistedTask = ctx.store.getTask(taskId);
    const persistedExec = ctx.store.getExecution(executionId);

    assert.ok(persistedTask);
    assert.equal(persistedTask?.title, "Harness workflow store test");
    assert.ok(persistedExec);
    assert.equal(persistedExec?.workflowId, "harness_workflow");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
