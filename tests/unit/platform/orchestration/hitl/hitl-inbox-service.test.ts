/**
 * Unit tests for HitlInboxService
 * Tests inbox building, status resolution, notification channels, and summary
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlInboxService } from "../../../../../src/platform/orchestration/hitl/hitl-inbox-service.js";
import type { ApprovalFeedbackLink, ApprovalPacket } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";

function createPacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  const approvalId = overrides.approvalId ?? "approval-test-1";
  return {
    approvalId,
    taskId: overrides.taskId ?? "task-test-1",
    executionId: overrides.executionId ?? "exec-test-1",
    mode: overrides.mode ?? "single_approval",
    title: overrides.title ?? "Test approval",
    reason: overrides.reason ?? "Test reason",
    riskLevel: overrides.riskLevel ?? "medium",
    options: overrides.options ?? [
      { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: false },
      { optionId: "reject", label: "Reject", style: "danger", requiresConfirm: true },
    ],
    recommendedOptionId: overrides.recommendedOptionId ?? "approve",
    deadlineAt: overrides.deadlineAt ?? null,
    timeoutPolicy: overrides.timeoutPolicy ?? "remain_pending",
    explanation: overrides.explanation ?? {
      explanationId: "expl-test-1",
      taskId: overrides.taskId ?? "task-test-1",
      executionId: overrides.executionId ?? "exec-test-1",
      decisionType: "approval_required",
      summary: "Test summary",
      factors: [
        { name: "policy", weight: 0.8, value: "test_policy", reason: "Test factor" },
      ],
      recommendations: ["approve"],
      confidenceScore: 0.9,
      generatedAt: new Date().toISOString(),
      contextSnapshot: {},
    },
    feedbackLink: overrides.feedbackLink ?? {
      approvalId,
      taskId: overrides.taskId ?? "task-test-1",
      stageRef: "plan",
      loopIteration: 1,
      refId: "ref-1",
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
  };
}

function createFeedbackLink(overrides: Partial<ApprovalFeedbackLink> = {}): ApprovalFeedbackLink {
  return {
    approvalId: overrides.approvalId ?? "approval-test-1",
    taskId: overrides.taskId ?? "task-test-1",
    stageRef: overrides.stageRef ?? "plan",
    loopIteration: overrides.loopIteration ?? 1,
    refId: overrides.refId ?? "ref-1",
    feedbackSignalId: overrides.feedbackSignalId ?? null,
    decisionEffect: overrides.decisionEffect ?? "continue",
  };
}

test("HitlInboxService builds inbox items sorted by status priority", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-pending",
        riskLevel: "low",
        deadlineAt: null,
      }),
      createPacket({
        approvalId: "approval-due-soon",
        riskLevel: "high",
        deadlineAt: "2026-04-27T10:10:00.000Z", // 10 minutes from now
      }),
      createPacket({
        approvalId: "approval-expired",
        riskLevel: "critical",
        deadlineAt: "2026-04-27T09:30:00.000Z", // in the past
      }),
      createPacket({
        approvalId: "approval-decided",
        riskLevel: "medium",
        deadlineAt: "2026-04-27T12:00:00.000Z",
      }),
    ],
    [createFeedbackLink({ approvalId: "approval-decided", feedbackSignalId: "feedback-decided-1" })],
    now,
  );

  // Should be sorted: expired (0), due_soon (1), pending (2), decided (3)
  assert.deepEqual(
    items.map((item) => item.approvalId),
    ["approval-expired", "approval-due-soon", "approval-pending", "approval-decided"],
  );
});

test("HitlInboxService resolves status to expired when deadline passed", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-expired",
        deadlineAt: "2026-04-27T09:00:00.000Z", // 1 hour ago
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.status, "expired");
});

test("HitlInboxService resolves status to due_soon when within 15 minutes", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-due-soon",
        deadlineAt: "2026-04-27T10:10:00.000Z", // 10 minutes from now
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.status, "due_soon");
});

test("HitlInboxService resolves status to decided when feedback signal exists", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-with-feedback",
        deadlineAt: "2026-04-27T12:00:00.000Z",
      }),
    ],
    [createFeedbackLink({ approvalId: "approval-with-feedback", feedbackSignalId: "signal-123" })],
    now,
  );

  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService resolves status to decided when decision effect is not continue", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-blocked",
        deadlineAt: "2026-04-27T12:00:00.000Z",
      }),
    ],
    [createFeedbackLink({ approvalId: "approval-blocked", feedbackSignalId: null, decisionEffect: "block_candidate" })],
    now,
  );

  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService defaults notification channels to console for low risk", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([
    createPacket({ approvalId: "approval-low-risk", riskLevel: "low" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console"]);
});

test("HitlInboxService uses console and slack for high risk", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([
    createPacket({ approvalId: "approval-high-risk", riskLevel: "high" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack"]);
});

test("HitlInboxService uses console, slack, mobile_push for critical risk", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([
    createPacket({ approvalId: "approval-critical-risk", riskLevel: "critical" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack", "mobile_push"]);
});

test("HitlInboxService uses all channels for circuit_breaker_human mode", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([
    createPacket({ approvalId: "approval-circuit", mode: "circuit_breaker_human", riskLevel: "low" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack", "mobile_push", "webhook"]);
});

test("HitlInboxService uses console, email, slack for delegated_approval mode", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([
    createPacket({ approvalId: "approval-delegated", mode: "delegated_approval", riskLevel: "medium" }),
  ]);

  assert.deepEqual(items[0]?.notificationChannels, ["console", "email", "slack"]);
});

test("HitlInboxService builds correct summary counts", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({ approvalId: "pending-1", riskLevel: "low", deadlineAt: null }),
      createPacket({ approvalId: "pending-2", riskLevel: "low", deadlineAt: null }),
      createPacket({
        approvalId: "due-soon-1",
        riskLevel: "low",
        deadlineAt: "2026-04-27T10:10:00.000Z",
      }),
      createPacket({
        approvalId: "expired-1",
        riskLevel: "critical",
        deadlineAt: "2026-04-27T09:00:00.000Z",
      }),
    ],
    [createFeedbackLink({ approvalId: "decided-1", feedbackSignalId: "signal-1" })],
    now,
  );

  // Add one more decided by patching the items manually
  const allItems = service.buildInbox(
    [
      createPacket({ approvalId: "pending-1", riskLevel: "low", deadlineAt: null }),
      createPacket({ approvalId: "pending-2", riskLevel: "low", deadlineAt: null }),
      createPacket({
        approvalId: "due-soon-1",
        riskLevel: "low",
        deadlineAt: "2026-04-27T10:10:00.000Z",
      }),
      createPacket({
        approvalId: "expired-1",
        riskLevel: "critical",
        deadlineAt: "2026-04-27T09:00:00.000Z",
      }),
      createPacket({ approvalId: "decided-1", riskLevel: "low", deadlineAt: "2026-04-27T12:00:00.000Z" }),
    ],
    [
      createFeedbackLink({ approvalId: "decided-1", feedbackSignalId: "signal-1" }),
    ],
    now,
  );

  const summary = service.buildSummary(allItems);

  assert.equal(summary.total, 5);
  assert.equal(summary.pending, 2);
  assert.equal(summary.dueSoon, 1);
  assert.equal(summary.expired, 1);
  assert.equal(summary.decided, 1);
  assert.equal(summary.critical, 1); // expired-1 is critical risk
});

test("HitlInboxService returns empty inbox when no packets", () => {
  const service = new HitlInboxService();

  const items = service.buildInbox([]);
  const summary = service.buildSummary(items);

  assert.equal(items.length, 0);
  assert.equal(summary.total, 0);
  assert.equal(summary.pending, 0);
});

test("HitlInboxService sorts by risk within same status", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "expired-low",
        riskLevel: "low",
        deadlineAt: "2026-04-27T09:00:00.000Z",
      }),
      createPacket({
        approvalId: "expired-critical",
        riskLevel: "critical",
        deadlineAt: "2026-04-27T09:00:00.000Z",
      }),
      createPacket({
        approvalId: "expired-high",
        riskLevel: "high",
        deadlineAt: "2026-04-27T09:00:00.000Z",
      }),
    ],
    [],
    now,
  );

  // All expired, sorted by risk: critical (0), high (1), low (2)
  assert.deepEqual(
    items.map((item) => item.approvalId),
    ["expired-critical", "expired-high", "expired-low"],
  );
});

test("HitlInboxService handles null deadline as pending", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-no-deadline",
        deadlineAt: null,
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.status, "pending");
  assert.equal(items[0]?.deadlineAt, null);
});

test("HitlInboxService includes available actions from options", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-with-options",
        options: [
          { optionId: "approve_main", label: "Approve Main", style: "primary", requiresConfirm: true },
          { optionId: "approve_alternative", label: "Approve Alternative", style: "secondary", requiresConfirm: false },
          { optionId: "reject", label: "Reject", style: "danger", requiresConfirm: true },
        ],
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.availableActions.length, 3);
  assert.deepEqual(items[0]?.availableActions.map((a) => a.optionId), ["approve_main", "approve_alternative", "reject"]);
});

test("HitlInboxService preserves stageRef from packet", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-release-stage",
        feedbackLink: {
          approvalId: "approval-release-stage",
          taskId: "task-1",
          stageRef: "release",
          loopIteration: null,
          refId: null,
          feedbackSignalId: null,
          decisionEffect: "continue",
        },
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.stageRef, "release");
});

test("HitlInboxService includes recommended option ID", () => {
  const service = new HitlInboxService();
  const now = "2026-04-27T10:00:00.000Z";

  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-recommended",
        recommendedOptionId: "approve_candidate",
        options: [
          { optionId: "approve_candidate", label: "Approve Candidate", style: "primary", requiresConfirm: true },
          { optionId: "request_changes", label: "Request Changes", style: "secondary", requiresConfirm: false },
        ],
      }),
    ],
    [],
    now,
  );

  assert.equal(items[0]?.recommendedOptionId, "approve_candidate");
});