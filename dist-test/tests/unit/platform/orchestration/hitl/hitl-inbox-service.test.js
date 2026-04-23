import assert from "node:assert/strict";
import test from "node:test";
import { HitlInboxService } from "../../../../../src/platform/orchestration/hitl/hitl-inbox-service.js";
function createPacket(overrides = {}) {
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
function createFeedbackLink(overrides = {}) {
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
    const items = service.buildInbox([
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
    ], [createFeedbackLink({ approvalId: "approval-decided" })], now);
    assert.deepEqual(items.map((item) => [item.approvalId, item.status]), [
        ["approval-expired", "expired"],
        ["approval-due-soon", "due_soon"],
        ["approval-pending", "pending"],
        ["approval-decided", "decided"],
    ]);
    assert.deepEqual(items[1]?.notificationChannels, ["console", "slack", "mobile_push"]);
    assert.equal(items[0]?.explanationSummary, "Decision has side effects");
    assert.equal(items[2]?.mode, "single_approval");
    assert.deepEqual(service.buildSummary(items), {
        total: 4,
        pending: 1,
        dueSoon: 1,
        expired: 1,
        decided: 1,
        critical: 1,
    });
});
test("HitlInboxService adjusts notification channels for circuit breaker and delegated modes", () => {
    const service = new HitlInboxService();
    const items = service.buildInbox([
        createPacket({ approvalId: "approval-circuit", mode: "circuit_breaker_human", riskLevel: "critical" }),
        createPacket({ approvalId: "approval-delegated", mode: "delegated_approval", riskLevel: "medium" }),
    ]);
    const circuit = items.find((item) => item.approvalId === "approval-circuit");
    const delegated = items.find((item) => item.approvalId === "approval-delegated");
    assert.deepEqual(circuit?.notificationChannels, ["console", "slack", "mobile_push", "webhook"]);
    assert.deepEqual(delegated?.notificationChannels, ["console", "email", "slack"]);
});
//# sourceMappingURL=hitl-inbox-service.test.js.map