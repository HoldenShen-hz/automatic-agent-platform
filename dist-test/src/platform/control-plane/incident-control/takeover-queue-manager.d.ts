/**
 * Takeover Queue Manager
 *
 * Manages the pending request queue for async takeover processing.
 * Provides priority-based queue operations with FIFO semantics per priority level.
 */
import type { TakeoverRequestEntry, TakeoverRequestPayload, AsyncTakeoverActionType, TakeoverLifecycleEvent, TakeoverEventPayload } from "./human-takeover-service-async.js";
/**
 * Configuration for queue behavior.
 */
export interface TakeoverQueueConfig {
    maxQueueDepth: number;
    defaultPriority: number;
}
/**
 * Emitter interface for lifecycle events.
 */
interface TakeoverEventEmitter {
    emit<T extends TakeoverLifecycleEvent>(event: T, payload: TakeoverEventPayload[T]): void;
}
/**
 * Manages the priority queue for takeover requests.
 *
 * Responsibilities:
 * - Enqueue requests with priority ordering
 * - Cancel pending requests
 * - Query queue depth and contents
 * - Evict expired entries to prevent memory leaks
 */
export declare class TakeoverQueueManager {
    private readonly config;
    private readonly eventEmitter;
    private readonly pendingQueue;
    private readonly logger;
    private readonly MAX_SESSION_ENTRIES;
    private readonly SESSION_TTL_MS;
    private lastEvictionTime;
    private readonly EVICTION_INTERVAL_MS;
    constructor(config: TakeoverQueueConfig, eventEmitter: TakeoverEventEmitter);
    /**
     * Enqueues a takeover request for async processing.
     * Returns the request ID for tracking.
     */
    enqueue(request: {
        taskId: string;
        operatorId: string;
        reasonCode: string;
        actionType: AsyncTakeoverActionType;
        payload: TakeoverRequestPayload;
        priority?: number;
    }): TakeoverRequestEntry;
    /**
     * Gets the current depth of the pending queue.
     */
    getQueueDepth(): number;
    /**
     * Gets all pending requests without removing them.
     */
    getPendingRequests(): TakeoverRequestEntry[];
    /**
     * Finds a pending request by requestId.
     */
    findPending(requestId: string): TakeoverRequestEntry | undefined;
    /**
     * Finds the next pending request.
     */
    findNextPending(): TakeoverRequestEntry | undefined;
    /**
     * Cancels a pending request by requestId.
     * Returns true if the request was found and cancelled.
     */
    cancel(requestId: string): boolean;
    /**
     * Removes a completed/failed entry from the queue.
     */
    removeEntry(requestId: string): void;
    /**
     * C-11: Evict expired session entries to prevent memory leaks.
     */
    evictExpiredSessionEntries(): void;
}
export {};
