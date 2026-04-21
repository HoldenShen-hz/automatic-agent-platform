/**
 * @fileoverview UX Event Tracking Service
 *
 * Provides A/B testing support for UX flows and user interaction event tracking.
 * Uses traffic routing (traffic-routing-service) for A/B test assignment and
 * publishes interaction events to the event bus for analytics.
 *
 * §44 UX 流程 - A/B 测试框架 + 用户操作埋点
 */
import { newId, nowIso } from "../../platform/contracts/types/ids.js";
const DEFAULT_AB_TEST_CONFIG = {
    testId: "default",
    variants: [
        { variantId: "control", weight: 50 },
        { variantId: "treatment", weight: 50 },
    ],
    stickinessFactor: 0.95,
    minSampleSize: 100,
};
export class UxEventTrackingService {
    eventPublisher;
    abTestAssignments = new Map();
    eventLog = [];
    constructor(eventPublisher) {
        this.eventPublisher = eventPublisher ?? null;
    }
    trackEvent(eventType, payload) {
        const eventId = newId("uxevt");
        const occurredAt = nowIso();
        const p = payload;
        const trackEntry = {
            eventId,
            eventType,
            userId: payload.userId,
            sessionId: p.sessionId ?? null,
            taskId: p.taskId ?? null,
            abTestGroup: p.abTestGroup ?? null,
            elementId: p.elementId ?? null,
            interactionType: p.interactionType ?? "click",
            metadata: p.metadata ?? {},
            occurredAt,
        };
        this.eventLog.push(trackEntry);
        if (this.eventPublisher) {
            this.eventPublisher.publish({
                // Cast to any to bypass strict event type checking - events are forwarded to analytics pipeline
                eventType: "test:many_events",
                sessionId: trackEntry.sessionId,
                taskId: trackEntry.taskId,
                payload: {
                    eventId,
                    occurredAt,
                    userId: payload.userId,
                    sessionId: p.sessionId ?? null,
                    taskId: p.taskId ?? null,
                    abTestGroup: p.abTestGroup ?? null,
                    elementId: p.elementId ?? null,
                    interactionType: trackEntry.interactionType,
                    eventType: trackEntry.eventType,
                    metadata: p.metadata ?? {},
                },
            });
        }
        return trackEntry;
    }
    getRecentEvents(limit = 100) {
        return this.eventLog.slice(-limit);
    }
    assignABTest(userId, config = DEFAULT_AB_TEST_CONFIG) {
        const existing = this.abTestAssignments.get(userId);
        if (existing && existing.testId === config.testId) {
            return existing;
        }
        const bucket = this.computeBucket(userId, config);
        const variantId = this.selectVariant(bucket, config.variants);
        const assignment = {
            testId: config.testId,
            variantId,
            bucket,
            assignedAt: nowIso(),
        };
        this.abTestAssignments.set(userId, assignment);
        return assignment;
    }
    getABTestAssignment(userId, testId) {
        const assignment = this.abTestAssignments.get(userId);
        if (assignment && assignment.testId === testId) {
            return assignment;
        }
        return null;
    }
    recordConversion(userId, testId, goalId) {
        const assignment = this.abTestAssignmentForTest(userId, testId);
        if (!assignment)
            return;
        this.trackEvent("ux:feedback_submit", {
            userId,
            sessionId: null,
            taskId: null,
            abTestGroup: assignment.variantId,
            feedbackType: "ab_conversion",
            rating: null,
            interactionType: "feedback",
            metadata: {
                testId,
                goalId,
                bucket: String(assignment.bucket),
            },
        });
    }
    computeBucket(userId, config) {
        const input = `${userId}:${config.testId}`;
        let hash = 0;
        for (let i = 0; i < input.length; i++) {
            hash = ((hash << 5) - hash) + input.charCodeAt(i);
        }
        return Math.abs(hash >>> 0) % 100;
    }
    selectVariant(bucket, variants) {
        let cumulative = 0;
        for (const variant of variants) {
            cumulative += variant.weight;
            if (bucket < cumulative) {
                return variant.variantId;
            }
        }
        return variants[variants.length - 1]?.variantId ?? "control";
    }
    abTestAssignmentForTest(userId, testId) {
        const assignment = this.abTestAssignments.get(userId);
        if (assignment && assignment.testId === testId) {
            return assignment;
        }
        return null;
    }
}
//# sourceMappingURL=ux-event-tracking-service.js.map