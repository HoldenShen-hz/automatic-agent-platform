/**
 * Integration Test: Harness HITL Integration
 *
 * Tests harness human-in-the-loop integration with SQLite
 * and task store, verifying approval workflows.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { HarnessRuntimeService, type ConstraintPack } from "../../../../../src/platform/orchestration/harness/index.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { newId, nowIso } from "../../../../../src/platform/contracts/types/ids.js";

function createHitlContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = `${workspace}/hitl.db`;
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, db, store };
}

test("Harness opens HITL review and stores request in SQLite", () => {
  const ctx = createHitlContext("aa-hitl-open-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_hitl_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash", "write", "delete"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: ["security_scan", "code_review"], redactSensitiveData: true },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_hitl_open_001",
      domainId: "security",
      constraintPack,
    });

    run = service.appendStep(run, {
      role: "planner",
      stage: "plan",
      inputs: { taskId: "task_hitl_open_001" },
      outputs: { planId: "plan_sec_001" },
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: { planId: "plan_sec_001" },
      outputs: { stepOutputs: [{ tool: "delete", target: "/protected" }] },
    });

    run = service.appendStep(run, {
      role: "evaluator",
      stage: "evaluate",
      inputs: {},
      outputs: { score: 0.55, flags: ["requires_approval"] },
    });

    run = service.openHitlReview(
      run,
      "High-risk delete operation requires human review",
      ["security_scan_001", "code_review_001"],
    );

    assert.equal(run.status, "waiting_hitl");
    assert.ok(run.hitlRequest);
    assert.equal(run.hitlRequest?.domainId, "security");

    const taskId = "task_hitl_open_001";
    const now = nowIso();
    ctx.db.transaction(() => {
      ctx.store.insertTask({
        id: taskId,
        parentId: null,
        rootId: taskId,
        divisionId: "security_ops",
        title: "HITL review task",
        status: "awaiting_decision",
        source: "user",
        priority: "high",
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
    });

    const persistedTask = ctx.store.getTask(taskId);
    assert.ok(persistedTask);
    assert.equal(persistedTask?.status, "awaiting_decision");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness resolves HITL review as approved", () => {
  const ctx = createHitlContext("aa-hitl-approve-");
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
      taskId: "task_hitl_approve_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.openHitlReview(run, "Needs approval", ["evidence_001"]);
    assert.equal(run.status, "waiting_hitl");

    run = service.resolveHitlReview(run, "approved", "operator_jane_doe");

    assert.equal(run.status, "running");
    assert.ok(run.hitlRequest?.resolvedAt);
    assert.equal(run.hitlRequest?.resolvedBy, "operator_jane_doe");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness resolves HITL review as rejected and aborts", () => {
  const ctx = createHitlContext("aa-hitl-reject-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_hitl_reject_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.openHitlReview(run, "Security concern", ["scan_result"]);
    assert.equal(run.status, "waiting_hitl");

    run = service.resolveHitlReview(run, "rejected", "operator_john_smith");

    assert.equal(run.status, "aborted");
    assert.ok(run.completedAt);
    assert.ok(run.hitlRequest?.resolvedAt);
    assert.equal(run.hitlRequest?.resolvedBy, "operator_john_smith");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness with guardrail assessment triggers escalation", () => {
  const ctx = createHitlContext("aa-hitl-guardrail-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_guardrail_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 60, escalationThreshold: 40 },
      output_policy: { requiredEvidence: ["audit_log"], redactSensitiveData: true },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    assert.throws(
      () => service.runLoop({
        taskId: "task_guardrail_001",
        domainId: "security",
        constraintPack,
        plannerOutput: { planId: "plan_guardrail_001" },
        generatorOutput: { stepOutputs: [{ tool: "bash", command: "rm -rf /important" }] },
        evaluatorOutput: { score: 0.65 },
        evaluatorScore: 0.65,
        riskScore: 75,
        producedEvidenceRefs: ["audit_log"],
      }),
      /harness\.invariant_violation:harness\.invariant\.max_risk_exceeded/,
    );
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness HITL stores multiple evidence refs", () => {
  const ctx = createHitlContext("aa-hitl-evidence-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash", "read", "write"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: ["scan", "review", "approval"], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 60000 },
    };

    let run = service.createRun({
      taskId: "task_evidence_001",
      domainId: "compliance",
      constraintPack,
    });

    run = service.openHitlReview(run, "Compliance checkpoint", [
      "security_scan_result",
      "code_review_result",
      "manager_approval",
    ]);

    assert.ok(run.hitlRequest);
    assert.ok(run.hitlRequest?.evidenceRefs.includes("security_scan_result"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("code_review_result"));
    assert.ok(run.hitlRequest?.evidenceRefs.includes("manager_approval"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness recovers from HITL timeout scenario", () => {
  const ctx = createHitlContext("aa-hitl-timeout-");
  try {
    const service = new HarnessRuntimeService();
    const constraintPack: ConstraintPack = {
      policyIds: ["policy_001"],
      approvalMode: "required",
      autonomyMode: "supervised",
      toolPolicy: { allowedTools: ["bash"] },
      risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
      output_policy: { requiredEvidence: [], redactSensitiveData: false },
      budget: { maxSteps: 10, maxCost: 1.0, maxDurationMs: 30000 },
    };

    let run = service.createRun({
      taskId: "task_timeout_001",
      domainId: "coding",
      constraintPack,
    });

    run = service.openHitlReview(run, "Awaiting operator", ["pending_review"]);

    run = service.recover(run);
    assert.equal(run.status, "recovering");

    run = service.resume(run);
    assert.equal(run.status, "running");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});
