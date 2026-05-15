/**
 * Basic unit tests for approval inbox functionality
 * Tests core HitlInboxService building and summary
 */

import assert from "node:assert/strict";
import test from "node:test";

import { HitlInboxService } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-inbox-service.js";
import type { ApprovalFeedbackLink, ApprovalPacket } from "../../../../../src/platform/five-plane-orchestration/hitl/hitl-approval-orchestration-service.js";

function makePacket(overrides: Partial<ApprovalPacket> = {}): ApprovalPacket {
  const id = overrides.approvalId ?? "test-approval";
  return {
    approvalId: id,
    taskId: overrides.taskId ?? "test-task",
    executionId: overrides.executionId ?? "test-exec",
    mode: overrides.mode ?? "single_approval",
    title: overrides.title ?? "Test approval",
    reason: overrides.reason ?? "Test reason",
    riskLevel: overrides.riskLevel ?? "medium",
    options: overrides.options ?? [
      { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: false },
    ],
    recommendedOptionId: overrides.recommendedOptionId ?? "approve",
    deadlineAt: overrides.deadlineAt ?? null,
    timeoutPolicy: overrides.timeoutPolicy ?? "remain_pending",
    explanation: {
      explanationId: "expl-1",
      taskId: "test-task",
      executionId: "test-exec",
      decisionType: "approval_required",
      summary: "Test summary",
      factors: [],
      recommendations: [],
      confidenceScore: 0.9,
      generatedAt: new Date().toISOString(),
      contextSnapshot: {},
    },
    feedbackLink: {
      approvalId: id,
      taskId: "test-task",
      stageRef: "plan",
      loopIteration: 1,
      refId: "ref-1",
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
  };
}

function makeFeedback(overrides: Partial<ApprovalFeedbackLink> = {}): ApprovalFeedbackLink {
  return {
    approvalId: overrides.approvalId ?? "test-approval",
    taskId: overrides.taskId ?? "test-task",
    stageRef: overrides.stageRef ?? "plan",
    loopIteration: overrides.loopIteration ?? 1,
    refId: overrides.refId ?? "ref-1",
    feedbackSignalId: overrides.feedbackSignalId ?? null,
    decisionEffect: overrides.decisionEffect ?? "continue",
  };
}

test("HitlInboxService returns empty inbox", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([]);
  assert.equal(items.length, 0);
});

test("HitlInboxService builds single item", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "ap-1" })]);
  assert.equal(items.length, 1);
  assert.equal(items[0]?.approvalId, "ap-1");
});

test("HitlInboxService builds summary with zero counts", () => {
  const service = new HitlInboxService();
  const summary = service.buildSummary([]);
  assert.equal(summary.total, 0);
  assert.equal(summary.pending, 0);
  assert.equal(summary.dueSoon, 0);
  assert.equal(summary.expired, 0);
  assert.equal(summary.decided, 0);
  assert.equal(summary.critical, 0);
});

test("HitlInboxService marks pending when no deadline", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "ap-pending", deadlineAt: null })]);
  assert.equal(items[0]?.status, "pending");
});

test("HitlInboxService marks expired when deadline passed", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "ap-expired", deadlineAt: "2026-04-27T08:00:00.000Z" }),
  ], [], "2026-04-27T10:00:00.000Z");
  assert.equal(items[0]?.status, "expired");
});

test("HitlInboxService marks due_soon when within 15 minutes", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "ap-soon", deadlineAt: "2026-04-27T10:10:00.000Z" }),
  ], [], "2026-04-27T10:00:00.000Z");
  assert.equal(items[0]?.status, "due_soon");
});

test("HitlInboxService marks decided when feedback exists", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [makePacket({ approvalId: "ap-decided" })],
    [makeFeedback({ approvalId: "ap-decided", feedbackSignalId: "sig-1" })],
    "2026-04-27T10:00:00.000Z",
  );
  assert.equal(items[0]?.status, "decided");
});

test("HitlInboxService builds correct summary for mixed statuses", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox(
    [
      makePacket({ approvalId: "pending-1", deadlineAt: null }),
      makePacket({ approvalId: "pending-2", deadlineAt: null }),
      makePacket({ approvalId: "expired-1", deadlineAt: "2026-04-27T08:00:00.000Z" }),
      makePacket({ approvalId: "due-soon-1", deadlineAt: "2026-04-27T10:10:00.000Z" }),
    ],
    [makeFeedback({ approvalId: "decided-1", feedbackSignalId: "sig-1" })],
    "2026-04-27T10:00:00.000Z",
  );

  const allItems = service.buildInbox(
    [
      makePacket({ approvalId: "pending-1", deadlineAt: null }),
      makePacket({ approvalId: "pending-2", deadlineAt: null }),
      makePacket({ approvalId: "expired-1", deadlineAt: "2026-04-27T08:00:00.000Z" }),
      makePacket({ approvalId: "due-soon-1", deadlineAt: "2026-04-27T10:10:00.000Z" }),
      makePacket({ approvalId: "decided-1" }),
    ],
    [makeFeedback({ approvalId: "decided-1", feedbackSignalId: "sig-1" })],
    "2026-04-27T10:00:00.000Z",
  );

  const summary = service.buildSummary(allItems);
  assert.equal(summary.total, 5);
  assert.equal(summary.pending, 2);
  assert.equal(summary.expired, 1);
  assert.equal(summary.dueSoon, 1);
  assert.equal(summary.decided, 1);
});

test("HitlInboxService counts critical risk items", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "crit-1", riskLevel: "critical" }),
    makePacket({ approvalId: "crit-2", riskLevel: "critical" }),
    makePacket({ approvalId: "high-1", riskLevel: "high" }),
  ]);
  const summary = service.buildSummary(items);
  assert.equal(summary.critical, 2);
});

test("HitlInboxService sets console notification for low risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "low-risk", riskLevel: "low" })]);
  assert.deepEqual(items[0]?.notificationChannels, ["console"]);
});

test("HitlInboxService sets console and slack for high risk", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "high-risk", riskLevel: "high" })]);
  assert.deepEqual(items[0]?.notificationChannels, ["console", "slack"]);
});

test("HitlInboxService itemId follows hitl_inbox prefix", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([makePacket({ approvalId: "ap-custom" })]);
  assert.equal(items[0]?.itemId, "hitl_inbox:ap-custom");
});

test("HitlInboxService copies title and reason from packet", () => {
  const service = new HitlInboxService();
  const items = service.buildInbox([
    makePacket({ approvalId: "ap-1", title: "Release approval", reason: "Deploy to prod" }),
  ]);
  assert.equal(items[0]?.title, "Release approval");
  assert.equal(items[0]?.reason, "Deploy to prod");
});

test("HitlInboxService copies explanation summary", () => {
  const service = new HitlInboxService();
  const customPacket: ApprovalPacket = {
    approvalId: "ap-custom-summary",
    taskId: "task-1",
    executionId: "exec-1",
    mode: "single_approval",
    title: "Custom summary test",
    reason: "Testing",
    riskLevel: "medium",
    options: [
      { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: false },
    ],
    recommendedOptionId: "approve",
    deadlineAt: null,
    timeoutPolicy: "remain_pending",
    explanation: {
      explanationId: "expl-custom",
      taskId: "task-1",
      executionId: "exec-1",
      decisionType: "approval_required",
      summary: "Low risk deployment recommended",
      factors: [],
      recommendations: [],
      confidenceScore: 0.95,
      generatedAt: new Date().toISOString(),
      contextSnapshot: {},
    },
    feedbackLink: {
      approvalId: "ap-custom-summary",
      taskId: "task-1",
      stageRef: "plan",
      loopIteration: 1,
      refId: "ref-1",
      feedbackSignalId: null,
      decisionEffect: "continue",
    },
  };
  const items = service.buildInbox([customPacket]);
  assert.equal(items[0]?.explanationSummary, "Low risk deployment recommended");
});
