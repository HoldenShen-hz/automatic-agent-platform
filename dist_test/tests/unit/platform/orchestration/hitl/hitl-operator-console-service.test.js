import assert from "node:assert/strict";
import test from "node:test";
import { HitlOperatorConsoleService } from "../../../../../src/platform/orchestration/hitl/hitl-operator-console-service.js";
function buildPacket() {
    return {
        approvalId: "approval-1",
        taskId: "task-1",
        executionId: "exec-1",
        title: "Approve rollout",
        reason: "Release requires approval",
        riskLevel: "critical",
        options: [
            { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true },
        ],
        recommendedOptionId: "approve",
        deadlineAt: null,
        timeoutPolicy: "reject",
        explanation: {
            explanationId: "exp-1",
            taskId: "task-1",
            executionId: "exec-1",
            takeoverSessionId: null,
            decisionType: "approval_required",
            summary: "Approval required",
            factors: [],
            recommendations: [],
            confidenceScore: 0.8,
            generatedAt: "2026-04-20T00:00:00.000Z",
            contextSnapshot: { tenantId: "tenant-1" },
        },
        feedbackLink: {
            approvalId: "approval-1",
            taskId: "task-1",
            stageRef: "release",
            loopIteration: null,
            refId: null,
            feedbackSignalId: null,
            decisionEffect: "continue",
        },
    };
}
test("HitlOperatorConsoleService routes high-risk approvals to multiple channels and queues them", async () => {
    const deliveries = [];
    const service = new HitlOperatorConsoleService([
        { channel: "slack", minRiskLevel: "high" },
        { channel: "pager", minRiskLevel: "critical", stages: ["release"] },
    ], async (input) => {
        const { channel, packet } = input;
        deliveries.push(`${channel}:${packet.approvalId}`);
        return {
            delivered: true,
            deliveryId: `${channel}:${packet.approvalId}`,
        };
    });
    const result = await service.dispatch(buildPacket());
    const queue = service.listQueue({ tenantId: "tenant-1" });
    assert.equal(result.delivered, true);
    assert.deepEqual(deliveries, ["console:approval-1", "slack:approval-1", "pager:approval-1"]);
    assert.equal(queue.length, 1);
    assert.deepEqual(queue[0]?.deliveryChannels, ["console", "slack", "pager"]);
});
test("HitlOperatorConsoleService acknowledges and resolves queue items", async () => {
    const service = new HitlOperatorConsoleService([], async () => ({
        delivered: true,
        deliveryId: "console:approval-1",
    }));
    await service.dispatch(buildPacket());
    const acknowledged = service.acknowledge("approval-1", "operator-1");
    const resolved = service.resolve("approval-1", {
        approvalId: "approval-1",
        taskId: "task-1",
        stageRef: "release",
        loopIteration: null,
        refId: null,
        feedbackSignalId: "feedback_signal_1",
        decisionEffect: "advance_rollout",
    });
    assert.equal(acknowledged.status, "acknowledged");
    assert.equal(resolved.status, "resolved");
    assert.equal(resolved.takeoverSessionId, "feedback_signal_1");
});
//# sourceMappingURL=hitl-operator-console-service.test.js.map