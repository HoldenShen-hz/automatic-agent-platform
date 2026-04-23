import assert from "node:assert/strict";
import test from "node:test";
import { join } from "node:path";
import { ApprovalService } from "../../../../../src/platform/control-plane/approval-center/approval-service.js";
import { HITLExplainabilityService } from "../../../../../src/platform/orchestration/hitl/hitl-explainability-service.js";
import { HitlApprovalOrchestrationService } from "../../../../../src/platform/orchestration/hitl/hitl-approval-orchestration-service.js";
import { AuthoritativeTaskStore } from "../../../../../src/platform/state-evidence/truth/authoritative-task-store.js";
import { SqliteDatabase } from "../../../../../src/platform/state-evidence/truth/sqlite/sqlite-database.js";
import { cleanupPath, createTempWorkspace } from "../../../../helpers/fs.js";
import { seedTaskAndExecution } from "../../../../helpers/seed.js";
import { nowIso } from "../../../../../src/platform/contracts/types/ids.js";
function createHarness(prefix) {
    const workspace = createTempWorkspace(prefix);
    const dbPath = join(workspace, "hitl-approval.db");
    const db = new SqliteDatabase(dbPath);
    db.migrate();
    const store = new AuthoritativeTaskStore(db);
    return { workspace, db, store };
}
test("HitlApprovalOrchestrationService blocks critical auto-approve timeout without break-glass", async () => {
    const h = createHarness("aa-hitl-approval-policy-");
    try {
        seedTaskAndExecution(h.db, h.store, { taskId: "task_hitl_1", executionId: "exec_hitl_1" });
        const approvalService = new ApprovalService(h.db, h.store);
        const explainabilityService = new HITLExplainabilityService(h.store);
        const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
        await assert.rejects(async () => {
            await service.requestApproval({
                taskId: "task_hitl_1",
                executionId: "exec_hitl_1",
                sourceAgentId: "agent_ops",
                mode: "circuit_breaker_human",
                title: "Critical release gate",
                reason: "Release to production",
                riskLevel: "critical",
                stageRef: "release",
                options: [
                    { optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true },
                ],
                timeoutPolicy: "approve",
            });
        }, /hitl_approval\.critical_timeout_auto_approve_forbidden/);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("HitlApprovalOrchestrationService creates approval packet, explanation, and feedback signal on text input", async () => {
    const h = createHarness("aa-hitl-approval-flow-");
    try {
        seedTaskAndExecution(h.db, h.store, { taskId: "task_hitl_2", executionId: "exec_hitl_2" });
        const approvalService = new ApprovalService(h.db, h.store);
        const explainabilityService = new HITLExplainabilityService(h.store);
        const deliveries = [];
        const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService, {
            async dispatch(packet) {
                deliveries.push(packet.approvalId);
                return { channel: "console", delivered: true, deliveryId: packet.approvalId };
            },
        });
        const packet = await service.requestApproval({
            taskId: "task_hitl_2",
            executionId: "exec_hitl_2",
            sourceAgentId: "planner_agent",
            mode: "iterative_feedback",
            title: "Need plan clarification",
            reason: "Ambiguous deployment region",
            riskLevel: "high",
            stageRef: "plan",
            loopIteration: 2,
            refId: "artifact:plan-1",
            options: [
                { optionId: "approve_candidate", label: "Approve", style: "primary", requiresConfirm: true },
                { optionId: "request_changes", label: "Request changes", style: "secondary", requiresConfirm: false },
            ],
            recommendedOptionId: "request_changes",
            deadlineAt: "2026-04-20T12:00:00.000Z",
            timeoutPolicy: "reject",
        });
        assert.equal(deliveries[0], packet.approvalId);
        assert.equal(packet.feedbackLink.stageRef, "plan");
        assert.equal(packet.explanation.decisionType, "approval_required");
        const result = service.applyDecision({
            approvalId: packet.approvalId,
            decisionType: "text_input",
            inputText: "Use cn-sh only and revise the plan",
            respondedBy: "operator_1",
            respondedAt: nowIso(),
        });
        assert.equal(result.feedbackLink.decisionEffect, "revise_plan");
        assert.ok(result.feedbackLink.feedbackSignalId?.startsWith("feedback_signal_"));
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("HitlApprovalOrchestrationService builds timeout decisions from packet policy", async () => {
    const h = createHarness("aa-hitl-approval-timeout-");
    try {
        seedTaskAndExecution(h.db, h.store, { taskId: "task_hitl_3", executionId: "exec_hitl_3" });
        const approvalService = new ApprovalService(h.db, h.store);
        const explainabilityService = new HITLExplainabilityService(h.store);
        const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
        const packet = await service.requestApproval({
            taskId: "task_hitl_3",
            executionId: "exec_hitl_3",
            sourceAgentId: "agent_ops",
            mode: "informed_confirmation",
            title: "Wait for confirmation",
            reason: "Need human confirmation",
            riskLevel: "medium",
            stageRef: "execute",
            options: [
                { optionId: "confirm", label: "Confirm", style: "primary", requiresConfirm: true },
            ],
            timeoutPolicy: "approve",
        });
        const timeoutDecision = service.buildTimeoutDecision(packet.approvalId);
        assert.equal(timeoutDecision.decisionType, "confirmed");
        assert.equal(timeoutDecision.confirmed, true);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
test("HitlApprovalOrchestrationService validates all authoritative HITL modes", async () => {
    const h = createHarness("aa-hitl-modes-");
    try {
        seedTaskAndExecution(h.db, h.store, { taskId: "task_hitl_4", executionId: "exec_hitl_4" });
        const approvalService = new ApprovalService(h.db, h.store);
        const explainabilityService = new HITLExplainabilityService(h.store);
        const service = new HitlApprovalOrchestrationService(approvalService, explainabilityService);
        const packets = await Promise.all([
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_single",
                mode: "single_approval",
                title: "Single approval",
                reason: "baseline",
                riskLevel: "medium",
                stageRef: "plan",
                options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
                timeoutPolicy: "reject",
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_multi",
                mode: "multi_party_approval",
                title: "Multi approval",
                reason: "two approvers",
                riskLevel: "high",
                stageRef: "release",
                options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
                timeoutPolicy: "reject",
                context: { requiredApprovals: 2 },
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_delegate",
                mode: "delegated_approval",
                title: "Delegate approval",
                reason: "delegate route",
                riskLevel: "medium",
                stageRef: "execute",
                options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
                timeoutPolicy: "reject",
                context: { delegationTarget: "ops_lead" },
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_feedback",
                mode: "iterative_feedback",
                title: "Feedback loop",
                reason: "needs revision",
                riskLevel: "high",
                stageRef: "plan",
                options: [
                    { optionId: "approve_candidate", label: "Approve", style: "primary", requiresConfirm: true },
                    { optionId: "request_changes", label: "Request changes", style: "secondary", requiresConfirm: false },
                ],
                timeoutPolicy: "reject",
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_collab",
                mode: "collaborative_edit",
                title: "Collaborative edit",
                reason: "shared artifact edit",
                riskLevel: "medium",
                stageRef: "feedback",
                options: [{ optionId: "approve", label: "Approve", style: "primary", requiresConfirm: true }],
                timeoutPolicy: "remain_pending",
                context: { sharedArtifactRef: "artifact:shared-doc" },
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_confirm",
                mode: "informed_confirmation",
                title: "Confirm",
                reason: "one-click confirm",
                riskLevel: "low",
                stageRef: "execute",
                options: [{ optionId: "confirm", label: "Confirm", style: "primary", requiresConfirm: true }],
                timeoutPolicy: "reject",
            }),
            service.requestApproval({
                taskId: "task_hitl_4",
                executionId: "exec_hitl_4",
                sourceAgentId: "agent_breaker",
                mode: "circuit_breaker_human",
                title: "Circuit breaker",
                reason: "block critical action",
                riskLevel: "critical",
                stageRef: "release",
                options: [{ optionId: "block", label: "Block", style: "danger", requiresConfirm: true }],
                timeoutPolicy: "reject",
            }),
        ]);
        assert.deepEqual(packets.map((packet) => packet.mode), [
            "single_approval",
            "multi_party_approval",
            "delegated_approval",
            "iterative_feedback",
            "collaborative_edit",
            "informed_confirmation",
            "circuit_breaker_human",
        ]);
        assert.equal(packets.every((packet) => packet.explanation.contextSnapshot.hitlMode === packet.mode), true);
    }
    finally {
        h.db.close();
        cleanupPath(h.workspace);
    }
});
//# sourceMappingURL=hitl-approval-orchestration-service.test.js.map