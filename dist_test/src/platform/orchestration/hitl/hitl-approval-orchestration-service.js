import { newId, nowIso } from "../../contracts/types/ids.js";
function defaultEffectForDecision(decision) {
    if (decision.decisionType === "rejected" || decision.decisionType === "expired") {
        return "block_candidate";
    }
    if (decision.decisionType === "text_input") {
        return "revise_plan";
    }
    if (decision.selectedOptionId === "rollback") {
        return "rollback_rollout";
    }
    if (decision.selectedOptionId === "advance_rollout") {
        return "advance_rollout";
    }
    if (decision.selectedOptionId === "approve_candidate") {
        return "approve_candidate";
    }
    return "continue";
}
export class HitlApprovalOrchestrationService {
    approvalService;
    explainabilityService;
    notificationPort;
    packets = new Map();
    feedbackLinks = new Map();
    constructor(approvalService, explainabilityService, notificationPort = null) {
        this.approvalService = approvalService;
        this.explainabilityService = explainabilityService;
        this.notificationPort = notificationPort;
    }
    async requestApproval(request) {
        if (request.options.length === 0) {
            throw new Error("hitl_approval.options_required");
        }
        if (request.riskLevel === "critical" && request.timeoutPolicy === "approve" && request.breakGlassApproved !== true) {
            throw new Error("hitl_approval.critical_timeout_auto_approve_forbidden");
        }
        const approval = this.approvalService.createRequest({
            taskId: request.taskId,
            executionId: request.executionId ?? null,
            sourceAgentId: request.sourceAgentId,
            reason: request.reason,
            riskLevel: request.riskLevel,
            options: request.options.map((option) => option.optionId),
            context: {
                ...(request.context ?? {}),
                title: request.title,
                stageRef: request.stageRef,
                loopIteration: request.loopIteration ?? null,
                refId: request.refId ?? null,
                recommendedOptionId: request.recommendedOptionId ?? null,
                deadlineAt: request.deadlineAt ?? null,
            },
            timeoutPolicy: request.timeoutPolicy,
        });
        const explanation = this.explainabilityService.explainApprovalRequired(request.taskId, {
            riskLevel: request.riskLevel,
            policy: "approval_and_hitl_contract",
            classification: String(request.context?.classification ?? "unspecified"),
        }, {
            executionId: request.executionId ?? null,
            contextSnapshot: {
                ...(request.context ?? {}),
                taskId: request.taskId,
                executionId: request.executionId ?? null,
                title: request.title,
                stageRef: request.stageRef,
                recommendedOptionId: request.recommendedOptionId ?? null,
            },
        });
        const feedbackLink = {
            approvalId: approval.approvalId,
            taskId: request.taskId,
            stageRef: request.stageRef,
            loopIteration: request.loopIteration ?? null,
            refId: request.refId ?? null,
            feedbackSignalId: null,
            decisionEffect: "continue",
        };
        const packet = {
            approvalId: approval.approvalId,
            taskId: request.taskId,
            executionId: request.executionId ?? null,
            title: request.title,
            reason: request.reason,
            riskLevel: request.riskLevel,
            options: request.options,
            recommendedOptionId: request.recommendedOptionId ?? null,
            deadlineAt: request.deadlineAt ?? null,
            timeoutPolicy: request.timeoutPolicy,
            explanation,
            feedbackLink,
        };
        this.packets.set(packet.approvalId, packet);
        this.feedbackLinks.set(packet.approvalId, feedbackLink);
        if (this.notificationPort != null) {
            await this.notificationPort.dispatch(packet);
        }
        return packet;
    }
    applyDecision(decision) {
        this.approvalService.applyDecision(decision);
        const existingLink = this.feedbackLinks.get(decision.approvalId);
        if (existingLink == null) {
            throw new Error(`hitl_approval.feedback_link_not_found:${decision.approvalId}`);
        }
        const updatedLink = {
            ...existingLink,
            feedbackSignalId: decision.decisionType === "text_input" ? newId("feedback_signal") : existingLink.feedbackSignalId,
            decisionEffect: defaultEffectForDecision(decision),
        };
        this.feedbackLinks.set(decision.approvalId, updatedLink);
        return {
            approvalId: decision.approvalId,
            decision,
            feedbackLink: updatedLink,
        };
    }
    buildTimeoutDecision(approvalId, respondedBy = "system:hitl_timeout") {
        const packet = this.packets.get(approvalId);
        if (packet == null) {
            throw new Error(`hitl_approval.packet_not_found:${approvalId}`);
        }
        if (packet.timeoutPolicy === "approve") {
            return {
                approvalId,
                decisionType: "confirmed",
                confirmed: true,
                respondedBy,
                respondedAt: nowIso(),
            };
        }
        return {
            approvalId,
            decisionType: "expired",
            respondedBy,
            respondedAt: nowIso(),
        };
    }
    getPacket(approvalId) {
        return this.packets.get(approvalId) ?? null;
    }
    getFeedbackLink(approvalId) {
        return this.feedbackLinks.get(approvalId) ?? null;
    }
}
//# sourceMappingURL=hitl-approval-orchestration-service.js.map