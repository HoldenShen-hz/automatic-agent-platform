/**
 * HitlInboxService Unit Tests - Extended Coverage
 *
 * Tests for inbox item building, status resolution, and notification channels.
 *
 * Architecture: §16 HITL - Approval Inbox
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlInboxService } from "../../../../../src/platform/orchestration/hitl/hitl-inbox-service.js";
import type {
  ApprovalFeedbackLink,
  ApprovalPacket,
} from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";

function createPacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  const approvalId = overrides.approvalId ?? "approval-1";
  return {
    approvalId,
    taskId: overrides.taskId ?? "task-1",
    executionId: overrides.executionId ?? "exec-1",
    mode: overrides.mode ?? "single_approval",
    title: overrides.title ?? "Approval required",
    reason: overrides.reason ?? "Human review required",
    riskLevel: overrides.riskLevel ?? "medium",
    options: overrides.options ?? [
      { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: false },
      { optionId: "reject", label: "Reject", style: "danger", requiresConfirm: true },
    ],
    recommendedOptionId: overrides.recommendedOptionId ?? "approve",
    deadlineAt: overrides.deadlineAt ?? null,
    timeoutPolicy: overrides.timeoutPolicy ?? "remain_pending",
    explanation: overrides.explanation ?? {
      explanationId: "expl-1",
      taskId: overrides.taskId ?? "task-1",
      executionId: overrides.executionId ?? "exec-1",
      takeoverSessionId: null,
      decisionType: "approval_required" as const,
      summary: "Default explanation summary",
      factors: [{ name: "policy", weight: 0.9, value: "default", reason: "Standard policy" }],
      recommendations: ["approve"],
      confidenceScore: 0.85,
      generatedAt: "2026-04-22T09:00:00.000Z",
      contextSnapshot: { tenantId: "tenant-1" },
    },
    feedbackLink: overrides.feedbackLink ?? {
      approvalId,
      taskId: overrides.taskId ?? "task-1",
      stageRef: "plan",
      loopIteration: 1,
      refId: "ref-1",
      feedbackSignalId: null,
      decisionEffect: "continue" as const,
    },
  };
}

function createFeedbackLink(overrides: Partial<ApprovalFeedbackLink> = {}): ApprovalFeedbackLink {
  return {
    approvalId: overrides.approvalId ?? "approval-1",
    taskId: overrides.taskId ?? "task-1",
    stageRef: overrides.stageRef ?? "plan",
    loopIteration: overrides.loopIteration ?? 1,
    refId: overrides.refId ?? "ref-1",
    feedbackSignalId: overrides.feedbackSignalId ?? null,
    decisionEffect: overrides.decisionEffect ?? "continue",
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Status Resolution Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlInboxService resolves status to pending when no deadline and no feedback", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", deadlineAt: null }),
  ], []);

  assert.equal(items[0]?.status, "pending");
});

test("HitlInboxService resolves status to expired when deadline passed", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", deadlineAt: "2026-04-22T11:00:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.status, "expired");
});

test("HitlInboxService resolves status to due_soon when deadline within 15 minutes", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", deadlineAt: "2026-04-22T12:10:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.status, "due_soon");
});

test("HitlInboxService resolves status to decided when feedbackSignalId exists", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [createPacket({ approvalId: "p1" })],
    [createFeedbackLink({ approvalId: "p1", feedbackSignalId: "feedback-123" })],
  );

  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService resolves status to decided when decisionEffect is not continue", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [createPacket({ approvalId: "p1" })],
    [createFeedbackLink({ approvalId: "p1", decisionEffect: "approve_candidate" })],
  );

  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService resolves status to pending when deadline in future (>15 min)", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", deadlineAt: "2026-04-22T14:00:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.status, "pending");
});

// ─────────────────────────────────────────────────────────────────────────────
// Sorting Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlInboxService sorts expired before due_soon", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "due-soon", deadlineAt: "2026-04-22T12:10:00.000Z" }),
    createPacket({ approvalId: "expired", deadlineAt: "2026-04-22T11:00:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.approvalId, "expired");
  assert.equal(items[1]?.approvalId, "due-soon");
});

test("HitlInboxService sorts due_soon before pending", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "pending", deadlineAt: null }),
    createPacket({ approvalId: "due-soon", deadlineAt: "2026-04-22T12:10:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.approvalId, "due-soon");
  assert.equal(items[1]?.approvalId, "pending");
});

test("HitlInboxService sorts pending before decided", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [
      createPacket({ approvalId: "decided" }),
      createPacket({ approvalId: "pending", deadlineAt: null }),
    ],
    [createFeedbackLink({ approvalId: "decided" })],
  );

  assert.equal(items[0]?.approvalId, "pending");
  assert.equal(items[1]?.approvalId, "decided");
});

test("HitlInboxService sorts by risk level within same status", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "low-risk", riskLevel: "low", deadlineAt: null }),
    createPacket({ approvalId: "critical-risk", riskLevel: "critical", deadlineAt: null }),
  ]);

  assert.equal(items[0]?.approvalId, "critical-risk");
  assert.equal(items[1]?.approvalId, "low-risk");
});

test("HitlInboxService sorts by deadline within same risk level", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "later", riskLevel: "medium", deadlineAt: "2026-04-22T14:00:00.000Z" }),
    createPacket({ approvalId: "earlier", riskLevel: "medium", deadlineAt: "2026-04-22T13:00:00.000Z" }),
  ], [], now);

  assert.equal(items[0]?.approvalId, "earlier");
  assert.equal(items[1]?.approvalId, "later");
});

// ─────────────────────────────────────────────────────────────────────────────
// Notification Channel Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlInboxService defaults to console only for low risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", riskLevel: "low" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console"]);
});

test("HitlInboxService adds slack for high risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", riskLevel: "high" }),
  ]);

  assert.ok(items[0]?.notificationChannels.includes("console"));
  assert.ok(items[0]?.notificationChannels.includes("slack"));
});

test("HitlInboxService adds mobile_push for critical risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", riskLevel: "critical" }),
  ]);

  assert.ok(items[0]?.notificationChannels.includes("console"));
  assert.ok(items[0]?.notificationChannels.includes("slack"));
  assert.ok(items[0]?.notificationChannels.includes("mobile_push"));
});

test("HitlInboxService circuit_breaker_human mode channels", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", mode: "circuit_breaker_human", riskLevel: "critical" }),
  ]);

  assert.ok(items[0]?.notificationChannels.includes("console"));
  assert.ok(items[0]?.notificationChannels.includes("slack"));
  assert.ok(items[0]?.notificationChannels.includes("mobile_push"));
  assert.ok(items[0]?.notificationChannels.includes("webhook"));
});

test("HitlInboxService delegated_approval mode channels", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", mode: "delegated_approval", riskLevel: "medium" }),
  ]);

  assert.ok(items[0]?.notificationChannels.includes("console"));
  assert.ok(items[0]?.notificationChannels.includes("email"));
  assert.ok(items[0]?.notificationChannels.includes("slack"));
});

// ─────────────────────────────────────────────────────────────────────────────
// Summary Building Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlInboxService buildSummary counts all statuses correctly", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T12:00:00.000Z";
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", deadlineAt: "2026-04-22T11:00:00.000Z" }), // expired
    createPacket({ approvalId: "p2", deadlineAt: "2026-04-22T12:05:00.000Z" }), // due_soon
    createPacket({ approvalId: "p3", deadlineAt: null }), // pending
    createPacket({ approvalId: "p4" }), // pending (no deadline)
  ], [], now);

  const summary = service.buildSummary(items);
  assert.equal(summary.total, 4);
  assert.equal(summary.expired, 1);
  assert.equal(summary.dueSoon, 1);
  assert.equal(summary.pending, 2);
  assert.equal(summary.decided, 0);
  assert.equal(summary.critical, 0);
});

test("HitlInboxService buildSummary counts critical correctly", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", riskLevel: "critical" }),
    createPacket({ approvalId: "p2", riskLevel: "low" }),
    createPacket({ approvalId: "p3", riskLevel: "critical" }),
  ]);

  const summary = service.buildSummary(items);
  assert.equal(summary.critical, 2);
});

test("HitlInboxService buildSummary counts decided correctly", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [
      createPacket({ approvalId: "p1" }),
      createPacket({ approvalId: "p2" }),
    ],
    [
      createFeedbackLink({ approvalId: "p1" }),
      createFeedbackLink({ approvalId: "p2", feedbackSignalId: "sig-2" }),
    ],
  );

  const summary = service.buildSummary(items);
  assert.equal(summary.decided, 2);
});

test("HitlInboxService buildSummary empty items", () => {
  const service = new HitlInboxService();
  const summary = service.buildSummary([]);

  assert.equal(summary.total, 0);
  assert.equal(summary.pending, 0);
  assert.equal(summary.dueSoon, 0);
  assert.equal(summary.expired, 0);
  assert.equal(summary.decided, 0);
  assert.equal(summary.critical, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// Inbox Item Fields Tests
// ─────────────────────────────────────────────────────────────────────────────

test("HitlInboxService preserves itemId format", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "test-approval-123" }),
  ]);

  assert.equal(items[0]?.itemId, "hitl_inbox:test-approval-123");
});

test("HitlInboxService preserves stageRef from feedbackLink", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [createPacket({ approvalId: "p1" })],
    [createFeedbackLink({ approvalId: "p1", stageRef: "execute" })],
  );

  assert.equal(items[0]?.stageRef, "execute");
});

test("HitlInboxService preserves explanation summary", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({
      approvalId: "p1",
      explanation: {
        explanationId: "expl-1",
        taskId: "task-1",
        executionId: "exec-1",
        takeoverSessionId: null,
        decisionType: "approval_required" as const,
        summary: "Custom summary text",
        factors: [],
        recommendations: [],
        confidenceScore: 0.9,
        generatedAt: "2026-04-22T09:00:00.000Z",
        contextSnapshot: {},
      },
    }),
  ]);

  assert.equal(items[0]?.explanationSummary, "Custom summary text");
});

test("HitlInboxService preserves recommendedOptionId", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", recommendedOptionId: "reject" }),
  ]);

  assert.equal(items[0]?.recommendedOptionId, "reject");
});

test("HitlInboxService preserves availableActions", () => {
  const service = new HitlInboxService();
  const customOptions = [
    { optionId: "yes", label: "Yes", style: "primary" as const, requiresConfirm: false },
    { optionId: "no", label: "No", style: "danger" as const, requiresConfirm: true },
  ];
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", options: customOptions }),
  ]);

  assert.equal(items[0]?.availableActions.length, 2);
  assert.equal(items[0]?.availableActions[0]?.optionId, "yes");
});

test("HitlInboxService preserves timeoutPolicy", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    createPacket({ approvalId: "p1", timeoutPolicy: "approve" }),
  ]);

  assert.equal(items[0]?.timeoutPolicy, "approve");
});