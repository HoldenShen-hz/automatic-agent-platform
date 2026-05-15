/**
 * Integration Test: HITL (Human-in-the-Loop)
 *
 * Tests HITL decision flow integration including HitlApprovalOrchestrationService,
 * HitlInboxService, HITLExplainabilityService, HitlRuntime, and HarnessRuntimeService
 * using SQLite context.
 */

import * as assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";

import { SqliteDatabase } from "../../../../src/platform/five-plane-state-evidence/truth/sqlite/sqlite-database.js";
import { AuthoritativeTaskStore } from "../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { createIntegrationContext, createSeededIntegrationContext } from "../../../helpers/integration-context.js";
import { cleanupPath, createTempWorkspace } from "../../../helpers/fs.js";
import { nowIso } from "../../../../src/platform/contracts/types/ids.js";
import { seedTaskAndExecution } from "../../../helpers/seed.js";
import { ApprovalService } from "../../../../src/platform/five-plane-control-plane/approval-center/approval-service.js";
import {
  HitlApprovalOrchestrationService,
  type ApprovalPacket,
  type HitlApprovalRequest,
  type ApprovalPacketOption,
} from "../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import { HitlInboxService } from "../../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";
import { HITLExplainabilityService } from "../../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { HitlRuntime } from "../../../../src/platform/five-plane-orchestration/harness/hitl-runtime.js";
import {
  HarnessRuntimeService,
  type ConstraintPack,
  type HarnessTimelineEvent,
} from "../../../../src/platform/five-plane-orchestration/harness/index.js";
import { HITL_MODES } from "../../../../src/platform/five-plane-orchestration/hitl/hitl-modes.js";

function createHitlContext(prefix: string) {
  const workspace = createTempWorkspace(prefix);
  const dbPath = join(workspace, "hitl-integration.db");
  const db = new SqliteDatabase(dbPath);
  db.migrate();
  const store = new AuthoritativeTaskStore(db);
  return { workspace, dbPath, db, store };
}

function makeConstraintPack(override: Partial<ConstraintPack> = {}): ConstraintPack {
  return {
    policyIds: ["policy_hitl_001"],
    approvalMode: "required",
    autonomyMode: "supervised",
    toolPolicy: { allowedTools: ["bash", "read", "write"] },
    risk_policy: { maxRiskScore: 80, escalationThreshold: 50 },
    output_policy: { requiredEvidence: [], redactSensitiveData: false },
    budget: { maxSteps: 5, maxCost: 2.0, maxDurationMs: 60000 },
    ...override,
  };
}

// ---------------------------------------------------------------------------
// HitlApprovalOrchestrationService tests
// ---------------------------------------------------------------------------

test("HITL approval orchestration creates packet and explanation for high-risk task", async () => {
  const ctx = createHitlContext("aa-hitl-approval-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_001", executionId: "exec_hitl_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_001",
      executionId: "exec_hitl_001",
      sourceAgentId: "planner_agent",
      title: "Production deployment approval",
      reason: "Deploy to production environment requires human approval",
      riskLevel: "high",
      stageRef: "release",
      options: [
        { optionId: "approve", label: "Approve deployment", style: "primary", requiresConfirm: true },
        { optionId: "reject", label: "Reject and revise", style: "danger", requiresConfirm: false },
        { optionId: "rollback", label: "Rollback changes", style: "secondary", requiresConfirm: true },
      ],
      recommendedOptionId: "approve",
      timeoutPolicy: "reject",
    });

    assert.ok(packet.approvalId.startsWith("approval_"));
    assert.equal(packet.taskId, "task_hitl_001");
    assert.equal(packet.explanation.decisionType, "approval_required");
    assert.equal(packet.feedbackLink.stageRef, "release");
    assert.equal(packet.options.length, 3);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration applies confirmed decision with continue effect", async () => {
  const ctx = createHitlContext("aa-hitl-confirm-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_002", executionId: "exec_hitl_002" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_002",
      executionId: "exec_hitl_002",
      sourceAgentId: "generator_agent",
      title: "Code review approval",
      reason: "PR requires approval before merge",
      riskLevel: "medium",
      stageRef: "execute",
      options: [
        { optionId: "confirm", label: "Approve", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "approve",
    });

    const result = service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "confirmed",
      confirmed: true,
      respondedBy: "operator_1",
      respondedAt: nowIso(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "continue");
    assert.equal(result.decision.decisionType, "confirmed");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration applies text_input decision with revise_plan effect", async () => {
  const ctx = createHitlContext("aa-hitl-text-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_003", executionId: "exec_hitl_003" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_003",
      executionId: "exec_hitl_003",
      sourceAgentId: "planner_agent",
      title: "Plan revision request",
      reason: "Need clarification on deployment strategy",
      riskLevel: "low",
      stageRef: "plan",
      options: [
        { optionId: "approve_candidate", label: "Approve", style: "primary", requiresConfirm: true },
        { optionId: "request_changes", label: "Request changes", style: "secondary", requiresConfirm: false },
      ],
      timeoutPolicy: "reject",
    });

    const result = service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "text_input",
      inputText: "Please revise the plan to use cn-sh region only",
      respondedBy: "operator_2",
      respondedAt: nowIso(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "revise_plan");
    assert.ok(result.feedbackLink.feedbackSignalId?.startsWith("feedback_signal_"));
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration applies rejected decision with block_candidate effect", async () => {
  const ctx = createHitlContext("aa-hitl-reject-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_004", executionId: "exec_hitl_004" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_004",
      executionId: "exec_hitl_004",
      sourceAgentId: "generator_agent",
      title: "Dangerous command approval",
      reason: "System modification requires explicit approval",
      riskLevel: "critical",
      stageRef: "execute",
      options: [
        { optionId: "block", label: "Block operation", style: "danger", requiresConfirm: false },
        { optionId: "proceed", label: "Proceed anyway", style: "danger", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const result = service.applyDecision({
      approvalId: packet.approvalId,
      decisionType: "rejected",
      respondedBy: "operator_3",
      respondedAt: nowIso(),
    });

    assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration builds timeout decision for approve policy", async () => {
  const ctx = createHitlContext("aa-hitl-timeout-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_005", executionId: "exec_hitl_005" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_005",
      executionId: "exec_hitl_005",
      sourceAgentId: "evaluator_agent",
      title: "Auto-approve test",
      reason: "Testing timeout behavior",
      riskLevel: "low",
      stageRef: "feedback",
      options: [
        { optionId: "confirm", label: "Confirm", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "approve",
    });

    const timeoutDecision = service.buildTimeoutDecision(packet.approvalId);
    assert.equal(timeoutDecision.decisionType, "confirmed");
    assert.equal(timeoutDecision.confirmed, true);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration builds timeout decision for reject policy", async () => {
  const ctx = createHitlContext("aa-hitl-expire-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_006", executionId: "exec_hitl_006" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_006",
      executionId: "exec_hitl_006",
      sourceAgentId: "evaluator_agent",
      title: "Expire test",
      reason: "Testing timeout behavior",
      riskLevel: "medium",
      stageRef: "feedback",
      options: [
        { optionId: "confirm", label: "Confirm", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const timeoutDecision = service.buildTimeoutDecision(packet.approvalId);
    assert.equal(timeoutDecision.decisionType, "expired");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval blocks critical auto-approve without break-glass", async () => {
  const ctx = createHitlContext("aa-hitl-critical-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_critical_001", executionId: "exec_hitl_critical_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    await assert.rejects(
      async () => {
        await service.requestApproval({
          taskId: "task_hitl_critical_001",
          executionId: "exec_hitl_critical_001",
          sourceAgentId: "agent_critical",
          title: "Critical production change",
          reason: "Requires explicit human approval",
          riskLevel: "critical",
          stageRef: "release",
          options: [
            { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true },
          ],
          timeoutPolicy: "approve",
        });
      },
      /hitl_approval\.critical_timeout_auto_approve_forbidden/,
      "Should reject critical risk level with approve timeout without break-glass",
    );
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval allows critical with break-glass approved", async () => {
  const ctx = createHitlContext("aa-hitl-breakglass-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_breakglass_001", executionId: "exec_hitl_breakglass_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task_hitl_breakglass_001",
      executionId: "exec_hitl_breakglass_001",
      sourceAgentId: "agent_breakglass",
      title: "Emergency production change",
      reason: "Break-glass scenario for emergency fix",
      riskLevel: "critical",
      stageRef: "release",
      options: [
        { optionId: "approve", label: "Emergency Approve", style: "danger", requiresConfirm: true },
      ],
      timeoutPolicy: "approve",
      breakGlassApproved: true,
    });

    assert.ok(packet.approvalId.startsWith("approval_"));
    assert.equal(packet.riskLevel, "critical");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL approval orchestration list and get packets", async () => {
  const ctx = createHitlContext("aa-hitl-list-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_list_001", executionId: "exec_hitl_list_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet1 = await service.requestApproval({
      taskId: "task_hitl_list_001",
      executionId: "exec_hitl_list_001",
      sourceAgentId: "agent_list_1",
      title: "First approval",
      reason: "Test listing",
      riskLevel: "low",
      stageRef: "plan",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const packet2 = await service.requestApproval({
      taskId: "task_hitl_list_001",
      executionId: "exec_hitl_list_001",
      sourceAgentId: "agent_list_2",
      title: "Second approval",
      reason: "Test listing multiple",
      riskLevel: "medium",
      stageRef: "execute",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const retrieved = service.getPacket(packet1.approvalId);
    assert.ok(retrieved, "Should retrieve packet by ID");
    assert.equal(retrieved!.title, "First approval");

    const allPackets = service.listPackets();
    assert.equal(allPackets.length, 2, "Should have 2 packets");

    const allFeedbackLinks = service.listFeedbackLinks();
    assert.equal(allFeedbackLinks.length, 2, "Should have 2 feedback links");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// HitlInboxService tests
// ---------------------------------------------------------------------------

test("HITL inbox service builds inbox items from approval packets", async () => {
  const ctx = createHitlContext("aa-hitl-inbox-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_inbox_001", executionId: "exec_hitl_inbox_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const orchestrationService = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
    const inboxService = new HitlInboxService();

    const packet = await orchestrationService.requestApproval({
      taskId: "task_hitl_inbox_001",
      executionId: "exec_hitl_inbox_001",
      sourceAgentId: "agent_inbox",
      title: "Inbox item test",
      reason: "Testing inbox building",
      riskLevel: "medium",
      stageRef: "execute",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
        { optionId: "reject", label: "Not OK", style: "danger", requiresConfirm: false },
      ],
      timeoutPolicy: "reject",
    });

    const items = inboxService.buildInbox([packet]);
    assert.equal(items.length, 1);
    assert.equal(items[0]!.itemId, `hitl_inbox:${packet.approvalId}`);
    assert.equal(items[0]!.taskId, "task_hitl_inbox_001");
    assert.equal(items[0]!.title, "Inbox item test");
    assert.equal(items[0]!.riskLevel, "medium");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL inbox service builds summary counts correctly", async () => {
  const ctx = createHitlContext("aa-hitl-inbox-summary-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_summary_001", executionId: "exec_hitl_summary_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const orchestrationService = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
    const inboxService = new HitlInboxService();

    const packet = await orchestrationService.requestApproval({
      taskId: "task_hitl_summary_001",
      executionId: "exec_hitl_summary_001",
      sourceAgentId: "agent_summary",
      title: "Summary test",
      reason: "Testing summary",
      riskLevel: "high",
      stageRef: "release",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    const items = inboxService.buildInbox([packet]);
    const summary = inboxService.buildSummary(items);

    assert.equal(summary.total, 1);
    assert.equal(summary.pending, 1);
    assert.equal(summary.critical, 0); // high, not critical
    assert.equal(summary.expired, 0);
    assert.equal(summary.decided, 0);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL inbox service resolves expired status from deadline", async () => {
  const ctx = createHitlContext("aa-hitl-inbox-expired-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_expired_001", executionId: "exec_hitl_expired_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const orchestrationService = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
    const inboxService = new HitlInboxService();

    // Create packet with past deadline
    const pastDeadline = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const packet = await orchestrationService.requestApproval({
      taskId: "task_hitl_expired_001",
      executionId: "exec_hitl_expired_001",
      sourceAgentId: "agent_expired",
      title: "Expired test",
      reason: "Testing expired status",
      riskLevel: "low",
      stageRef: "feedback",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
      deadlineAt: pastDeadline,
    });

    const items = inboxService.buildInbox([packet], []);
    assert.equal(items[0]!.status, "expired");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// HITLExplainabilityService tests
// ---------------------------------------------------------------------------

test("HITL explainability service generates decision explanation", () => {
  const ctx = createHitlContext("aa-hitl-explain-");
  try {
    const explainabilityService = new HITLExplainabilityService(ctx.store);

    const explanation = explainabilityService.explainApprovalRequired(
      "task_hitl_exp_001",
      {
        riskLevel: "high",
        policy: "production_deployment_policy",
        classification: "sensitive",
      },
      {
        executionId: "exec_hitl_exp_001",
        contextSnapshot: { taskId: "task_hitl_exp_001", deploymentTarget: "production" },
      },
    );

    assert.ok(explanation.explanationId.startsWith("explain_"));
    assert.equal(explanation.taskId, "task_hitl_exp_001");
    assert.equal(explanation.decisionType, "approval_required");
    assert.ok(explanation.factors.length >= 2, "Should have multiple decision factors");
    assert.ok(explanation.confidenceScore > 0, "Should have confidence score");
    assert.ok(explanation.recommendations.length > 0, "Should have recommendations");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL explainability service records and retrieves satisfaction feedback", () => {
  const ctx = createHitlContext("aa-hitl-feedback-");
  try {
    const explainabilityService = new HITLExplainabilityService(ctx.store);

    const feedback = explainabilityService.recordFeedback(
      4,
      "satisfaction",
      "operator_feedback_001",
      {
        taskId: "task_hitl_fb_001",
        comment: "Good decision, quick response",
        categories: ["decision_quality", "response_time"],
        followUpRequested: false,
      },
    );

    assert.ok(feedback.feedbackId.startsWith("fb_"));
    assert.equal(feedback.rating, 4);
    assert.equal(feedback.feedbackType, "satisfaction");

    const taskFeedback = explainabilityService.getFeedbackForTask("task_hitl_fb_001");
    assert.equal(taskFeedback.length, 1);
    assert.equal(taskFeedback[0]!.operatorId, "operator_feedback_001");

    const metrics = explainabilityService.getOperatorMetrics("operator_feedback_001");
    assert.equal(metrics.totalInterventions, 1);
    assert.equal(metrics.averageRating, 4);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL explainability service calculates overall satisfaction metrics", () => {
  const ctx = createHitlContext("aa-hitl-metrics-");
  try {
    const explainabilityService = new HITLExplainabilityService(ctx.store);

    explainabilityService.recordFeedback(5, "satisfaction", "op_a", {});
    explainabilityService.recordFeedback(4, "satisfaction", "op_b", {});
    explainabilityService.recordFeedback(2, "frustration", "op_c", { categories: ["response_time"] });

    const metrics = explainabilityService.getOverallSatisfactionMetrics();

    assert.equal(metrics.totalFeedback, 3);
    assert.ok(Math.abs(metrics.averageRating! - (5 + 4 + 2) / 3) < 0.1, "Average rating should be approximately 3.67");
    assert.equal(metrics.ratingDistribution[5], 1);
    assert.equal(metrics.ratingDistribution[2], 1);
    assert.ok(metrics.feedbackTypeDistribution.satisfaction >= 2);
    assert.ok(metrics.feedbackTypeDistribution.frustration >= 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL explainability service returns null for unknown explanation", () => {
  const ctx = createHitlContext("aa-hitl-explain-null-");
  try {
    const explainabilityService = new HITLExplainabilityService(ctx.store);

    const result = explainabilityService.getExplanation("nonexistent_explain_id");
    assert.equal(result, null);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// HitlRuntime tests
// ---------------------------------------------------------------------------

test("HITL runtime opens and resolves human review requests", () => {
  const ctx = createHitlContext("aa-hitl-runtime-");
  try {
    const runtime = new HitlRuntime();

    const request = runtime.open({
      runId: "run_hitl_001",
      domainId: "coding",
      reason: "High risk operation requires human review",
      evidenceRefs: ["artifact_1", "artifact_2"],
    });

    assert.ok(request.requestId.startsWith("hitl_"));
    assert.equal(request.status, "pending");
    assert.equal(request.runId, "run_hitl_001");
    assert.equal(request.evidenceRefs.length, 2);

    const resolved = runtime.resolve(request.requestId, "approved", "operator_1");
    assert.equal(resolved.status, "approved");
    assert.equal(resolved.resolvedBy, "operator_1");
    assert.ok(resolved.resolvedAt !== null);

    const retrieved = runtime.get(request.requestId);
    assert.ok(retrieved, "Should retrieve resolved request");
    assert.equal(retrieved!.status, "approved");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL runtime rejects request and run aborts", () => {
  const ctx = createHitlContext("aa-hitl-reject-");
  try {
    const runtime = new HitlRuntime();

    const request = runtime.open({
      runId: "run_hitl_002",
      domainId: "coding",
      reason: "Dangerous operation denied",
      evidenceRefs: ["artifact_danger"],
    });

    const resolved = runtime.resolve(request.requestId, "rejected", "operator_2");
    assert.equal(resolved.status, "rejected");
    assert.equal(resolved.resolvedBy, "operator_2");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// HarnessRuntimeService HITL integration tests
// ---------------------------------------------------------------------------

test("Harness openHitlReview transitions run to paused hitl status", () => {
  const ctx = createHitlContext("aa-hitl-harness-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_hitl_harness_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: {},
      outputs: { stepOutputs: [{ tool: "bash", command: "dangerous command" }] },
    });

    run = service.openHitlReview(run, "High risk operation requires human approval", ["artifact_1"]);

    assert.equal(run.status, "paused");
    assert.equal(run.pauseReason, "hitl");
    assert.ok(run.hitlRequest, "Run should have HITL request");
    assert.equal(run.hitlRequest!.reason, "High risk operation requires human approval");

    const timeline = service.listTimeline(run);
    const hitlEvents = timeline.filter((e: HarnessTimelineEvent) => e.type === "hitl_requested");
    assert.equal(hitlEvents.length, 1);
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness resolveHitlReview approves and resumes run", () => {
  const ctx = createHitlContext("aa-hitl-approve-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_hitl_approve_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: {},
      outputs: { stepOutputs: [] },
    });

    run = service.openHitlReview(run, "Approval required", ["artifact_1"]);

    run = service.resolveHitlReview(run, "approved", "operator_approve_001");

    assert.equal(run.status, "running");
    assert.ok(run.completedAt === null, "Should not have completed timestamp on approval");

    const timeline = service.listTimeline(run);
    const resolvedEvents = timeline.filter((e: HarnessTimelineEvent) => e.type === "hitl_resolved");
    assert.equal(resolvedEvents.length, 1);
    const resolvedPayload = resolvedEvents[0]!.payload as { resolution: string; actorId: string };
    assert.equal(resolvedPayload.resolution, "approved");
    assert.equal(resolvedPayload.actorId, "operator_approve_001");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("Harness resolveHitlReview rejects and aborts run", () => {
  const ctx = createHitlContext("aa-hitl-deny-");
  try {
    const service = new HarnessRuntimeService();

    let run = service.createRun({
      taskId: "task_hitl_deny_001",
      domainId: "coding",
      constraintPack: makeConstraintPack(),
    });

    run = service.appendStep(run, {
      role: "generator",
      stage: "execute",
      inputs: {},
      outputs: { stepOutputs: [] },
    });

    run = service.openHitlReview(run, "Dangerous operation", ["artifact_danger"]);

    run = service.resolveHitlReview(run, "rejected", "operator_deny_001");

    assert.equal(run.status, "aborted");
    assert.ok(run.completedAt !== null, "Should have completed timestamp on rejection");
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// HITL mode validation tests
// ---------------------------------------------------------------------------

test("HITL validates single_approval mode requires at least one option", async () => {
  const ctx = createHitlContext("aa-hitl-mode-single-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_mode_single_001", executionId: "exec_hitl_mode_single_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    // single_approval with no options should throw
    await assert.rejects(
      async () => {
        await service.requestApproval({
          taskId: "task_hitl_mode_single_001",
          executionId: "exec_hitl_mode_single_001",
          sourceAgentId: "agent_mode",
          title: "Single approval test",
          reason: "Test",
          riskLevel: "low",
          stageRef: "plan",
          options: [],
          timeoutPolicy: "reject",
        });
      },
      /hitl_approval\.options_required/,
    );
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

test("HITL validates circuit_breaker mode requires high/critical risk", async () => {
  const ctx = createHitlContext("aa-hitl-mode-circuit-");
  try {
    seedTaskAndExecution(ctx.db, ctx.store, { taskId: "task_hitl_mode_circuit_001", executionId: "exec_hitl_mode_circuit_001" });
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    // circuit_breaker_human with low risk should throw
    await assert.rejects(
      async () => {
        await service.requestApproval({
          taskId: "task_hitl_mode_circuit_001",
          executionId: "exec_hitl_mode_circuit_001",
          sourceAgentId: "agent_mode",
          title: "Circuit breaker test",
          reason: "Test",
          riskLevel: "low",
          mode: "circuit_breaker_human",
          stageRef: "release",
          options: [
            { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
          ],
          timeoutPolicy: "reject",
        });
      },
      /hitl_mode\.circuit_breaker_requires_high_risk/,
    );
  } finally {
    ctx.db.close();
    cleanupPath(ctx.workspace);
  }
});

// ---------------------------------------------------------------------------
// Seeded context tests
// ---------------------------------------------------------------------------

test("HITL runs with seeded integration context", async () => {
  const ctx = createSeededIntegrationContext("aa-hitl-seeded-");

  try {
    const approvalService = new ApprovalService(ctx.db, ctx.store);
    const explainabilityService = new HITLExplainabilityService(ctx.store);
    const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);

    const packet = await service.requestApproval({
      taskId: "task-seeded-001",
      executionId: "exec-seeded-001",
      sourceAgentId: "agent_seeded",
      title: "Seeded context approval",
      reason: "Test with seeded context",
      riskLevel: "medium",
      stageRef: "execute",
      options: [
        { optionId: "confirm", label: "OK", style: "primary", requiresConfirm: true },
      ],
      timeoutPolicy: "reject",
    });

    assert.ok(packet.approvalId.startsWith("approval_"));
    assert.equal(packet.taskId, "task-seeded-001");
  } finally {
    ctx.cleanup();
  }
});
