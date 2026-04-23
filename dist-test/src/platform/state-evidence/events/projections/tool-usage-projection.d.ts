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
import type { ProjectionHandler } from "../../projections/projection-rebuild-service.js";
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
    /** Set of processed event IDs for idempotency */
    processedEventIds: string[];
    /** First event timestamp */
    firstEventAt: string | null;
    /** Last event timestamp */
    lastEventAt: string | null;
    /** Associated task ID */
    taskId: string | null;
    /** Associated session ID */
    sessionId: string | null;
    /** Associated execution ID */
    executionId: string | null;
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
export declare function createEmptyToolUsageState(): ToolUsageState;
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
export declare const toolUsageProjectionHandler: ProjectionHandler;
/**
 * Creates a ToolUsageProjection instance for use with ProjectionRebuildService
 */
export declare function createToolUsageProjectionHandler(): ProjectionHandler;
export type { ProjectionInputEvent } from "../../projections/projection-rebuild-service.js";
