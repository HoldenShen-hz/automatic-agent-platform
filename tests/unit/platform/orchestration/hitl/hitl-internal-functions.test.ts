/**
 * HITL Internal Functions and Edge Cases Tests
 *
 * Tests internal functions and edge cases in hitl modules that are
 * exercised through public APIs but warrant direct unit tests.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlInboxService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";
import { HitlOperatorConsoleService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-operator-console-service.js";
import type {
  ApprovalPacket,
  ApprovalFeedbackLink,
  ApprovalPacketOption,
} from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";
import type { HitlNotificationChannel } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";

// ── Helper Functions ──────────────────────────────────────────────────────────

function makePacketOption(overrides: Partial<ApprovalPacketOption> = {}): ApprovalPacketOption {
  return {
    optionId: overrides.optionId ?? "option-1",
    label: overrides.label ?? "Option",
    style: overrides.style ?? "primary",
    requiresConfirm: overrides.requiresConfirm ?? false,
  };
}

function makePacket(overrides: Partial<ApprovalPacket> & { approvalId?: string } = {}): ApprovalPacket {
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

// ── HitlInboxService Sorting Tests ──────────────────────────────────────────

test("HitlInboxService sorting: compareNullableIso handles both null", () => {
  const service = new HitlInboxService();
  // Two null deadlines should sort as equal (0)
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "null-1", deadlineAt: null }),
      makePacket({ approvalId: "null-2", deadlineAt: null }),
    ],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  // Both are pending with same status and risk, order by approvalId
  assert.ok(items.length === 2);
});

test("HitlInboxService sorting: compareNullableIso handles left null", () => {
  const service = new HitlInboxService();
  // null deadline comes after a specific deadline when same status/risk
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "has-deadline", deadlineAt: "2026-04-22T12:00:00.000Z" }),
      makePacket({ approvalId: "null-deadline", deadlineAt: null }),
    ],
    [],
    "2026-04-22T11:00:00.000Z",
  );
  // has-deadline is pending (deadline in future), null-deadline is pending (no deadline)
  // Both same status and risk, then compareNullableIso: has-deadline sorts before null
  assert.ok(items.length === 2);
});

test("HitlInboxService sorting: compareNullableIso handles right null", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "null-first", deadlineAt: null }),
      makePacket({ approvalId: "has-deadline", deadlineAt: "2026-04-22T12:00:00.000Z" }),
    ],
    [],
    "2026-04-22T11:00:00.000Z",
  );
  assert.ok(items.length === 2);
});

test("HitlInboxService sorting: status takes priority over risk", () => {
  const service = new HitlInboxService();
  // critical pending should come after expired low
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "critical-pending", riskLevel: "critical", deadlineAt: null }),
      makePacket({ approvalId: "low-expired", riskLevel: "low", deadlineAt: "2026-04-22T09:00:00.000Z" }),
    ],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  // expired (status=0) always sorts before pending (status=2), regardless of risk
  assert.equal(items[0]?.approvalId, "low-expired");
  assert.equal(items[0]?.status, "expired");
});

test("HitlInboxService sorting: risk takes priority over deadline when same status", () => {
  const service = new HitlInboxService();
  // Two pending items: critical sorts before low
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "low-risk", riskLevel: "low", deadlineAt: "2026-04-22T14:00:00.000Z" }),
      makePacket({ approvalId: "critical-risk", riskLevel: "critical", deadlineAt: "2026-04-22T14:00:00.000Z" }),
    ],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.approvalId, "critical-risk");
  assert.equal(items[0]?.riskLevel, "critical");
});

test("HitlInboxService resolveStatus: decided takes precedence over expired deadline", () => {
  const service = new HitlInboxService();
  // Packet has expired deadline but already decided
  const items = service.buildInbox(
    [makePacket({ approvalId: "decided-despite-deadline", deadlineAt: "2026-04-22T09:00:00.000Z" })],
    [{ approvalId: "decided-despite-deadline", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: "sig-1", decisionEffect: "continue" }],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService resolveStatus: decided when decisionEffect is not continue", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "effect-not-continue" })],
    [{ approvalId: "effect-not-continue", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "block_candidate" }],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService resolveStatus: null deadline always pending", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "no-deadline" })],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "pending");
});

test("HitlInboxService resolveStatus: due_soon when within 15 minutes", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "due-soon", deadlineAt: "2026-04-22T12:10:00.000Z" })],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "due_soon");
});

test("HitlInboxService resolveStatus: pending when more than 15 minutes remain", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "not-due", deadlineAt: "2026-04-22T12:20:00.000Z" })],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.equal(items[0]?.status, "pending");
});

// ── HitlOperatorConsoleService readTenantId Edge Cases ───────────────────────

test("HitlOperatorConsoleService readTenantId handles missing tenantId", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  // Context snapshot without tenantId
  const packet = makePacket({
    approvalId: "no-tenant",
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
      contextSnapshot: {},
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.equal(item?.tenantId, null);
});

test("HitlOperatorConsoleService readTenantId handles non-string tenantId", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  // Context snapshot with non-string tenantId (number)
  const packet = makePacket({
    approvalId: "numeric-tenant",
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
      contextSnapshot: { tenantId: 123 },
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.equal(item?.tenantId, null);
});

test("HitlOperatorConsoleService readTenantId handles empty string", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  const packet = makePacket({
    approvalId: "empty-tenant",
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
      contextSnapshot: { tenantId: "" },
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.equal(item?.tenantId, null);
});

test("HitlOperatorConsoleService readTenantId handles whitespace-only string", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  const packet = makePacket({
    approvalId: "whitespace-tenant",
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
      contextSnapshot: { tenantId: "   " },
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.equal(item?.tenantId, null);
});

test("HitlOperatorConsoleService readTenantId handles valid tenantId", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  const packet = makePacket({
    approvalId: "valid-tenant",
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
      contextSnapshot: { tenantId: "tenant-abc" },
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.equal(item?.tenantId, "tenant-abc");
});

test("HitlOperatorConsoleService readTenantId returns original value (not trimmed) when valid", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  const packet = makePacket({
    approvalId: "trim-tenant",
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
      contextSnapshot: { tenantId: "  tenant-xyz  " },
    },
  });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  // readTenantId returns original string if trimmed length > 0, does not trim
  assert.equal(item?.tenantId, "  tenant-xyz  ");
});

// ── HitlOperatorConsoleService resolveChannels Tests ─────────────────────────

test("HitlOperatorConsoleService resolveChannels defaults to console without rules", async () => {
  const service = new HitlOperatorConsoleService([], async () => ({
    delivered: true,
    deliveryId: "id",
  }));
  const packet = makePacket({ approvalId: "no-rules", riskLevel: "low" });
  await service.dispatch(packet);
  const item = service.listQueue()[0];
  assert.deepEqual(item?.deliveryChannels, ["console"]);
});

test("HitlOperatorConsoleService resolveChannels adds channels by risk level", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "slack", minRiskLevel: "high" as const }],
    async (input: { channel: string; packet: ApprovalPacket }) => ({
      delivered: true,
      deliveryId: `${input.channel}:id`,
    }),
  );
  // High risk should get console + slack
  await service.dispatch(makePacket({ approvalId: "high-risk", riskLevel: "high" }));
  const highItem = service.listQueue()[0];
  assert.ok(highItem?.deliveryChannels.includes("console"));
  assert.ok(highItem?.deliveryChannels.includes("slack"));

  // Low risk should only get console
  await service.dispatch(makePacket({ approvalId: "low-risk", riskLevel: "low" }));
  const lowItem = service.listQueue().find(i => i.approvalId === "low-risk");
  assert.ok(lowItem?.deliveryChannels.includes("console"));
  assert.ok(!lowItem?.deliveryChannels.includes("slack"));
});

test("HitlOperatorConsoleService resolveChannels filters by stage when specified", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "pager", minRiskLevel: "low" as const, stages: ["execute" as const] }],
    async () => ({ delivered: true, deliveryId: "pager:id" }),
  );
  // Plan stage should not get pager
  await service.dispatch(makePacket({
    approvalId: "plan-stage",
    feedbackLink: { approvalId: "plan-stage", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));
  const planItem = service.listQueue()[0];
  assert.ok(!planItem?.deliveryChannels.includes("pager"));

  // Execute stage should get pager
  await service.dispatch(makePacket({
    approvalId: "execute-stage",
    feedbackLink: { approvalId: "execute-stage", taskId: "task-1", stageRef: "execute", loopIteration: null, refId: null, feedbackSignalId: null, decisionEffect: "continue" },
  }));
  const executeItem = service.listQueue().find(i => i.approvalId === "execute-stage");
  assert.ok(executeItem?.deliveryChannels.includes("pager"));
});

test("HitlOperatorConsoleService resolveChannels filters by tenant when specified", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "email", minRiskLevel: "low" as const, tenantIds: ["special-tenant" as const] }],
    async () => ({ delivered: true, deliveryId: "email:id" }),
  );
  // Matching tenant gets email
  await service.dispatch(makePacket({
    approvalId: "match-tenant",
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
      contextSnapshot: { tenantId: "special-tenant" },
    },
  }));
  const matchItem = service.listQueue()[0];
  assert.ok(matchItem?.deliveryChannels.includes("email"));

  // Non-matching tenant does not get email
  await service.dispatch(makePacket({
    approvalId: "other-tenant",
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
      contextSnapshot: { tenantId: "other-tenant" },
    },
  }));
  const otherItem = service.listQueue().find(i => i.approvalId === "other-tenant");
  assert.ok(!otherItem?.deliveryChannels.includes("email"));
});

// ── HitlOperatorConsoleService Routing Rule Edge Cases ───────────────────────

test("HitlOperatorConsoleService multiple routing rules can stack channels", async () => {
  const deliveries: string[] = [];
  const service = new HitlOperatorConsoleService(
    [
      { channel: "slack", minRiskLevel: "high" as const },
      { channel: "email", minRiskLevel: "medium" as const },
      { channel: "pager", minRiskLevel: "critical" as const },
    ],
    async (input: { channel: string; packet: ApprovalPacket }) => {
      deliveries.push(`${input.channel}:${input.packet.approvalId}`);
      return { delivered: true, deliveryId: `${input.channel}:id` };
    },
  );
  // Critical risk should get all channels
  await service.dispatch(makePacket({ approvalId: "critical-all", riskLevel: "critical" }));
  // Check that deliveryChannels includes all expected channels
  const item = service.listQueue()[0];
  assert.deepEqual(item?.deliveryChannels, ["console", "slack", "email", "pager"]);
});

test("HitlOperatorConsoleService low risk only gets console by default", async () => {
  const service = new HitlOperatorConsoleService(
    [{ channel: "slack", minRiskLevel: "high" as const }],
    async () => ({ delivered: true, deliveryId: "id" }),
  );
  await service.dispatch(makePacket({ approvalId: "low-console-only", riskLevel: "low" }));
  const item = service.listQueue()[0];
  assert.deepEqual(item?.deliveryChannels, ["console"]);
});

// ── HitlInboxService Notification Channel Tests ─────────────────────────────

test("HitlInboxService notificationChannels for low risk defaults to console only", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "low-notif", riskLevel: "low" })], []);
  assert.deepEqual(items[0]?.notificationChannels, ["console"]);
});

test("HitlInboxService notificationChannels for circuit_breaker_human mode", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "circuit-notif", mode: "circuit_breaker_human", riskLevel: "high" })],
    [],
  );
  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack", "mobile_push", "webhook"]);
});

test("HitlInboxService notificationChannels for delegated_approval mode", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "delegated-notif", mode: "delegated_approval", riskLevel: "medium" })],
    [],
  );
  assert.deepEqual(items[0]?.notificationChannels, ["console", "email", "slack"]);
});

test("HitlInboxService notificationChannels circuit_breaker overrides risk level", () => {
  const service = new HitlInboxService();
  // Even low risk with circuit_breaker_human gets enhanced channels
  const items = service.buildInbox(
    [makePacket({ approvalId: "circuit-low", mode: "circuit_breaker_human", riskLevel: "critical" })],
    [],
  );
  assert.ok(items[0]?.notificationChannels.includes("console"));
  assert.ok(items[0]?.notificationChannels.includes("webhook"));
});

test("HitlInboxService notificationChannels delegated overrides default", () => {
  const service = new HitlInboxService();
  // Even high risk with delegated_approval gets email instead of extra channels
  const items = service.buildInbox(
    [makePacket({ approvalId: "delegated-high", mode: "delegated_approval", riskLevel: "high" })],
    [],
  );
  assert.ok(items[0]?.notificationChannels.includes("email"));
  assert.ok(!items[0]?.notificationChannels.includes("mobile_push"));
});

// ── HitlInboxService Summary Edge Cases ─────────────────────────────────────

test("HitlInboxService buildSummary with empty items", () => {
  const service = new HitlInboxService();
  const summary = service.buildSummary([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.pending, 0);
  assert.equal(summary.dueSoon, 0);
  assert.equal(summary.expired, 0);
  assert.equal(summary.decided, 0);
  assert.equal(summary.critical, 0);
});

test("HitlInboxService buildSummary with all statuses represented", () => {
  const service = new HitlInboxService();
  // Items without deadlines are pending (feedbackSignalId=null, decisionEffect="continue")
  // Items with deadline in past are expired
  // Items with deadline within 15 min are due_soon
  // Items with feedbackSignalId or non-continue decisionEffect are decided
  const items = service.buildInbox([
    makePacket({ approvalId: "pend-1", deadlineAt: null }),
    makePacket({ approvalId: "pend-2", deadlineAt: null }),
    makePacket({ approvalId: "due-1", deadlineAt: "2026-04-22T12:05:00.000Z" }),
    makePacket({ approvalId: "exp-1", deadlineAt: "2026-04-22T09:00:00.000Z" }),
    makePacket({ approvalId: "dec-1" }),
    makePacket({ approvalId: "crit-1", riskLevel: "critical", deadlineAt: null }),
  ], [
    { approvalId: "dec-1", taskId: "task-1", stageRef: "plan", loopIteration: null, refId: null, feedbackSignalId: "sig-1", decisionEffect: "continue" },
  ], "2026-04-22T12:00:00.000Z");

  const summary = service.buildSummary(items);
  assert.equal(summary.total, 6);
  // peding: pend-1 (null deadline), pend-2 (null deadline), crit-1 (null deadline, default feedback) = 3
  assert.equal(summary.pending, 3);
  assert.equal(summary.dueSoon, 1);  // due-1 (deadline within 15 min)
  assert.equal(summary.expired, 1);   // exp-1 (deadline passed)
  assert.equal(summary.decided, 1);   // dec-1 (has feedbackSignalId)
  assert.equal(summary.critical, 1); // crit-1 (critical risk level)
});

// ── HitlApprovalOrchestrationService Edge Cases ─────────────────────────────

test("HitlApprovalOrchestrationService requestApproval with default mode", async () => {
  // Create mock services
  const mockApprovalService = {
    createRequest: () => ({
      approvalId: "approval-default-mode",
      taskId: "task-1",
      executionId: null,
      sourceAgentId: "agent",
      reason: "reason",
      riskLevel: "low",
      options: ["option-1"],
      context: {},
      timeoutPolicy: "remain_pending",
      createdAt: "2026-04-22T00:00:00.000Z",
    }),
    applyDecision: () => {},
  };
  const mockExplainService = {
    explainApprovalRequired: () => ({
      explanationId: "expl-1",
      taskId: "task-1",
      executionId: null,
      takeoverSessionId: null,
      decisionType: "approval_required",
      summary: "Summary",
      factors: [],
      recommendations: [],
      confidenceScore: 0.8,
      generatedAt: "2026-04-22T00:00:00.000Z",
      contextSnapshot: {},
    }),
  };

  const { HitlApprovalOrchestrationService } = await import("../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js");
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService as any,
    mockExplainService as any,
  );

  const packet = await service.requestApproval({
    taskId: "task-1",
    sourceAgentId: "agent",
    title: "Test",
    reason: "reason",
    riskLevel: "low",
    stageRef: "plan",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
    // Note: mode is not specified, should default to single_approval
  });

  assert.equal(packet.mode, "single_approval");
});

test("HitlApprovalOrchestrationService requestApproval passes context to explainability", async () => {
  const mockApprovalService = {
    createRequest: () => ({
      approvalId: "approval-context-test",
      taskId: "task-1",
      executionId: null,
      sourceAgentId: "agent",
      reason: "reason",
      riskLevel: "high",
      options: ["opt1"],
      context: {},
      timeoutPolicy: "remain_pending",
      createdAt: "2026-04-22T00:00:00.000Z",
    }),
    applyDecision: () => {},
  };

  let capturedContext: any = null;
  const mockExplainService = {
    explainApprovalRequired: (taskId: string, reason: any, context: any) => {
      capturedContext = context;
      return {
        explanationId: "expl-1",
        taskId,
        executionId: null,
        takeoverSessionId: null,
        decisionType: "approval_required",
        summary: "Summary",
        factors: [],
        recommendations: [],
        confidenceScore: 0.8,
        generatedAt: "2026-04-22T00:00:00.000Z",
        contextSnapshot: context.contextSnapshot || {},
      };
    },
  };

  const { HitlApprovalOrchestrationService } = await import("../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js");
  const service = new HitlApprovalOrchestrationService(
    mockApprovalService as any,
    mockExplainService as any,
  );

  await service.requestApproval({
    taskId: "task-context",
    sourceAgentId: "agent",
    title: "Context Test",
    reason: "Testing context",
    riskLevel: "high",
    stageRef: "execute",
    options: [makePacketOption()],
    timeoutPolicy: "remain_pending",
    context: { customKey: "customValue", classification: "CONFIDENTIAL" },
  });

  assert.ok(capturedContext !== null);
  assert.equal(capturedContext.contextSnapshot.customKey, "customValue");
  assert.equal(capturedContext.contextSnapshot.classification, "CONFIDENTIAL");
});

// ── Build Inbox with Complex Feedback Links ───────────────────────────────────

test("HitlInboxService handles feedback link with null feedbackSignalId but block_candidate effect", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "block-effect" })],
    [{
      approvalId: "block-effect",
      taskId: "task-1",
      stageRef: "plan",
      loopIteration: null,
      refId: null,
      feedbackSignalId: null,
      decisionEffect: "block_candidate",
    }],
    "2026-04-22T12:00:00.000Z",
  );
  // block_candidate is not "continue", so status should be "decided"
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService preserves itemId format", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "format-test" })],
    [],
    "2026-04-22T12:00:00.000Z",
  );
  assert.ok(items[0]?.itemId.startsWith("hitl_inbox:"));
  assert.ok(items[0]?.itemId.includes("format-test"));
});
