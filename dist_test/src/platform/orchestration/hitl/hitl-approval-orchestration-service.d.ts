import { ApprovalService, type ApprovalDecision, type ApprovalRequest } from "../../control-plane/approval-center/approval-service.js";
import { HITLExplainabilityService, type DecisionExplanation } from "./hitl-explainability-service.js";
export type OapeflirStageRef = "observe" | "assess" | "plan" | "execute" | "feedback" | "learn" | "improve" | "release";
export type ApprovalDecisionEffect = "continue" | "revise_plan" | "block_candidate" | "approve_candidate" | "advance_rollout" | "rollback_rollout";
export interface ApprovalFeedbackLink {
    readonly approvalId: string;
    readonly taskId: string;
    readonly stageRef: OapeflirStageRef;
    readonly loopIteration: number | null;
    readonly refId: string | null;
    readonly feedbackSignalId: string | null;
    readonly decisionEffect: ApprovalDecisionEffect;
}
export interface ApprovalPacketOption {
    readonly optionId: string;
    readonly label: string;
    readonly style: "primary" | "danger" | "secondary";
    readonly requiresConfirm: boolean;
}
export interface ApprovalPacket {
    readonly approvalId: string;
    readonly taskId: string;
    readonly executionId: string | null;
    readonly title: string;
    readonly reason: string;
    readonly riskLevel: ApprovalRequest["riskLevel"];
    readonly options: readonly ApprovalPacketOption[];
    readonly recommendedOptionId: string | null;
    readonly deadlineAt: string | null;
    readonly timeoutPolicy: ApprovalRequest["timeoutPolicy"];
    readonly explanation: DecisionExplanation;
    readonly feedbackLink: ApprovalFeedbackLink;
}
export interface ApprovalNotificationPort {
    dispatch(packet: ApprovalPacket): Promise<{
        channel: string;
        delivered: boolean;
        deliveryId: string | null;
    }>;
}
export interface HitlApprovalRequest {
    readonly taskId: string;
    readonly executionId?: string | null;
    readonly sourceAgentId: string;
    readonly title: string;
    readonly reason: string;
    readonly riskLevel: ApprovalRequest["riskLevel"];
    readonly stageRef: OapeflirStageRef;
    readonly loopIteration?: number | null;
    readonly refId?: string | null;
    readonly context?: Record<string, unknown>;
    readonly options: readonly ApprovalPacketOption[];
    readonly recommendedOptionId?: string | null;
    readonly deadlineAt?: string | null;
    readonly timeoutPolicy: ApprovalRequest["timeoutPolicy"];
    readonly breakGlassApproved?: boolean;
}
export interface HitlApprovalDecisionResult {
    readonly approvalId: string;
    readonly decision: ApprovalDecision;
    readonly feedbackLink: ApprovalFeedbackLink;
}
export declare class HitlApprovalOrchestrationService {
    private readonly approvalService;
    private readonly explainabilityService;
    private readonly notificationPort;
    private readonly packets;
    private readonly feedbackLinks;
    constructor(approvalService: ApprovalService, explainabilityService: HITLExplainabilityService, notificationPort?: ApprovalNotificationPort | null);
    requestApproval(request: HitlApprovalRequest): Promise<ApprovalPacket>;
    applyDecision(decision: ApprovalDecision): HitlApprovalDecisionResult;
    buildTimeoutDecision(approvalId: string, respondedBy?: string): ApprovalDecision;
    getPacket(approvalId: string): ApprovalPacket | null;
    getFeedbackLink(approvalId: string): ApprovalFeedbackLink | null;
}
