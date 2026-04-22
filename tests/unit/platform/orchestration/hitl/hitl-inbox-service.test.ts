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
      decisionType: "approval_required",
      summary: "Decision has side effects",
      factors: [
        { name: "policy", weight: 0.9, value: "approval_and_hitl_contract", reason: "Manual approval is required" },
      ],
      recommendations: ["approve"],
      confidenceScore: 0.91,
      generatedAt: "2026-04-22T09:59:00.000Z",
      contextSnapshot: { tenantId: "tenant-1" },
    },
    feedbackLink: overrides.feedbackLink ?? {
      approvalId,
      taskId: overrides.taskId ?? "task-1",
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
    approvalId: overrides.approvalId ?? "approval-1",
    taskId: overrides.taskId ?? "task-1",
    stageRef: overrides.stageRef ?? "plan",
    loopIteration: overrides.loopIteration ?? 1,
    refId: overrides.refId ?? "ref-1",
    feedbackSignalId: overrides.feedbackSignalId ?? "feedback-1",
    decisionEffect: overrides.decisionEffect ?? "approve_candidate",
  };
}

test("HitlInboxService builds ordered inbox items and summary", () => {
  const service = new HitlInboxService();
  const now = "2026-04-22T10:00:00.000Z";
  const items = service.buildInbox(
    [
      createPacket({
        approvalId: "approval-expired",
        riskLevel: "high",
        deadlineAt: "2026-04-22T09:59:00.000Z",
      }),
      createPacket({
        approvalId: "approval-due-soon",
        riskLevel: "critical",
        deadlineAt: "2026-04-22T10:10:00.000Z",
      }),
      createPacket({
        approvalId: "approval-pending",
        riskLevel: "low",
        deadlineAt: null,
      }),
      createPacket({
        approvalId: "approval-decided",
        riskLevel: "medium",
        deadlineAt: "2026-04-22T12:00:00.000Z",
      }),
    ],
    [createFeedbackLink({ approvalId: "approval-decided" })],
    now,
  );

  assert.deepEqual(
    items.map((item) => [item.approvalId, item.status]),
    [
      ["approval-expired", "expired"],
      ["approval-due-soon", "due_soon"],
      ["approval-pending", "pending"],
      ["approval-decided", "decided"],
    ],
  );
  assert.deepEqual(items[1]?.notificationChannels, ["console", "slack", "mobile_push"]);
  assert.equal(items[0]?.explanationSummary, "Decision has side effects");

  assert.deepEqual(service.buildSummary(items), {
    total: 4,
    pending: 1,
    dueSoon: 1,
    expired: 1,
    decided: 1,
    critical: 1,
  });
});
