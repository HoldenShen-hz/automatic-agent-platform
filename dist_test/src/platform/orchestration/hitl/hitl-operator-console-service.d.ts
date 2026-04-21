import type { ApprovalNotificationPort } from "./hitl-approval-orchestration-service.js";
import type { ApprovalFeedbackLink, ApprovalPacket, OapeflirStageRef } from "./hitl-approval-orchestration-service.js";
export type HitlNotificationChannel = "console" | "email" | "pager" | "slack";
export type HitlQueueStatus = "pending" | "acknowledged" | "resolved";
export interface HitlNotificationRoutingRule {
    channel: HitlNotificationChannel;
    minRiskLevel: ApprovalPacket["riskLevel"];
    stages?: readonly OapeflirStageRef[];
    tenantIds?: readonly string[];
}
export interface HitlQueueItem {
    queueItemId: string;
    approvalId: string;
    taskId: string;
    executionId: string | null;
    tenantId: string | null;
    title: string;
    stageRef: OapeflirStageRef;
    riskLevel: ApprovalPacket["riskLevel"];
    explanationSummary: string;
    recommendedOptionId: string | null;
    deliveryChannels: HitlNotificationChannel[];
    deliveryIds: string[];
    status: HitlQueueStatus;
    acknowledgedBy: string | null;
    takeoverSessionId: string | null;
    createdAt: string;
    updatedAt: string;
}
export interface HitlQueueFilters {
    status?: HitlQueueStatus;
    tenantId?: string | null;
    stageRef?: OapeflirStageRef;
}
export interface NotificationDispatchResult {
    channel: string;
    delivered: boolean;
    deliveryId: string | null;
}
export declare class HitlOperatorConsoleService implements ApprovalNotificationPort {
    private readonly routingRules;
    private readonly notifier;
    private readonly queue;
    constructor(routingRules: readonly HitlNotificationRoutingRule[], notifier: (input: {
        channel: HitlNotificationChannel;
        packet: ApprovalPacket;
    }) => Promise<{
        delivered: boolean;
        deliveryId: string | null;
    }>);
    dispatch(packet: ApprovalPacket): Promise<NotificationDispatchResult>;
    listQueue(filters?: HitlQueueFilters): HitlQueueItem[];
    acknowledge(approvalId: string, operatorId: string): HitlQueueItem;
    resolve(approvalId: string, feedbackLink: ApprovalFeedbackLink): HitlQueueItem;
    attachTakeoverSession(approvalId: string, takeoverSessionId: string): HitlQueueItem;
    private requireQueueItem;
}
