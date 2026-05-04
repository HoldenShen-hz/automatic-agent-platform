/**
 * @fileoverview UX Event Tracking Service
 *
 * Provides A/B testing support for UX flows and user interaction event tracking.
 * Uses traffic routing (traffic-routing-service) for A/B test assignment and
 * publishes interaction events to the event bus for analytics.
 *
 * §44 UX Workflow - A/B Testing Framework + User Event Tracking
 *
 * Event Taxonomy (per §5.4 standard event taxonomy):
 * - All UX events use canonical platform.ux.* namespace
 * - Internal UxEventType maps to platform.ux.* event types
 */

import { TypedEventBusPublisher, type TypedEventPublisher } from "../../platform/state-evidence/events/typed-event-publisher.js";
import type { TypedEventType } from "../../platform/state-evidence/events/typed-event-bus.js";
import { newId, nowIso } from "../../platform/contracts/types/ids.js";

// Canonical UX event types using platform.ux.* namespace per §5.4
export type PlatformUxEventType =
  | "platform.ux.button_click"
  | "platform.ux.form_submit"
  | "platform.ux.navigation"
  | "platform.ux.wizard_step"
  | "platform.ux.workflow_build"
  | "platform.ux.dashboard_view"
  | "platform.ux.search_query"
  | "platform.ux.filter_apply"
  | "platform.ux.export_action"
  | "platform.ux.share_action"
  | "platform.ux.onboarding_complete"
  | "platform.ux.feedback_submit";

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

// Mapping from internal UxEventType to canonical platform.ux.* event types
const UX_TO_PLATFORM_EVENT_MAP: Record<UxEventType, PlatformUxEventType> = {
  "ux:button_click": "platform.ux.button_click",
  "ux:form_submit": "platform.ux.form_submit",
  "ux:navigation": "platform.ux.navigation",
  "ux:wizard_step": "platform.ux.wizard_step",
  "ux:workflow_build": "platform.ux.workflow_build",
  "ux:dashboard_view": "platform.ux.dashboard_view",
  "ux:search_query": "platform.ux.search_query",
  "ux:filter_apply": "platform.ux.filter_apply",
  "ux:export_action": "platform.ux.export_action",
  "ux:share_action": "platform.ux.share_action",
  "ux:onboarding_complete": "platform.ux.onboarding_complete",
  "ux:feedback_submit": "platform.ux.feedback_submit",
};

export class UxEventTrackingService {
  private readonly eventPublisher: TypedEventPublisher | null;
  private readonly abTestAssignments = new Map<string, ABTestAssignment>();
  // R29-35 FIX: Add bounded eventLog with eviction to prevent memory leaks.
  // Root cause: eventLog array grew unbounded - in long-running processes this caused
  // memory exhaustion as events were only added but never removed.
  // Fix: Maintain maximum event log size with FIFO eviction of oldest entries.
  private readonly eventLog: UxEventTrack[] = [];
  private static readonly MAX_EVENT_LOG_SIZE = 10000;

  public constructor(eventPublisher?: TypedEventPublisher) {
    this.eventPublisher = eventPublisher ?? null;
  }

  /**
   * Maps internal UxEventType to canonical platform.ux.* event type per §5.4
   */
  private toPlatformEventType(eventType: UxEventType): PlatformUxEventType {
    return UX_TO_PLATFORM_EVENT_MAP[eventType] ?? "platform.ux.button_click";
  }

  public trackEvent<T extends UxEventType>(
    eventType: T,
    payload: { userId: string; sessionId?: string | null; taskId?: string | null; abTestGroup?: string | null; metadata?: Record<string, string>; [key: string]: unknown },
  ): UxEventTrack {
    const eventId = newId("uxevt");
    const occurredAt = nowIso();
    const trackEntry: UxEventTrack = {
      eventId,
      eventType,
      userId: payload.userId,
      sessionId: payload.sessionId ?? null,
      taskId: payload.taskId ?? null,
      abTestGroup: payload.abTestGroup ?? null,
      elementId: (payload.elementId as string | null) ?? null,
      interactionType: (payload.interactionType as UxEventTrack["interactionType"]) ?? "click",
      metadata: payload.metadata ?? {},
      occurredAt,
    };

    this.eventLog.push(trackEntry);
    // Evict oldest entries if log exceeds maximum size to prevent memory leak
    if (this.eventLog.length > UxEventTrackingService.MAX_EVENT_LOG_SIZE) {
      this.eventLog.splice(0, this.eventLog.length - UxEventTrackingService.MAX_EVENT_LOG_SIZE);
    }

    if (this.eventPublisher) {
      // Use canonical platform.ux.* event type per §5.4
      const platformEventType = this.toPlatformEventType(eventType);
      this.eventPublisher.publish({
        eventType: platformEventType as TypedEventType,
        sessionId: trackEntry.sessionId,
        taskId: trackEntry.taskId,
        payload: {
          eventId,
          occurredAt,
          userId: payload.userId,
          sessionId: payload.sessionId ?? null,
          taskId: payload.taskId ?? null,
          abTestGroup: payload.abTestGroup ?? null,
          elementId: (payload.elementId as string | null) ?? null,
          interactionType: trackEntry.interactionType,
          eventType: trackEntry.eventType,
          metadata: payload.metadata ?? {},
        },
      });
    }

    return trackEntry;
  }

  public getRecentEvents(limit: number = 100): readonly UxEventTrack[] {
    return this.eventLog.slice(-limit);
  }

  public assignABTest(userId: string, config: ABTestConfig = DEFAULT_AB_TEST_CONFIG): ABTestAssignment {
    // §44: Use composite key userId:testId to support multiple parallel A/B tests
    const key = `${userId}:${config.testId}`;
    const existing = this.abTestAssignments.get(key);
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

    this.abTestAssignments.set(key, assignment);
    return assignment;
  }

  public getABTestAssignment(userId: string, testId: string): ABTestAssignment | null {
    // §44: Use composite key to support multiple parallel A/B tests
    const key = `${userId}:${testId}`;
    const assignment = this.abTestAssignments.get(key);
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
    // §44: Use composite key to support multiple parallel A/B tests
    const key = `${userId}:${testId}`;
    const assignment = this.abTestAssignments.get(key);
    if (assignment && assignment.testId === testId) {
      return assignment;
    }
    return null;
  }
}
