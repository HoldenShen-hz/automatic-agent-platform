/**
 * @fileoverview UX Event Tracking Service
 *
 * Provides A/B testing support for UX flows and user interaction event tracking.
 * Uses traffic routing (traffic-routing-service) for A/B test assignment and
 * publishes interaction events to the event bus for analytics.
 *
 * §44 UX 流程 - A/B 测试框架 + 用户操作埋点
 */
import { type TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
export interface UxEventTrack {
    readonly eventId: string;
    readonly eventType: UxEventType;
    readonly userId: string;
    readonly sessionId: string | null;
    readonly taskId: string | null;
    readonly abTestGroup: string | null;
    readonly elementId: string | null;
    readonly interactionType: InteractionType;
    readonly metadata: Readonly<Record<string, string>>;
    readonly occurredAt: string;
}
export type UxEventType = "ux:button_click" | "ux:form_submit" | "ux:navigation" | "ux:wizard_step" | "ux:workflow_build" | "ux:dashboard_view" | "ux:search_query" | "ux:filter_apply" | "ux:export_action" | "ux:share_action" | "ux:onboarding_complete" | "ux:feedback_submit";
export type InteractionType = "click" | "submit" | "navigate" | "search" | "filter" | "export" | "share" | "feedback" | "wizard_next" | "wizard_back" | "wizard_cancel";
export interface ABTestAssignment {
    readonly testId: string;
    readonly variantId: string;
    readonly bucket: number;
    readonly assignedAt: string;
}
export interface ABTestConfig {
    testId: string;
    variants: readonly {
        variantId: string;
        weight: number;
    }[];
    stickinessFactor: number;
    minSampleSize: number;
}
export declare class UxEventTrackingService {
    private readonly eventPublisher;
    private readonly abTestAssignments;
    private readonly eventLog;
    constructor(eventPublisher?: TypedEventPublisher);
    trackEvent<T extends UxEventType>(eventType: T, payload: {
        userId: string;
        sessionId?: string | null;
        taskId?: string | null;
        abTestGroup?: string | null;
        metadata?: Record<string, string>;
        [key: string]: unknown;
    }): UxEventTrack;
    getRecentEvents(limit?: number): readonly UxEventTrack[];
    assignABTest(userId: string, config?: ABTestConfig): ABTestAssignment;
    getABTestAssignment(userId: string, testId: string): ABTestAssignment | null;
    recordConversion(userId: string, testId: string, goalId: string): void;
    private computeBucket;
    private selectVariant;
    private abTestAssignmentForTest;
}
