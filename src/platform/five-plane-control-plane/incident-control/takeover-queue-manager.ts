/**
 * Takeover Queue Manager
 *
 * Manages the pending request queue for async takeover processing.
 * Provides priority-based queue operations with FIFO semantics per priority level.
 */

import { newId, nowIso } from "../../contracts/types/ids.js";
import { StorageError } from "../../contracts/errors.js";
import { StructuredLogger } from "../../shared/observability/structured-logger.js";
import type {
  TakeoverRequestEntry,
  TakeoverRequestPayload,
  AsyncTakeoverActionType,
  TakeoverLifecycleEvent,
  TakeoverEventPayload,
} from "./human-takeover-service-async.js";

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
export class TakeoverQueueManager {
  private readonly pendingQueue: TakeoverRequestEntry[] = [];
  private readonly logger = new StructuredLogger({ retentionLimit: 100 });

  // C-11: TTL-based eviction to prevent memory leaks
  private readonly MAX_SESSION_ENTRIES = 500;
  private readonly SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
  private lastEvictionTime = 0;
  private readonly EVICTION_INTERVAL_MS = 60 * 1000; // Once per minute

  public constructor(
    private readonly config: TakeoverQueueConfig,
    private readonly eventEmitter: TakeoverEventEmitter,
  ) {}

  /**
   * Enqueues a takeover request for async processing.
   * Returns the request ID for tracking.
   */
  public enqueue(request: {
    taskId: string;
    operatorId: string;
    reasonCode: string;
    actionType: AsyncTakeoverActionType;
    payload: TakeoverRequestPayload;
    priority?: number;
  }): TakeoverRequestEntry {
    if (this.pendingQueue.length >= this.config.maxQueueDepth) {
      throw new StorageError(
        "takeover.queue_full",
        "Takeover request queue is full",
        { statusCode: 503, retryable: true, details: { maxQueueDepth: this.config.maxQueueDepth } },
      );
    }

    const requestId = newId("tkrq");
    const entry: TakeoverRequestEntry = {
      requestId,
      taskId: request.taskId,
      operatorId: request.operatorId,
      reasonCode: request.reasonCode,
      actionType: request.actionType,
      enqueuedAt: nowIso(),
      priority: request.priority ?? this.config.defaultPriority,
      payload: request.payload,
      status: "pending",
      attempts: 0,
    };

    // Insert sorted by priority
    const insertIndex = this.pendingQueue.findIndex((e) => e.priority > entry.priority);
    if (insertIndex === -1) {
      this.pendingQueue.push(entry);
    } else {
      this.pendingQueue.splice(insertIndex, 0, entry);
    }

    this.eventEmitter.emit("takeover:request_enqueued", {
      requestId: entry.requestId,
      taskId: entry.taskId,
      actionType: entry.actionType,
      priority: entry.priority,
    });

    this.logger.log({
      level: "debug",
      message: "takeover.request_enqueued",
      data: { requestId, taskId: request.taskId, actionType: request.actionType },
    });

    return entry;
  }

  /**
   * Gets the current depth of the pending queue.
   */
  public getQueueDepth(): number {
    return this.pendingQueue.length;
  }

  /**
   * Gets all pending requests without removing them.
   */
  public getPendingRequests(): TakeoverRequestEntry[] {
    return [...this.pendingQueue];
  }

  /**
   * Finds a pending request by requestId.
   */
  public findPending(requestId: string): TakeoverRequestEntry | undefined {
    return this.pendingQueue.find((e) => e.requestId === requestId);
  }

  /**
   * Finds the next pending request.
   */
  public findNextPending(): TakeoverRequestEntry | undefined {
    return this.pendingQueue.find((e) => e.status === "pending");
  }

  /**
   * Cancels a pending request by requestId.
   * Returns true if the request was found and cancelled.
   */
  public cancel(requestId: string): boolean {
    const entry = this.pendingQueue.find((e) => e.requestId === requestId);
    if (!entry || entry.status !== "pending") return false;

    entry.status = "cancelled";
    const idx = this.pendingQueue.indexOf(entry);
    if (idx !== -1) this.pendingQueue.splice(idx, 1);

    this.logger.log({
      level: "info",
      message: "takeover.request_cancelled",
      data: { requestId, taskId: entry.taskId },
    });

    return true;
  }

  /**
   * Removes a completed/failed entry from the queue.
   */
  public removeEntry(requestId: string): void {
    const idx = this.pendingQueue.findIndex((e) => e.requestId === requestId);
    if (idx !== -1) {
      this.pendingQueue.splice(idx, 1);
    }
  }

  /**
   * C-11: Evict expired session entries to prevent memory leaks.
   */
  public evictExpiredSessionEntries(): void {
    const now = Date.now();
    if (now - this.lastEvictionTime < this.EVICTION_INTERVAL_MS) {
      return;
    }
    this.lastEvictionTime = now;

    const expiryThreshold = now - this.SESSION_TTL_MS;
    const entriesToDelete: string[] = [];

    // Find expired entries (check acknowledgedAt for expiry)
    for (const entry of this.pendingQueue) {
      if (entry.status === "completed" || entry.status === "failed" || entry.status === "cancelled") {
        const enqueuedTime = new Date(entry.enqueuedAt).getTime();
        if (enqueuedTime < expiryThreshold) {
          entriesToDelete.push(entry.requestId);
        }
      }
    }

    for (const requestId of entriesToDelete) {
      this.removeEntry(requestId);
    }

    // If still over capacity, remove oldest entries
    if (this.pendingQueue.length > this.MAX_SESSION_ENTRIES) {
      const sortedEntries = [...this.pendingQueue.entries()].sort((a, b) => {
        const aTime = new Date(a[1]!.enqueuedAt).getTime();
        const bTime = new Date(b[1]!.enqueuedAt).getTime();
        return aTime - bTime;
      });

      const toRemove = this.pendingQueue.length - this.MAX_SESSION_ENTRIES;
      for (let i = 0; i < toRemove; i++) {
        this.removeEntry(sortedEntries[i]![1]!.requestId);
      }
    }
  }
}
