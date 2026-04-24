/**
 * HITL Remaining Edge Cases Tests
 *
 * Covers code paths not exercised by the main test files:
 * - HitlApprovalOrchestrationService.applyDecision with "confirmed" decision type
 * - HitlApprovalOrchestrationService buildTimeoutDecision with remain_pending
 * - HitlOperatorConsoleService listQueue filter edge cases
 * - ApprovalContextSummaryService template paths with outputSummary
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlApprovalOrchestrationService } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { HitlOperatorConsoleService } from "../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";
import { ApprovalContextSummaryService, type ExecutionContextForSummary } from "../../../../../src/platform/orchestration/hitl/approval-context-summary-service.js";
import type { ApprovalPacket } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ── Helpers ──────────────────────────────────────────────────────────────

function makePacketOption(overrides: Partial<{ optionId: string; label: string; style: string; requiresConfirm: boolean }> = {}) {
  return {
    optionId: overrides.optionId ?? "option-1",
    label: overrides.label ?? "Option",
    style: (overrides.style ?? "primary") as "primary" | "danger" | "secondary",
    requiresConfirm: overrides.requiresConfirm ?? false,
  };
}

function makePacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  const id = overrides.approvalId ?? "approval-1";
  return {
    approvalId: id,
    taskId: overrides.taskId ?? "task-1",
    executionId: overrides.executionId ?? "exec-1",
    mode: overrides.mode ?? "single_approval",
    title: overrides.title ?? "Approval needed",
    reason: overrides.reason ?? "Review required",
    riskLevel: overrides.riskLevel ?? "medium",
    options: overrides.options ?? [makePacketOption()],
    recommendedOptionId: overrides.recommendedOptionId ?? "option-1",
    deadlineAt: overrides.deadlineAt ?? null,
    timeoutPolicy: overrides.timeoutPolicy ?? "remain_pending",
    explanation: overrides.explanation ?? {
      explanationId: "expl-1",
      taskId: overrides.taskId ?? "task-1",
      executionId: overrides.executionId ?? "exec-1",
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "Decision needed",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: { tenantId: "tenant-1" },
    },
    feedbackLink: overrides.feedbackLink ?? {
      approvalId: id,
      taskId: overrides.taskId ?? "task-1",
      stageRef: "plan",
      loopIteration: null,
      refId: null,
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
  };
}

function createMockApprovalService() {
  let callCount = 0;
  return {
    createRequest: () => ({
      approvalId: `approval-mock-${++callCount}`,
      taskId: `task-${callCount}`,
      executionId: null,
      sourceAgentId: "agent",
      reason: "R",
      riskLevel: "low",
      options: ["opt"],
      context: {},
      timeoutPolicy: "remain_pending",
      createdAt: "2026-04-22T00:00:00.000Z",
    }),
    applyDecision: () => { /* noop */ },
  };
}

function createMockExplainabilityService() {
  return {
    explainApprovalRequired: () => ({
      explanationId: "expl-mock",
      taskId: "task-mock",
      executionId: null,
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "Mock explanation",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: {},
    }),
  };
}

const createMockProvider = (response: { content: string }) => ({
  createChatCompletion: async () => ({
    content: response.content,
    id: "mock",
    finishReason: "stop",
    toolCalls: [],
    usage: { promptTokens: 10, completionTokens: 20, totalTokens: 30 },
    model: "mock",
    provider: "mock",
  }),
  createStreamingChatCompletion: async () => { /* noop */ },
  hasProvider: () => true,
  dispose: () => {},
});

// ── HitlApprovalOrchestrationService remaining edge cases ─────────────────

test("HitlApprovalOrchestrationService applyDecision with confirmed decisionType yields continue effect", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService() as any,
    createMockExplainabilityService() as any,
  );
  const packet = await service.requestApproval({
    taskId: "task-confirmed",
    sourceAgentId: "agent",
    title: "Confirm test",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });

  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "confirmed",
    confirmed: true,
    respondedBy: "operator_confirm",
    respondedAt: nowIso(),
  });

  // confirmed is not in the special-cased decision types, so defaultEffectForDecision returns "continue"
  assert.equal(result.feedbackLink.decisionEffect, "continue");
});

test("HitlApprovalOrchestrationService buildTimeoutDecision with remain_pending returns expired", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService() as any,
    createMockExplainabilityService() as any,
  );
  const packet = await service.requestApproval({
    taskId: "task-timeout-pending",
    sourceAgentId: "agent",
    title: "Timeout pending",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });

  const decision = service.buildTimeoutDecision(packet.approvalId);
  assert.equal(decision.decisionType, "expired");
  assert.equal(decision.respondedBy, "system:hitl_timeout");
});

test("HitlApprovalOrchestrationService buildTimeoutDecision with reject returns expired", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService() as any,
    createMockExplainabilityService() as any,
  );
  const packet = await service.requestApproval({
    taskId: "task-timeout-reject",
    sourceAgentId: "agent",
    title: "Timeout reject",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "reject",
  });

  const decision = service.buildTimeoutDecision(packet.approvalId);
  assert.equal(decision.decisionType, "expired");
});

test("HitlApprovalOrchestrationService buildTimeoutDecision with custom respondedBy", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService() as any,
    createMockExplainabilityService() as any,
  );
  const packet = await service.requestApproval({
    taskId: "task-timeout-custom",
    sourceAgentId: "agent",
    title: "Custom timeout",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });

  const decision = service.buildTimeoutDecision(packet.approvalId, "custom:system");
  assert.equal(decision.decisionType, "expired");
  assert.equal(decision.respondedBy, "custom:system");
});

test("HitlApprovalOrchestrationService applyDecision preserves existing feedbackSignalId for non-text_input", async () => {
  const service = new HitlApprovalOrchestrationService(
    createMockApprovalService() as any,
    createMockExplainabilityService() as any,
  );
  const packet = await service.requestApproval({
    taskId: "task-signal",
    sourceAgentId: "agent",
    title: "Signal test",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });

  // Apply a text_input decision first to set feedbackSignalId
  const firstResult = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "text_input",
    inputText: "Some feedback",
    respondedBy: "op1",
    respondedAt: nowIso(),
  });
  assert.ok(firstResult.feedbackLink.feedbackSignalId !== null);

  const originalSignalId = firstResult.feedbackLink.feedbackSignalId;

  // Apply another decision - text_input would generate new signal, but option_selected would keep existing
  const secondResult = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "approve_candidate",
    respondedBy: "op2",
    respondedAt: nowIso(),
  });

  // text_input sets feedbackSignalId, but option_selected doesn't change it
  assert.equal(secondResult.feedbackLink.feedbackSignalId, originalSignalId);
});

// ── HitlOperatorConsoleService listQueue edge cases ───────────────────────

test("HitlOperatorConsoleService listQueue with no filters returns all items", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "filter-all-1" }));
  await service.dispatch(makePacket({ approvalId: "filter-all-2" }));
  const all = service.listQueue();
  assert.equal(all.length, 2);
});

test("HitlOperatorConsoleService listQueue with empty filters returns all items", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "filter-empty-1" }));
  await service.dispatch(makePacket({ approvalId: "filter-empty-2" }));
  const all = service.listQueue({});
  assert.equal(all.length, 2);
});

test("HitlOperatorConsoleService listQueue filters by resolved status", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "resolve-1" }));
  await service.dispatch(makePacket({ approvalId: "resolve-2" }));
  service.resolve("resolve-1", {
    approvalId: "resolve-1",
    taskId: "task-1",
    stageRef: "plan",
    loopIteration: null,
    refId: null,
    feedbackSignalId: "sig-1",
    decisionEffect: "continue",
  });
  const resolved = service.listQueue({ status: "resolved" });
  const pending = service.listQueue({ status: "pending" });
  assert.equal(resolved.length, 1);
  assert.equal(resolved[0]?.approvalId, "resolve-1");
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.approvalId, "resolve-2");
});

test("HitlOperatorConsoleService listQueue filters by null tenantId", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  // Packet with valid tenant
  await service.dispatch(makePacket({
    approvalId: "has-tenant",
    explanation: {
      explanationId: "e1",
      taskId: "task-1",
      executionId: "exec-1",
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "s",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: { tenantId: "tenant-valid" },
    },
  }));
  // Packet without tenantId in context
  await service.dispatch(makePacket({
    approvalId: "no-tenant",
    explanation: {
      explanationId: "e2",
      taskId: "task-1",
      executionId: "exec-1",
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "s",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: {},
    },
  }));

  const nullTenant = service.listQueue({ tenantId: null });
  assert.equal(nullTenant.length, 1);
  assert.equal(nullTenant[0]?.approvalId, "no-tenant");
});

test("HitlOperatorConsoleService listQueue filters by stageRef only", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({
    approvalId: "stage-only-1",
    feedbackLink: { approvalId: "stage-only-1", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));
  await service.dispatch(makePacket({
    approvalId: "stage-only-2",
    feedbackLink: { approvalId: "stage-only-2", taskId: "task-1", stageRef: "execute", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));

  const planItems = service.listQueue({ stageRef: "plan" });
  assert.equal(planItems.length, 1);
  assert.equal(planItems[0]?.approvalId, "stage-only-1");

  const executeItems = service.listQueue({ stageRef: "execute" });
  assert.equal(executeItems.length, 1);
  assert.equal(executeItems[0]?.approvalId, "stage-only-2");
});

test("HitlOperatorConsoleService listQueue returns empty array when no matches", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({
    approvalId: "none-match",
    feedbackLink: { approvalId: "none-match", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));
  const executeItems = service.listQueue({ stageRef: "execute" });
  assert.equal(executeItems.length, 0);
});

// ── ApprovalContextSummaryService template edge cases ─────────────────────

test("ApprovalContextSummaryService templateSummary with outputSummary context", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-output",
    executionId: "exec-output",
    title: "Task with output",
    stageRef: "execute",
    riskLevel: "medium",
    outputSummary: "Successfully deployed version 2.3.1 to production",
    completedSteps: [
      { stepId: "s1", stepName: "Build", status: "completed", durationMs: 5000 },
      { stepId: "s2", stepName: "Test", status: "completed", durationMs: 3000 },
      { stepId: "s3", stepName: "Deploy", status: "completed", durationMs: 2000 },
    ],
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task-output");
  assert.ok(result.summary.length > 0);
  assert.equal(result.executionId, "exec-output");
});

test("ApprovalContextSummaryService templateSummary with error context and blockers", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-errors-blockers",
    stageRef: "execute",
    riskLevel: "high",
    errorCount: 3,
    retryCount: 2,
    blockers: ["Database connection timeout", "External API rate limit exceeded"],
  };

  const result = await service.generateSummary(context);

  // Template summary should mention errors
  assert.ok(result.summary.includes("task-errors-blockers") || result.summary.includes("error"));
  // defaultKeyPoints includes blocker count as "Blockers: N"
  assert.ok(result.keyPoints.some((p: string) => p.includes("Blockers")));
  // defaultRiskFactors should mention high risk
  assert.ok(result.riskFactors.some((r: string) => r.includes("high") || r.includes("risk")));
  // defaultRecommendedAction should suggest reviewing errors
  assert.ok(result.recommendedAction?.includes("error"));
});

test("ApprovalContextSummaryService with relevantArtifacts in context", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-artifacts",
    stageRef: "feedback",
    riskLevel: "medium",
    completedSteps: [
      { stepId: "s1", stepName: "Generate report", status: "completed", summary: "Report generated" },
    ],
    relevantArtifacts: [
      { artifactId: "art-1", artifactType: "report", name: "weekly-summary.pdf" },
      { artifactId: "art-2", artifactType: "log", name: "execution.log" },
      { artifactId: "art-3", artifactType: "config", name: "app-config.yaml" },
    ],
  };

  const result = await service.generateSummary(context);

  assert.equal(result.taskId, "task-artifacts");
  assert.ok(result.keyPoints.some((p: string) => p.includes("1 step") || p.includes("feedback")));
});

test("ApprovalContextSummaryService confidence defaults to 0.5 for partial JSON", async () => {
  const provider = createMockProvider({
    content: '{"summary":"Partial","keyPoints":["a","b"],"riskFactors":[],"confidence":null}',
  });
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-partial" });
  assert.equal(result.confidence, 0.5);
});

test("ApprovalContextSummaryService confidence clamps negative values to 0", async () => {
  const provider = createMockProvider({
    content: '{"summary":"Neg confidence","keyPoints":[],"riskFactors":[],"confidence":-0.5}',
  });
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-neg" });
  // Math.max(0, -0.5) = 0
  assert.equal(result.confidence, 0);
});

test("ApprovalContextSummaryService defaultRecommendedAction for no errors context", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-normal",
    stageRef: "plan",
    riskLevel: "low",
  };

  const result = await service.generateSummary(context);
  assert.ok(result.recommendedAction?.includes("Review"));
});

test("ApprovalContextSummaryService defaultRiskFactors for low risk", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-low-risk",
    stageRef: "assess",
    riskLevel: "low",
  };

  const result = await service.generateSummary(context);
  // Should get default "Standard approval process applies"
  assert.ok(result.riskFactors.length > 0);
});

test("ApprovalContextSummaryService defaultRiskFactors for more than 2 errors", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-many-errors",
    stageRef: "execute",
    riskLevel: "medium",
    errorCount: 5,
  };

  const result = await service.generateSummary(context);
  assert.ok(result.riskFactors.some((r: string) => r.includes("Multiple errors")));
});

test("ApprovalContextSummaryService handles context with currentPhase", async () => {
  const provider = createMockProvider({ content: "invalid" });
  const service = new ApprovalContextSummaryService({ provider: provider as any });

  const context: ExecutionContextForSummary = {
    taskId: "task-phase",
    stageRef: "improve",
    riskLevel: "medium",
    currentPhase: "Post-deployment verification",
  };

  const result = await service.generateSummary(context);
  assert.equal(result.taskId, "task-phase");
  assert.ok(result.summary.length > 0);
});
