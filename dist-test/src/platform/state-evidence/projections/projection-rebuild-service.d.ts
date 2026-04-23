/**
 * Projection Rebuild Service
 *
 * Implements §25.4 "Projection must be rebuildable" requirement.
 * Provides full projection rebuild from event store with idempotent replay.
 *
 * ## Requirements per §25.4
 *
 * All projections must be:
 * - idempotent: applying the same event twice produces the same result
 * - replay-safe: can be replayed from any point in the event stream
 * - event_id deduplication: skip events already processed
 * - support rebuild: can rebuild from scratch
 * - do not reflect truth: projections are derived views, not the source of truth
 *
 * @see docs_zh/architecture/00-platform-architecture.md §25.4
 */
import type { EventRepository } from "../truth/sqlite/repositories/event-repository.js";
/**
 * Projection handler function type.
 * Takes the current state and an event, returns the updated state.
 */
export type ProjectionHandler = (state: Record<string, unknown> | null, event: ProjectionInputEvent) => Record<string, unknown>;
/**
 * Input event for projection handlers
 */
export interface ProjectionInputEvent {
    eventId: string;
    eventType: string;
    taskId: string | null;
    payloadJson: string;
    createdAt: string;
}
/**
 * Projection rebuild options
 */
export interface ProjectionRebuildOptions {
    /** Maximum number of events to process in a single batch */
    batchSize?: number;
    /** Whether to use parallelism by projection name */
    parallelByProjection?: boolean;
    /** Optional filter for event types to process */
    eventTypeFilter?: readonly string[];
    /** Optional filter for time range */
    fromTimestamp?: string;
}
/**
 * Projection rebuild result
 */
export interface ProjectionRebuildResult {
    /** Total events processed */
    eventsProcessed: number;
    /** Projections updated */
    projectionsUpdated: number;
    /** Events skipped (already processed) */
    eventsSkipped: number;
    /** Processing time in ms */
    durationMs: number;
    /** Errors encountered */
    errors: readonly string[];
}
/**
 * Registry of projection handlers by projection name
 */
export declare class ProjectionHandlerRegistry {
    private readonly handlers;
    /**
     * Register a projection handler
     */
    register(projectionName: string, handler: ProjectionHandler): void;
    /**
     * Get a handler by projection name
     */
    get(projectionName: string): ProjectionHandler | undefined;
    /**
     * List all registered projection names
     */
    listProjectionNames(): string[];
}
/**
 * Projection Rebuild Service
 *
 * Provides full projection rebuild functionality from event store.
 * Supports idempotent replay with event deduplication.
 */
export declare class ProjectionRebuildService {
    private readonly eventRepository;
    private readonly registry;
    constructor(eventRepository: EventRepository);
    /**
     * Register the default projection handlers
     */
    private registerDefaultHandlers;
    /**
     * Register a custom projection handler
     */
    registerHandler(projectionName: string, handler: ProjectionHandler): void;
    /**
     * Rebuild a specific projection from scratch
     */
    rebuildProjection(projectionName: string, options?: ProjectionRebuildOptions): ProjectionRebuildResult;
    /**
     * Rebuild all registered projections
     */
    rebuildAll(options?: ProjectionRebuildOptions): Map<string, ProjectionRebuildResult>;
    /**
     * Fetch events from the event repository
     */
    private fetchEvents;
    /**
     * Convert EventRecord to ProjectionInputEvent
     */
    private toProjectionInputEvent;
    /**
     * TaskSummary projection handler
     */
    private taskSummaryHandler;
    /**
     * WorkflowSummary projection handler
     */
    private workflowSummaryHandler;
    /**
     * ApprovalSummary projection handler
     */
    private approvalSummaryHandler;
    /**
     * IncidentSummary projection handler
     */
    private incidentSummaryHandler;
    /**
     * Generic event summary projection handler
     */
    private eventSummaryHandler;
    /**
     * §28: CostDashboard projection handler
     * Tracks cost budgets and actuals across the platform
     */
    private costDashboardHandler;
    /**
     * §28: DelegationTree projection handler
     * Tracks task delegation hierarchy across agents
     */
    private delegationTreeHandler;
    /**
     * Safely parse JSON payload
     */
    private parsePayload;
}
