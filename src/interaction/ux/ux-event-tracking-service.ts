/**
 * @fileoverview UX Event Tracking Service
 *
 * Provides A/B testing support for UX flows and user interaction event tracking.
 * Uses traffic routing (traffic-routing-service) for A/B test assignment and
 * publishes interaction events to the event bus for analytics.
 *
 * §44 UX Workflow - A/B Testing Framework + User Event Tracking
 */

import { TypedEventBusPublisher, type TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

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

export type UxEventType =
  | "ux:button_click"
  | "ux:form_submit"
  | "ux:navigation"
  | "ux:wizard_step"
  | "ux:workflow_build"
  | "ux:dashboard_view"
  | "ux:search_query"
  | "ux:filter_apply"
  | "ux:export_action"
  | "ux:share_action"
  | "ux:onboarding_complete"
  | "ux:feedback_submit";

export type InteractionType =
  | "click"
  | "submit"
  | "navigate"
  | "search"
  | "filter"
  | "export"
  | "share"
  | "feedback"
  | "wizard_next"
  | "wizard_back"
  | "wizard_cancel";

export interface ABTestAssignment {
  readonly testId: string;
  readonly variantId: string;
  readonly bucket: number;
  readonly assignedAt: string;
}

export interface ABTestConfig {
  testId: string;
  variants: readonly { variantId: string; weight: number }[];
  stickinessFactor: number;
  minSampleSize: number;
}

const DEFAULT_AB_TEST_CONFIG: ABTestConfig = {
  testId: "default",
  variants: [
    { variantId: "control", weight: 50 },
    { variantId: "treatment", weight: 50 },
  ],
  stickinessFactor: 0.95,
  minSampleSize: 100,
};

interface BaseUxPayload {
  userId: string;
  sessionId: string | null;
  taskId: string | null;
  abTestGroup: string | null;
  metadata: Record<string, string>;
  occurredAt: string;
  eventId: string;
}

export class UxEventTrackingService {
  private readonly eventPublisher: TypedEventPublisher | null;
  private readonly abTestAssignments = new Map<string, ABTestAssignment>();
  private readonly eventLog: UxEventTrack[] = [];
  // R29-35: Maximum event log size to prevent unbounded memory growth
  private readonly maxEventLogSize = 1000;

  public constructor(eventPublisher?: TypedEventPublisher) {
    this.eventPublisher = eventPublisher ?? null;
  }

  public trackEvent<T extends UxEventType>(
    eventType: T,
    payload: { userId: string; sessionId?: string | null; taskId?: string | null; abTestGroup?: string | null; metadata?: Record<string, string>; [key: string]: unknown },
  ): UxEventTrack {
    const eventId = newId("uxevt");
    const occurredAt = nowIso();
    const p = payload as Record<string, unknown>;
    const trackEntry: UxEventTrack = {
      eventId,
      eventType,
      userId: payload.userId,
      sessionId: (p.sessionId as string | null) ?? null,
      taskId: (p.taskId as string | null) ?? null,
      abTestGroup: (p.abTestGroup as string | null) ?? null,
      elementId: (p.elementId as string | null) ?? null,
      interactionType: (p.interactionType as UxEventTrack["interactionType"]) ?? "click",
      metadata: (p.metadata as Record<string, string>) ?? {},
      occurredAt,
    };

    this.eventLog.push(trackEntry);

    // R29-35: Trim event log if it exceeds max size to prevent unbounded growth
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog.splice(0, this.eventLog.length - this.maxEventLogSize);
    }

    if (this.eventPublisher) {
      // R29-36: Only publish events that are registered in TypedEventPayloadMap.
      // UxEventType values (e.g. "ux:button_click") are NOT in TypedEventPayloadMap,
      // so skip publishing for those. The event is still logged to eventLog for internal tracking.
      if (!trackEntry.eventType.startsWith("ux:")) {
        // Cast through unknown to bypass type checking on the payload shape
        (this.eventPublisher.publish as (input: unknown) => void)({
          eventType: trackEntry.eventType,
          sessionId: trackEntry.sessionId,
          taskId: trackEntry.taskId,
          payload: {
            eventId,
            occurredAt,
            userId: payload.userId,
            sessionId: (p.sessionId as string | null) ?? null,
            taskId: (p.taskId as string | null) ?? null,
            abTestGroup: (p.abTestGroup as string | null) ?? null,
            elementId: (p.elementId as string | null) ?? null,
            interactionType: trackEntry.interactionType,
            eventType: trackEntry.eventType,
            metadata: (p.metadata as Record<string, string>) ?? {},
          },
        });
      }
    }

    return trackEntry;
  }

  public getRecentEvents(limit: number = 100): readonly UxEventTrack[] {
    return this.eventLog.slice(-limit);
  }

  public assignABTest(userId: string, config: ABTestConfig = DEFAULT_AB_TEST_CONFIG): ABTestAssignment {
    const existing = this.abTestAssignments.get(userId);
    if (existing && existing.testId === config.testId) {
      return existing;
    }

    const bucket = this.computeBucket(userId, config);
    const variantId = this.selectVariant(bucket, config.variants);
    const assignment: ABTestAssignment = {
      testId: config.testId,
      variantId,
      bucket,
      assignedAt: nowIso(),
    };

    this.abTestAssignments.set(userId, assignment);
    return assignment;
  }

  public getABTestAssignment(userId: string, testId: string): ABTestAssignment | null {
    const assignment = this.abTestAssignments.get(userId);
    if (assignment && assignment.testId === testId) {
      return assignment;
    }
    return null;
  }

  public recordConversion(userId: string, testId: string, goalId: string): void {
    const assignment = this.abTestAssignmentForTest(userId, testId);
    if (!assignment) return;

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

  private computeBucket(userId: string, config: ABTestConfig): number {
    const input = `${userId}:${config.testId}`;
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = ((hash << 5) - hash) + input.charCodeAt(i);
    }
    return Math.abs(hash >>> 0) % 100;
  }

  private selectVariant(bucket: number, variants: readonly { variantId: string; weight: number }[]): string {
    let cumulative = 0;
    for (const variant of variants) {
      cumulative += variant.weight;
      if (bucket < cumulative) {
        return variant.variantId;
      }
    }
    return variants[variants.length - 1]?.variantId ?? "control";
  }

  private abTestAssignmentForTest(userId: string, testId: string): ABTestAssignment | null {
    const assignment = this.abTestAssignments.get(userId);
    if (assignment && assignment.testId === testId) {
      return assignment;
    }
    return null;
  }
}
