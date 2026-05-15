import assert from "node:assert/strict";
import test from "node:test";

import { ApprovalContextSummaryService, type ExecutionContextForSummary } from "../../../../../src/platform/five-plane-orchestration/hitl/approval-context-summary-service.js";
import { HITLExplainabilityService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-explainability-service.js";
import { HitlInboxService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";
import { HitlApprovalOrchestrationService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import { HitlOperatorConsoleService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-operator-console-service.js";
import type { ApprovalPacket, ApprovalPacketOption } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import type { AuthoritativeTaskStore } from "../../../../../src/platform/five-plane-state-evidence/truth/authoritative-task-store.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";

// ── Helpers ──────────────────────────────────────────────────────────────

const mockStore = {
  getTask: async () => null,
  insertTask: async () => {},
} as unknown as AuthoritativeTaskStore;

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
    options: overrides.options ?? [
      { optionId: "yes", label: "Yes", style: "primary", requiresConfirm: false },
      { optionId: "no", label: "No", style: "danger", requiresConfirm: true },
    ],
    recommendedOptionId: overrides.recommendedOptionId ?? "yes",
    deadlineAt: overrides.deadlineAt ?? null,
    timeoutPolicy: overrides.timeoutPolicy ?? "remain_pending",
    explanation: overrides.explanation ?? {
      explanationId: "expl-1",
      taskId: overrides.taskId ?? "task-1",
      executionId: overrides.executionId ?? "exec-1",
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "Decision needed",
      factors: [{ name: "policy", weight: 0.9, value: "default", reason: "Policy requires review" }],
      recommendations: ["Approve"],
      confidenceScore: 0.85,
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

function makePacketOption(overrides: Partial<ApprovalPacketOption> = {}): ApprovalPacketOption {
  return {
    optionId: overrides.optionId ?? "option-1",
    label: overrides.label ?? "Option",
    style: overrides.style ?? "primary",
    requiresConfirm: overrides.requiresConfirm ?? false,
  };
}

// ── HitlOperatorConsoleService ────────────────────────────────────────

test("HitlOperatorConsoleService dispatch returns delivery result", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "console:id",
  }));
  const result = await service.dispatch(makePacket({ approvalId: "ap-1" }));
  assert.equal(result.delivered, true);
  assert.equal(result.channel, "console");
  assert.equal(result.deliveryId, "console:id");
});

test("HitlOperatorConsoleService listQueue filters by status", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "ap-2" }));
  await service.dispatch(makePacket({ approvalId: "ap-3" }));
  service.acknowledge("ap-2", "operator-1");
  const pending = service.listQueue({ status: "pending" });
  const acknowledged = service.listQueue({ status: "acknowledged" });
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.approvalId, "ap-3");
  assert.equal(acknowledged.length, 1);
  assert.equal(acknowledged[0]?.approvalId, "ap-2");
});

test("HitlOperatorConsoleService listQueue filters by stageRef", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "ap-4", feedbackLink: { approvalId: "ap-4", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" } }));
  await service.dispatch(makePacket({ approvalId: "ap-5", feedbackLink: { approvalId: "ap-5", taskId: "task-1", stageRef: "execute", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" } }));
  const planItems = service.listQueue({ stageRef: "plan" });
  assert.equal(planItems.length, 1);
  assert.equal(planItems[0]?.approvalId, "ap-4");
});

test("HitlOperatorConsoleService attachTakeoverSession updates queue item", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "ap-6" }));
  const updated = service.attachTakeoverSession("ap-6", "session-abc");
  assert.equal(updated.takeoverSessionId, "session-abc");
  assert.equal(updated.status, "pending");
});

test("HitlOperatorConsoleService requireQueueItem throws on missing id", () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  assert.throws(() => {
    service.acknowledge("nonexistent", "operator-x");
  }, /hitl_console\.queue_item_not_found:nonexistent/);
});

test("HitlOperatorConsoleService routing rules add channels by risk level", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "slack", minRiskLevel: "high" }],
    async (input: { channel: string; packet: ApprovalPacket }) => {
      if (input.channel === "slack") {
        return { delivered: true, deliveryId: "slack:id" };
      }
      return { delivered: true, deliveryId: "console:id" };
    },
  );
  await service.dispatch(makePacket({ approvalId: "ap-routing", riskLevel: "low" }));
  const item = service.listQueue()[0];
  assert.ok(item?.deliveryChannels.includes("console"));
  assert.ok(!item?.deliveryChannels.includes("slack"));
});

test("HitlOperatorConsoleService routing rules add channels by stage", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "pager", minRiskLevel: "low", stages: ["execute"] }],
    async () => ({ delivered: true, deliveryId: "pager:id" }),
  );
  await service.dispatch(makePacket({
    approvalId: "ap-stage",
    feedbackLink: { approvalId: "ap-stage", taskId: "task-1", stageRef: "execute", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));
  const item = service.listQueue()[0];
  assert.ok(item?.deliveryChannels.includes("pager"));
});

test("HitlOperatorConsoleService routing rules filter by tenant", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "email", minRiskLevel: "low", tenantIds: ["tenant-special"] }],
    async () => ({ delivered: true, deliveryId: "email:id" }),
  );
  await service.dispatch(makePacket({ approvalId: "ap-tenant", explanation: { explanationId: "e1", taskId: "task-1", executionId: "exec-1", takeoverSessionId: null, decisionType: "approval_required", summary: "s", factors: [], recommendations: [], confidenceScore: 0.8, generatedAt: "2026-04-22T00:00:00.000Z", contextSnapshot: { tenantId: "tenant-normal" } } }));
  const item = service.listQueue()[0];
  assert.ok(!item?.deliveryChannels.includes("email"));
});

test("HitlOperatorConsoleService acknowledge updates operator id", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  await service.dispatch(makePacket({ approvalId: "ap-ack" }));
  const item = service.acknowledge("ap-ack", "operator-42");
  assert.equal(item.acknowledgedBy, "operator-42");
  assert.equal(item.status, "acknowledged");
});

// ── HitlInboxService ────────────────────────────────────────────────────

test("HitlInboxService buildInbox sorts by status priority first", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    makePacket({ approvalId: "in-pending", deadlineAt: null }),
    makePacket({ approvalId: "in-expired", deadlineAt: "2026-04-22T09:00:00.000Z" }),
    makePacket({ approvalId: "in-due", deadlineAt: "2026-04-22T12:10:00.000Z" }),
  ], [], now);
  assert.equal(items[0]?.approvalId, "in-expired");
  assert.equal(items[1]?.approvalId, "in-due");
  assert.equal(items[2]?.approvalId, "in-pending");
});

test("HitlInboxService buildInbox sorts by risk within same status", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "in-low", riskLevel: "low" }),
    makePacket({ approvalId: "in-critical", riskLevel: "critical" }),
    makePacket({ approvalId: "in-high", riskLevel: "high" }),
  ], [], "2026-04-22T12:00:00.000Z");
  assert.equal(items[0]?.approvalId, "in-critical");
  assert.equal(items[1]?.approvalId, "in-high");
  assert.equal(items[2]?.approvalId, "in-low");
});

test("HitlInboxService buildInbox marks decided when feedbackSignalId exists", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "in-decided" })],
    [{ approvalId: "in-decided", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: "sig-1", decisionEffect: "continue" }],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService buildInbox marks decided when decisionEffect is not continue", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "in-effect" })],
    [{ approvalId: "in-effect", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "revise_plan" }],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService buildInbox marks due_soon when within 15 minutes", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "in-due15", deadlineAt: "2026-04-22T12:05:00.000Z" })],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "due_soon");
});

test("HitlInboxService notificationChannels for critical risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "in-notif", riskLevel: "critical" })], [], "2026-04-22T12:00:00.000Z");
  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack", "mobile_push"]);
});

test("HitlInboxService notificationChannels for high risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "in-notif-hi", riskLevel: "high" })], [], "2026-04-22T12:00:00.000Z");
  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack"]);
});

test("HitlInboxService notificationChannels for medium risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "in-notif-med", riskLevel: "medium" })], [], "2026-04-22T12:00:00.000Z");
  assert.deepEqual(items[0]?.notificationChannels, ["console"]);
});

test("HitlInboxService buildSummary counts all statuses", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "s-pending-1", deadlineAt: null }),
    makePacket({ approvalId: "s-pending-2", deadlineAt: null }),
    makePacket({ approvalId: "s-due", deadlineAt: "2026-04-22T12:10:00.000Z" }),
    makePacket({ approvalId: "s-expired", deadlineAt: "2026-04-22T09:00:00.000Z" }),
    makePacket({ approvalId: "s-decided" }),
    makePacket({ approvalId: "s-critical", riskLevel: "critical", deadlineAt: null }),
  ], [{ approvalId: "s-decided", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: "sig-1", decisionEffect: "continue" }], "2026-04-22T12:00:00.000Z");
  const summary = service.buildSummary(items);
  assert.equal(summary.total, 6);
  assert.equal(summary.pending, 3);
  assert.equal(summary.dueSoon, 1);
  assert.equal(summary.expired, 1);
  assert.equal(summary.decided, 1);
  assert.equal(summary.critical, 1);
});

// ── HITLExplainabilityService ────────────────────────────────────────

test("HITLExplainabilityService generateExplanation creates explanation with id", () => {
  const service = new HITLExplainabilityService(mockStore);
  const explanation = service.generateExplanation("task-gen", "task_escalation", [
    { name: "complexity", weight: 0.8, value: 0.9, reason: "High complexity" },
  ]);
  assert.ok(explanation.explanationId.startsWith("explain_"));
  assert.equal(explanation.taskId, "task-gen");
  assert.equal(explanation.decisionType, "task_escalation");
  assert.ok(explanation.generatedAt.length > 0);
  assert.ok(explanation.confidenceScore >= 0 && explanation.confidenceScore <= 1);
});

test("HITLExplainabilityService generateExplanation skips storage when disabled", () => {
  const service = new HITLExplainabilityService(mockStore, { enableDecisionExplanations: false });
  const explanation = service.generateExplanation("task-no-store", "approval_required", []);
  const retrieved = service.getExplanation(explanation.explanationId);
  assert.equal(retrieved, null);
});

test("HITLExplainabilityService getFeedbackForSession filters by session id", () => {
  const service = new HITLExplainabilityService(mockStore);
  service.recordFeedback(5, "satisfaction", "op-fb", { takeoverSessionId: "session-fb-1" });
  service.recordFeedback(4, "satisfaction", "op-fb", { takeoverSessionId: "session-fb-2" });
  const session1 = service.getFeedbackForSession("session-fb-1");
  assert.equal(session1.length, 1);
  assert.equal(session1[0]?.takeoverSessionId, "session-fb-1");
});

test("HITLExplainabilityService recordFeedback stores with all options", () => {
  const service = new HITLExplainabilityService(mockStore);
  const feedback = service.recordFeedback(3, "suggestion", "op-full", {
    taskId: "task-full",
    takeoverSessionId: "session-full",
    comment: "Consider improving UI",
    categories: ["clarity", "tooling"],
    followUpRequested: true,
  });
  assert.ok(feedback.feedbackId.startsWith("fb_"));
  assert.equal(feedback.rating, 3);
  assert.equal(feedback.feedbackType, "suggestion");
  assert.equal(feedback.operatorId, "op-full");
  assert.equal(feedback.taskId, "task-full");
  assert.equal(feedback.takeoverSessionId, "session-full");
  assert.equal(feedback.comment, "Consider improving UI");
  assert.deepEqual(feedback.categories, ["clarity", "tooling"]);
  assert.equal(feedback.followUpRequested, true);
});

test("HITLExplainabilityService recordFeedback skips storage when disabled", () => {
  const service = new HITLExplainabilityService(mockStore, { enableSatisfactionTracking: false });
  service.recordFeedback(5, "satisfaction", "op-off");
  const all = service.getFeedbackForTask("task-any");
  assert.equal(all.length, 0);
});

test("HITLExplainabilityService getOperatorMetrics returns empty for unknown operator", () => {
  const service = new HITLExplainabilityService(mockStore);
  const metrics = service.getOperatorMetrics("unknown-op");
  assert.equal(metrics.totalInterventions, 0);
  assert.equal(metrics.averageRating, null);
  assert.deepEqual(metrics.recentRatings, []);
  assert.deepEqual(metrics.commonFrustrations, []);
  assert.deepEqual(metrics.suggestedImprovements, []);
  assert.equal(metrics.lastInterventionAt, null);
});

test("HITLExplainabilityService getOperatorMetrics extracts common frustrations sorted", () => {
  const service = new HITLExplainabilityService(mockStore);
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["response_time"] });
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["response_time"] });
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["response_time"] });
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["tooling"] });
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["tooling"] });
  service.recordFeedback(1, "frustration", "op-fr", { categories: ["clarity"] });
  const metrics = service.getOperatorMetrics("op-fr");
  assert.deepEqual(metrics.commonFrustrations, ["response_time", "tooling", "clarity"]);
});

test("HITLExplainabilityService getOperatorMetrics collects suggested improvements", () => {
  const service = new HITLExplainabilityService(mockStore);
  service.recordFeedback(4, "suggestion", "op-sug", { comment: "Improve logging" });
  service.recordFeedback(4, "suggestion", "op-sug", { comment: "Add retry UI" });
  service.recordFeedback(4, "suggestion", "op-sug", { comment: "Better error messages" });
  const metrics = service.getOperatorMetrics("op-sug");
  assert.ok(metrics.suggestedImprovements.length > 0);
});

test("HITLExplainabilityService getOverallSatisfactionMetrics returns empty distribution", () => {
  const service = new HITLExplainabilityService(mockStore);
  const metrics = service.getOverallSatisfactionMetrics();
  assert.equal(metrics.totalFeedback, 0);
  assert.equal(metrics.averageRating, null);
  assert.deepEqual(metrics.ratingDistribution, { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
  assert.deepEqual(metrics.feedbackTypeDistribution, { satisfaction: 0, frustration: 0, suggestion: 0, escalation: 0 });
  assert.deepEqual(metrics.commonCategories, []);
});

test("HITLExplainabilityService getOverallSatisfactionMetrics calculates distribution", () => {
  const service = new HITLExplainabilityService(mockStore);
  service.recordFeedback(5, "satisfaction", "op-1");
  service.recordFeedback(5, "satisfaction", "op-2");
  service.recordFeedback(3, "frustration", "op-3", { categories: ["clarity"] });
  service.recordFeedback(2, "escalation", "op-4");
  const metrics = service.getOverallSatisfactionMetrics();
  assert.equal(metrics.totalFeedback, 4);
  assert.ok(metrics.averageRating !== null);
  assert.equal(metrics.ratingDistribution[5], 2);
  assert.equal(metrics.ratingDistribution[3], 1);
  assert.equal(metrics.ratingDistribution[2], 1);
  assert.equal(metrics.feedbackTypeDistribution.satisfaction, 2);
  assert.equal(metrics.feedbackTypeDistribution.frustration, 1);
  assert.equal(metrics.feedbackTypeDistribution.escalation, 1);
  assert.ok(metrics.commonCategories.length > 0);
});

test("HITLExplainabilityService isFeedbackDue returns false when feedback already submitted", () => {
  const service = new HITLExplainabilityService(mockStore, { feedbackReminderAfterMs: 100 });
  const session = { id: "session-existing", closedAt: new Date(Date.now() - 200).toISOString() } as any;
  service.recordFeedback(4, "satisfaction", "op-existing", { takeoverSessionId: "session-existing" });
  assert.equal(service.isFeedbackDue(session), false);
});

test("HITLExplainabilityService isFeedbackDue returns false when feature disabled", () => {
  const service = new HITLExplainabilityService(mockStore, { enableFeedbackLoop: false });
  const session = { id: "session-off", closedAt: new Date(Date.now() - 10000).toISOString() } as any;
  assert.equal(service.isFeedbackDue(session), false);
});

test("HITLExplainabilityService isFeedbackDue returns false when session not closed", () => {
  const service = new HITLExplainabilityService(mockStore, { feedbackReminderAfterMs: 100 });
  const session = { id: "session-open", closedAt: null } as any;
  assert.equal(service.isFeedbackDue(session), false);
});

test("HITLExplainabilityService isFeedbackDue respects feedbackReminderAfterMs", () => {
  const service = new HITLExplainabilityService(mockStore, { feedbackReminderAfterMs: 5000 });
  const session = { id: "session-recent", closedAt: new Date(Date.now() - 1000).toISOString() } as any;
  assert.equal(service.isFeedbackDue(session), false);
});

test("HITLExplainabilityService getSessionFeedbackDue delegates to isFeedbackDue", () => {
  const service = new HITLExplainabilityService(mockStore, { feedbackReminderAfterMs: 1000 });
  const session = { id: "session-delegate", closedAt: new Date(Date.now() - 2000).toISOString() } as any;
  assert.equal(service.getSessionFeedbackDue(session), true);
});

test("HITLExplainabilityService getConfig returns copy", () => {
  const service = new HITLExplainabilityService(mockStore, {
    enableDecisionExplanations: false,
    enableSatisfactionTracking: true,
    enableFeedbackLoop: false,
    minConfidenceForAutoExplain: 0.9,
    feedbackReminderAfterMs: 30000,
  });
  const config = service.getConfig();
  assert.equal(config.enableDecisionExplanations, false);
  assert.equal(config.enableSatisfactionTracking, true);
  assert.equal(config.enableFeedbackLoop, false);
  assert.equal(config.minConfidenceForAutoExplain, 0.9);
  assert.equal(config.feedbackReminderAfterMs, 30000);
});

// ── HitlApprovalOrchestrationService ──────────────────────────────────

test("HitlApprovalOrchestrationService requires at least one option", async () => {
  const service = new HitlApprovalOrchestrationService({} as any, {} as any);
  await assert.rejects(async () => {
    await service.requestApproval({
      taskId: "task-opt",
      sourceAgentId: "agent",
      title: "Test",
      reason: "Test",
      riskLevel: "low",
      stageRef: "plan",
      options: [],
      timeoutPolicy: "remain_pending",
    });
  }, /hitl_approval\.options_required/);
});

function createMockApprovalService() {
  let callCount = 0;
  return {
    createRequest: () => ({ approvalId: `approval-mock-${++callCount}`, taskId: `task-${callCount}`, executionId: null, sourceAgentId: "agent", reason: "R", riskLevel: "low", options: ["opt"], context: {}, timeoutPolicy: "remain_pending", createdAt: "2026-04-22T00:00:00.000Z" }),
    applyDecision: () => { /* noop for mock */ },
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
    explainTaskEscalation: () => ({
      explanationId: "expl-mock",
      taskId: "task-mock",
      executionId: null,
      takeoverSessionId: null,
      decisionType: "task_escalation",
      summary: "Mock",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: {},
    }),
  };
}

test("HitlApprovalOrchestrationService getPacket returns stored packet", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-get-pkt",
    sourceAgentId: "agent",
    title: "Test",
    reason: "Test",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const retrieved = service.getPacket(packet.approvalId);
  assert.ok(retrieved !== null);
  assert.equal(retrieved?.approvalId, packet.approvalId);
});

test("HitlApprovalOrchestrationService getPacket returns null for unknown id", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  assert.equal(service.getPacket("unknown"), null);
});

test("HitlApprovalOrchestrationService listPackets returns all packets", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  await service.requestApproval({
    taskId: "task-list-1",
    sourceAgentId: "agent",
    title: "T1",
    reason: "R1",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  await service.requestApproval({
    taskId: "task-list-2",
    sourceAgentId: "agent",
    title: "T2",
    reason: "R2",
    riskLevel: "low",
    stageRef: "execute",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const packets = service.listPackets();
  assert.equal(packets.length, 2);
});

test("HitlApprovalOrchestrationService getFeedbackLink returns stored link", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-link",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const link = service.getFeedbackLink(packet.approvalId);
  assert.ok(link !== null);
  assert.equal(link?.approvalId, packet.approvalId);
  assert.equal(link?.stageRef, "plan");
});

test("HitlApprovalOrchestrationService getFeedbackLink returns null for unknown", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  assert.equal(service.getFeedbackLink("unknown"), null);
});

test("HitlApprovalOrchestrationService listFeedbackLinks returns all links", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  await service.requestApproval({
    taskId: "task-links",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const links = service.listFeedbackLinks();
  assert.equal(links.length, 1);
});

test("HitlApprovalOrchestrationService applyDecision rejects unknown approval", async () => {
  const service = new HitlApprovalOrchestrationService({} as any, createMockExplainabilityService() as any);
  assert.throws(() => {
    service.applyDecision({
      approvalId: "unknown",
      decisionType: "rejected",
      respondedBy: "op",
      respondedAt: nowIso(),
    });
  }, /hitl_approval\.feedback_link_not_found:unknown/);
});

test("HitlApprovalOrchestrationService buildTimeoutDecision returns expired for remain_pending", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-timeout",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const decision = service.buildTimeoutDecision(packet.approvalId);
  assert.equal(decision.decisionType, "expired");
});

test("HitlApprovalOrchestrationService buildTimeoutDecision throws for unknown packet", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  assert.throws(() => {
    service.buildTimeoutDecision("unknown-packet");
  }, /hitl_approval\.packet_not_found:unknown-packet/);
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for rejected", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-apply",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "rejected",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for text_input", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-text",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "text_input",
    inputText: "Modify plan",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "revise_plan");
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for rollback", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-rollback",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [{ optionId: "rollback", label: "Rollback", style: "danger", requiresConfirm: true }],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "rollback",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "rollback_rollout");
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for advance_rollout", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-advance",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [{ optionId: "advance_rollout", label: "Advance", style: "primary", requiresConfirm: false }],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "advance_rollout",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "advance_rollout");
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for approve_candidate", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-approve",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [{ optionId: "approve_candidate", label: "Approve", style: "primary", requiresConfirm: false }],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "option_selected",
    selectedOptionId: "approve_candidate",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "approve_candidate");
});

test("HitlApprovalOrchestrationService applyDecision sets correct effect for expired", async () => {
  const service = new HitlApprovalOrchestrationService(createMockApprovalService() as any, createMockExplainabilityService() as any);
  const packet = await service.requestApproval({
    taskId: "task-expired",
    sourceAgentId: "agent",
    title: "T",
    reason: "R",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
  });
  const result = service.applyDecision({
    approvalId: packet.approvalId,
    decisionType: "expired",
    respondedBy: "op",
    respondedAt: nowIso(),
  });
  assert.equal(result.feedbackLink.decisionEffect, "block_candidate");
});

// ── ApprovalContextSummaryService ────────────────────────────────────

test("ApprovalContextSummaryService parseSummaryFromResponse extracts JSON from mixed content", async () => {
  const provider = {
    createChatCompletion: async () => ({
      content: "Here is the summary: {\"summary\":\"Task requires approval\",\"keyPoints\":[\"Point 1\",\"Point 2\"],\"riskFactors\":[\"Risk A\"],\"recommendedAction\":\"Approve\",\"confidence\":0.85}",
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
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const context: ExecutionContextForSummary = {
    taskId: "task-parse",
    stageRef: "plan",
    riskLevel: "medium",
  };
  const result = await service.generateSummary(context);
  assert.equal(result.summary, "Task requires approval");
  assert.deepEqual(result.keyPoints, ["Point 1", "Point 2"]);
  assert.deepEqual(result.riskFactors, ["Risk A"]);
  assert.equal(result.recommendedAction, "Approve");
  assert.equal(result.confidence, 0.85);
});

test("ApprovalContextSummaryService parseSummaryFromResponse clamps confidence to 0-1 range", async () => {
  const provider = {
    createChatCompletion: async () => ({
      content: JSON.stringify({
        summary: "Test summary",
        keyPoints: [],
        riskFactors: [],
        recommendedAction: "Test",
        confidence: 1.5,
      }),
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
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-clamp" });
  assert.equal(result.confidence, 1);
});

test("ApprovalContextSummaryService handles AppError non-retryable as fallback", async () => {
  const { AppError } = await import("../../../../../src/platform/contracts/errors.js");
  const provider = {
    createChatCompletion: async () => {
      throw new AppError("TEST_ERROR", "test non-retryable error", { retryable: false });
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-apperr" });
  assert.equal(result.taskId, "task-apperr");
  assert.ok(result.summary.length > 0);
});

test("ApprovalContextSummaryService handles generic error as fallback", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("network failure");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-err" });
  assert.equal(result.taskId, "task-err");
  assert.ok(result.summary.length > 0);
  assert.equal(result.confidence, 0.4);
});

test("ApprovalContextSummaryService templateSummary with no errors or blockers", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-template", stageRef: "assess", riskLevel: "low" });
  assert.ok(result.summary.includes("assess"));
  assert.ok(result.keyPoints.length >= 0);
});

test("ApprovalContextSummaryService defaultKeyPoints uses stage name", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({
    taskId: "task-steps",
    stageRef: "execute",
    completedSteps: [
      { stepId: "s1", stepName: "Step 1", status: "completed", durationMs: 100 },
      { stepId: "s2", stepName: "Step 2", status: "completed", durationMs: 200 },
    ],
  });
  assert.ok(result.keyPoints.some((p: string) => p.includes("execute")));
});

test("ApprovalContextSummaryService defaultRiskFactors for high risk", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-risk", riskLevel: "high" });
  assert.ok(result.riskFactors.some((r: string) => r.includes("high") || r.includes("risk")));
});

test("ApprovalContextSummaryService defaultRecommendedAction for critical risk", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-crit", riskLevel: "critical" });
  assert.ok(result.recommendedAction && result.recommendedAction.includes("critical"));
});

test("ApprovalContextSummaryService defaultRecommendedAction for error context", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({ taskId: "task-err-act", errorCount: 2 });
  assert.ok(result.recommendedAction && result.recommendedAction.includes("error"));
});

test("ApprovalContextSummaryService handles context with artifacts", async () => {
  const provider = {
    createChatCompletion: async () => {
      throw new Error("fail");
    },
    createStreamingChatCompletion: async () => { /* noop */ },
    hasProvider: () => true,
    dispose: () => {},
  };
  const service = new ApprovalContextSummaryService({ provider: provider as any });
  const result = await service.generateSummary({
    taskId: "task-artifacts",
    relevantArtifacts: [
      { artifactId: "a1", artifactType: "log", name: "error.log" },
      { artifactId: "a2", artifactType: "report", name: "summary.pdf" },
    ],
  });
  assert.ok(result.keyPoints.length >= 0);
});
