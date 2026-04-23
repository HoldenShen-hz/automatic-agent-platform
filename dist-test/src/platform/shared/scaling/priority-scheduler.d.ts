/**
 * @fileoverview Priority Scheduler with Preemption Support
 *
 * Implements §53 "Scale-out resource competition management" - Priority Preemption.
 * Provides 5-level priority classes with preemption policies.
 *
 * @see docs_zh/architecture/00-platform-architecture.md §53.3
 */
/**
 * Priority class names as defined in architecture doc.
 */
export type PriorityClassName = "critical" | "high" | "standard" | "background" | "best_effort";
/**
 * Preemption policy for a priority class.
 */
export type PreemptionPolicy = "never" | "lower_priority" | "any_non_critical";
/**
 * Priority class definition with SLA parameters.
 */
export interface PriorityClass {
    className: PriorityClassName;
    priorityValue: number;
    preemptionPolicy: PreemptionPolicy;
    queueTimeout: string;
    guaranteedStartSla?: string;
}
/**
 * Priority class constants as defined in architecture doc §53.3 table.
 */
export declare const PRIORITY_CLASSES: Record<PriorityClassName, PriorityClass>;
/**
 * Task in the priority queue with scheduling metadata.
 */
export interface QueuedTask {
    taskId: string;
    priorityClass: PriorityClassName;
    priorityValue: number;
    enqueuedAt: number;
    waitedMs: number;
    canBePreempted: boolean;
    requestedResources: {
        maxConcurrentWorkers?: number;
        llmTokensPerMinute?: number;
    };
}
/**
 * Preemption decision result.
 */
export interface PreemptionDecision {
    shouldPreempt: boolean;
    preemptedTaskId?: string;
    reason?: string;
}
/**
 * Determines if a high-priority task can preempt a lower-priority task.
 */
export declare function canPreempt(preemptor: QueuedTask, target: QueuedTask): PreemptionDecision;
/**
 * Finds the best task to preempt to make room for the preemptor.
 */
export declare function findTaskToPreempt(preemptor: QueuedTask, runningTasks: QueuedTask[]): PreemptionDecision;
/**
 * Priority Queue implementation for task scheduling.
 */
export declare class PriorityScheduler {
    private readonly starvationThresholdMs;
    private queue;
    private runningTasks;
    constructor(starvationThresholdMs?: number);
    /**
     * Add a task to the priority queue.
     */
    enqueue(task: Omit<QueuedTask, "priorityValue" | "waitedMs">): void;
    /**
     * Get the next task to execute (considering preemption if needed).
     */
    dequeue(maxWorkers: number): QueuedTask | null;
    /**
     * Mark a task as completed.
     */
    complete(taskId: string): void;
    /**
     * Update wait times for all queued tasks.
     */
    tick(): void;
    /**
     * Get current queue depth by priority class.
     */
    getQueueDepthByPriority(): Record<PriorityClassName, number>;
    /**
     * Get queue statistics.
     */
    getStats(): {
        totalQueued: number;
        totalRunning: number;
        byPriority: Record<PriorityClassName, number>;
        oldestTaskWaitMs: number;
    };
}
/**
 * Parses a timeout string like "30s", "5m", "1h" into milliseconds.
 */
export declare function parseTimeoutToMs(timeout: string): number;
/**
 * Checks if a task has exceeded its queue timeout.
 */
export declare function hasExceededTimeout(task: QueuedTask): boolean;
