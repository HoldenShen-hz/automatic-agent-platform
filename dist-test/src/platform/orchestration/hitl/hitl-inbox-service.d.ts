import type { ApprovalFeedbackLink, ApprovalPacket, ApprovalPacketOption } from "./hitl-approval-orchestration-service.js";
import type { HitlMode } from "./hitl-modes.js";
export type HitlNotificationChannel = "console" | "email" | "slack" | "webhook" | "mobile_push";
export type HitlInboxStatus = "pending" | "due_soon" | "expired" | "decided";
export interface HitlInboxItem {
    readonly itemId: string;
    readonly approvalId: string;
    readonly taskId: string;
    readonly executionId: string | null;
    readonly mode: HitlMode;
    readonly title: string;
    readonly reason: string;
    readonly riskLevel: ApprovalPacket["riskLevel"];
    readonly stageRef: ApprovalFeedbackLink["stageRef"];
    readonly status: HitlInboxStatus;
    readonly deadlineAt: string | null;
    readonly timeoutPolicy: ApprovalPacket["timeoutPolicy"];
    readonly recommendedOptionId: string | null;
    readonly availableActions: readonly ApprovalPacketOption[];
    readonly notificationChannels: readonly HitlNotificationChannel[];
    readonly explanationSummary: string;
}
export interface HitlInboxSummary {
    readonly total: number;
    readonly pending: number;
    readonly dueSoon: number;
    readonly expired: number;
    readonly decided: number;
    readonly critical: number;
}
export declare class HitlInboxService {
    buildInbox(packets: readonly ApprovalPacket[], feedbackLinks?: readonly ApprovalFeedbackLink[], now?: string): HitlInboxItem[];
    buildSummary(items: readonly HitlInboxItem[]): HitlInboxSummary;
    private toInboxItem;
}
