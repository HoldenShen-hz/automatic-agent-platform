/**
 * @fileoverview Tool Usage Projection
 *
 * Tracks tool/plugin invocation usage patterns and outcomes.
 * Implements §28 projection requirements:
 * - Idempotency: same event applied twice produces same state
 * - Replay-safety: can be replayed from any point in event stream
 * - event_id deduplication: skip events already processed
 * - Tool usage aggregated per tool and per workflow
 *
 * §28 architecture: tool_usage_projection
 */

import type { ProjectionHandler, ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";

/**
 * Tool Usage Projection State
 *
 * Tracks tool invocation aggregated statistics:
 * - Per-tool success/failure counts
 * - Per-workflow tool usage
 * - Cache hit/miss rates
 * - Retry patterns
 */
export interface ToolUsageState {
  /** Tool/plugin ID */
  toolId: string | null;
  /** Tool name (from skill: events) */
  toolName: string | null;
  /** Current status of the latest invocation */
  status: ToolInvocationStatus | null;
  /** Invocation count */
  invocationCount: number;
  /** Success count */
  successCount: number;
  /** Failure count */
  failureCount: number;
  /** Cache hit count */
  cacheHitCount: number;
  /** Cache miss count */
  cacheMissCount: number;
  /** Total retry count */
  retryCount: number;
  /** Last invocation timestamp */
  lastInvocationAt: string | null;
  /** Last success timestamp */
  lastSuccessAt: string | null;
  /** Last failure timestamp */
  lastFailureAt: string | null;
  /** Last failed step ID */
  lastFailedStepId: string | null;
  /** Timeline of invocations in order */
  timeline: ToolUsageTimelineEntry[];
  /** Count of all events processed */
  eventCount: number;
  /**
   * Set of processed event IDs for idempotency (O(1) lookup).
   * Stored as array for JSON serialization but converted to Set internally.
   */
  processedEventIds: string[];
  /** First event timestamp */
  firstEventAt: string | null;
  /** Last event timestamp */
  lastEventAt: string | null;
  /**
   * Timestamp when this projection was last updated.
   * Used for freshness monitoring and stale projection detection.
   */
  lastProjectedAt: string | null;
  /**
   * Lag in milliseconds between event time and projection update.
   * Computed as: now - lastProjectedAt.
   * Used for freshness monitoring per §28.6.
   */
  lagMs: number | null;
  /**
   * Whether this projection is considered stale.
   * A projection is stale if lagMs exceeds the stale threshold (default: 5 minutes).
   * Used for freshness monitoring per §28.6/§25.5.
   */
  stale: boolean;
  /** Associated task ID */
  taskId: string | null;
  /** Associated session ID */
  sessionId: string | null;
  /** Associated execution ID */
  executionId: string | null;
}

/**
 * Internal state with Set for O(1) idempotency checks.
 */
interface ToolUsageStateInternal extends Omit<ToolUsageState, "processedEventIds"> {
  _processedEventIdSet: Set<string>;
}

export type ToolInvocationStatus = "started" | "completed" | "failed" | "retrying" | "cache_hit" | "cache_miss";

/**
 * Timeline entry for tool invocations
 */
export interface ToolUsageTimelineEntry {
  eventId: string;
  eventType: string;
  timestamp: string;
  stepId: string | null;
  status: ToolInvocationStatus | null;
  durationMs: number | null;
  errorCode: string | null;
}

/**
 * Creates a new empty ToolUsageState
 */
export function createEmptyToolUsageState(): ToolUsageState {
  return {
    toolId: null,
    toolName: null,
    status: null,
    invocationCount: 0,
    successCount: 0,
    failureCount: 0,
    cacheHitCount: 0,
    cacheMissCount: 0,
    retryCount: 0,
    lastInvocationAt: null,
    lastSuccessAt: null,
    lastFailureAt: null,
    lastFailedStepId: null,
    timeline: [],
    eventCount: 0,
    processedEventIds: [],
    firstEventAt: null,
    lastEventAt: null,
    lastProjectedAt: null,
    lagMs: null,
    stale: false,
    taskId: null,
    sessionId: null,
    executionId: null,
  };
}

/**
 * Converts serialized state (with array) to internal state (with Set for O(1) lookup).
 */
function toInternalState(state: ToolUsageState): ToolUsageStateInternal {
  return {
    ...state,
    _processedEventIdSet: new Set(state.processedEventIds),
  };
}

/**
 * Converts internal state (with Set) back to serialized state (with array for JSON).
 */
function toSerializedState(state: ToolUsageStateInternal): ToolUsageState {
  return {
    ...state,
    processedEventIds: Array.from(state._processedEventIdSet),
  };
}

/**
 * Parses JSON payload safely
 */
function parsePayload(payloadJson: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payloadJson);
    return typeof parsed === "object" && parsed !== null
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

/**
 * Checks if an event has already been processed (idempotency check).
 * Uses O(1) Set lookup for efficiency.
 */
function isEventProcessed(state: ToolUsageStateInternal, eventId: string): boolean {
  return state._processedEventIdSet.has(eventId);
}

/**
 * Tool Usage Projection Handler
 *
 * Implements ProjectionHandler interface for tool usage tracking.
 * Handles events:
 * - plugin:invocation_started - Tool invocation started
 * - plugin:invocation_completed - Tool invocation completed
 * - skill:execution_started - Skill execution started
 * - skill:step_started - Skill step started
 * - skill:step_succeeded - Skill step succeeded
 * - skill:step_failed - Skill step failed
 * - skill:retry_scheduled - Retry scheduled
 * - skill:cache_miss - Cache miss
 * - skill:cache_hit - Cache hit
 *
 * @param state - Current projection state (null for first event)
 * @param event - Input event to apply
 * @returns Updated projection state
 */
export const toolUsageProjectionHandler: ProjectionHandler = (
  state: Record<string, unknown> | null,
  event: ProjectionInputEvent,
): Record<string, unknown> => {
  // Initialize state if null, convert to internal state with Set for O(1) lookup
  const currentState = state as unknown as ToolUsageState | null;
  const baseState = currentState ? { ...currentState } : createEmptyToolUsageState();
  const newState = toInternalState(baseState);

  // Idempotency check - skip already processed events
  if (isEventProcessed(newState, event.eventId)) {
    return toSerializedState(newState) as unknown as Record<string, unknown>;
  }

  // Parse payload
  const payload = parsePayload(event.payloadJson);

  // Update IDs if not set
  if (newState.toolId === null) {
    newState.toolId = (payload.pluginId as string | undefined) ?? (payload.skillId as string | undefined) ?? null;
  }
  if (newState.toolName === null) {
    newState.toolName = (payload.toolName as string | undefined) ?? null;
  }
  if (newState.taskId === null && event.taskId !== null) {
    newState.taskId = event.taskId;
  }
  if (newState.sessionId === null) {
    newState.sessionId = event.taskId; // Use taskId as session proxy if no session
  }
  if (newState.executionId === null) {
    newState.executionId = (payload.executionId as string | null | undefined) ?? null;
  }

  // Update timestamps
  if (newState.firstEventAt === null) {
    newState.firstEventAt = event.createdAt;
  }
  newState.lastEventAt = event.createdAt;
  newState.lastProjectedAt = event.createdAt;
  // Compute lagMs and stale flag per §28.6/§25.5
  if (event.createdAt) {
    const eventTime = new Date(event.createdAt).getTime();
    const now = Date.now();
    newState.lagMs = now - eventTime;
    newState.stale = newState.lagMs > 300000;
  }

  const stepId = (payload.stepId as string | null | undefined) ?? null;
  const status = (payload.status as ToolInvocationStatus | undefined) ?? inferStatus(event.eventType);
  const durationMs = (payload.durationMs as number | undefined) ?? null;
  const errorCode = (payload.errorCode as string | null | undefined) ?? null;

  // Add to timeline
  const timelineEntry: ToolUsageTimelineEntry = {
    eventId: event.eventId,
    eventType: event.eventType,
    timestamp: event.createdAt,
    stepId,
    status,
    durationMs,
    errorCode,
  };
  newState.timeline = [...newState.timeline, timelineEntry];

  // Mark event as processed using O(1) Set add
  newState._processedEventIdSet.add(event.eventId);
  newState.eventCount = newState.eventCount + 1;

  // Update counters based on event type
  switch (event.eventType) {
    case "plugin:invocation_started":
    case "skill:execution_started":
    case "skill:step_started":
      newState.invocationCount++;
      newState.lastInvocationAt = event.createdAt;
      newState.status = "started";
      break;

    case "plugin:invocation_completed":
      if (status === "completed") {
        newState.successCount++;
        newState.lastSuccessAt = event.createdAt;
      }
      newState.lastInvocationAt = event.createdAt;
      break;

    case "skill:step_succeeded":
      newState.successCount++;
      newState.lastInvocationAt = event.createdAt;
      newState.lastSuccessAt = event.createdAt;
      newState.status = "completed";
      break;

    case "skill:step_failed":
      newState.failureCount++;
      newState.lastInvocationAt = event.createdAt;
      newState.lastFailureAt = event.createdAt;
      newState.lastFailedStepId = stepId ?? newState.lastFailedStepId;
      newState.status = "failed";
      break;

    case "skill:retry_scheduled":
      newState.retryCount++;
      newState.status = "retrying";
      break;

    case "skill:cache_miss":
      newState.cacheMissCount++;
      newState.status = "cache_miss";
      break;

    case "skill:cache_hit":
      newState.cacheHitCount++;
      newState.status = "cache_hit";
      break;

    default:
      break;
  }

  return newState as unknown as Record<string, unknown>;
};

/**
 * Infers invocation status from event type
 */
function inferStatus(eventType: string): ToolInvocationStatus | null {
  if (eventType.includes("started")) return "started";
  if (eventType.includes("succeeded") || eventType.includes("completed")) return "completed";
  if (eventType.includes("failed")) return "failed";
  if (eventType.includes("retry")) return "retrying";
  if (eventType.includes("cache_hit")) return "cache_hit";
  if (eventType.includes("cache_miss")) return "cache_miss";
  return null;
}

/**
 * Creates a ToolUsageProjection instance for use with ProjectionRebuildService
 */
export function createToolUsageProjectionHandler(): ProjectionHandler {
  return toolUsageProjectionHandler;
}

// Re-export types for external use
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
