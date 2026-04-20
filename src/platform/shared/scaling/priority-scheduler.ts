/**
 * @fileoverview Priority Scheduler with Preemption Support
 *
 * Implements §53 "规模化资源竞争管理" - Priority Preemption.
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
  priorityValue: number; // 0-1000
  preemptionPolicy: PreemptionPolicy;
  queueTimeout: string; // Duration string like "30m", "1h"
  guaranteedStartSla?: string;
}

/**
 * Priority class constants as defined in architecture doc §53.3 table.
 */
export const PRIORITY_CLASSES: Record<PriorityClassName, PriorityClass> = {
  critical: {
    className: "critical",
    priorityValue: 1000,
    preemptionPolicy: "any_non_critical",
    queueTimeout: "10s",
    guaranteedStartSla: "< 10s",
  },
  high: {
    className: "high",
    priorityValue: 800,
    preemptionPolicy: "lower_priority",
    queueTimeout: "30s",
    guaranteedStartSla: "< 30s",
  },
  standard: {
    className: "standard",
    priorityValue: 500,
    preemptionPolicy: "never",
    queueTimeout: "5m",
    guaranteedStartSla: "< 5min",
  },
  background: {
    className: "background",
    priorityValue: 200,
    preemptionPolicy: "never",
    queueTimeout: "1h",
    guaranteedStartSla: "best_effort",
  },
best_effort: {
    className: "best_effort",
    priorityValue: 0,
    preemptionPolicy: "never",
    queueTimeout: "∞",
  },
};

/**
 * Task in the priority queue with scheduling metadata.
 */
export interface QueuedTask {
  taskId: string;
  priorityClass: PriorityClassName;
  priorityValue: number;
  enqueuedAt: number; // timestamp
  waitedMs: number; // current wait time
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
export function canPreempt(
  preemptor: QueuedTask,
  target: QueuedTask,
): PreemptionDecision {
  const preemptorClass = PRIORITY_CLASSES[preemptor.priorityClass];
  const targetClass = PRIORITY_CLASSES[target.priorityClass];

  // Check if preemptor has a preemption capability
  if (preemptorClass.preemptionPolicy === "never") {
    return { shouldPreempt: false, reason: "Preemptor has preemption_policy=never" };
  }

  // Target with never policy cannot be preempted
  if (targetClass.preemptionPolicy === "never") {
    return { shouldPreempt: false, reason: "Target task has preemption_policy=never" };
  }

  // Cannot preempt critical tasks
  if (target.priorityClass === "critical") {
    return { shouldPreempt: false, reason: "Cannot preempt critical tasks" };
  }

  // any_non_critical can preempt any non-critical target
  if (preemptorClass.preemptionPolicy === "any_non_critical") {
    return { shouldPreempt: true, preemptedTaskId: target.taskId, reason: "Critical can preempt any non-critical" };
  }

  // lower_priority can preempt lower priority targets
  if (preemptorClass.preemptionPolicy === "lower_priority") {
    if (target.priorityValue < preemptor.priorityValue) {
      return { shouldPreempt: true, preemptedTaskId: target.taskId, reason: `Higher priority (${preemptor.priorityValue}) vs lower (${target.priorityValue})` };
    }
    return { shouldPreempt: false, reason: "Target priority is not lower" };
  }

  return { shouldPreempt: false, reason: "No preemption policy match" };
}

/**
 * Finds the best task to preempt to make room for the preemptor.
 */
export function findTaskToPreempt(
  preemptor: QueuedTask,
  runningTasks: QueuedTask[],
): PreemptionDecision {
  // Filter tasks that can actually be preempted
  const preemptable = runningTasks.filter((t) => t.canBePreempted);

  // Sort by priority (lowest first) then by wait time (longest first)
  preemptable.sort((a, b) => {
    if (a.priorityValue !== b.priorityValue) {
      return a.priorityValue - b.priorityValue;
    }
    return b.waitedMs - a.waitedMs; // Older tasks first
  });

  for (const target of preemptable) {
    const decision = canPreempt(preemptor, target);
    if (decision.shouldPreempt) {
      return decision;
    }
  }

  return { shouldPreempt: false, reason: "No preemptable task found" };
}

/**
 * Priority Queue implementation for task scheduling.
 */
export class PriorityScheduler {
  private queue: QueuedTask[] = [];
  private runningTasks: Map<string, QueuedTask> = new Map();

  constructor(private readonly starvationThresholdMs: number = 30 * 60 * 1000) {} // 30 minutes default

  /**
   * Add a task to the priority queue.
   */
  enqueue(task: Omit<QueuedTask, "priorityValue" | "waitedMs">): void {
    const priorityClass = PRIORITY_CLASSES[task.priorityClass];
    const queuedTask: QueuedTask = {
      ...task,
      priorityValue: priorityClass.priorityValue,
      waitedMs: 0,
    };
    this.queue.push(queuedTask);
    this.queue.sort((a, b) => {
      // Higher priority first, then older first
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  /**
   * Get the next task to execute (considering preemption if needed).
   */
  dequeue(maxWorkers: number): QueuedTask | null {
    if (this.queue.length === 0) {
      return null;
    }

    // Check if we can start without preemption
    if (this.runningTasks.size < maxWorkers) {
      const task = this.queue.shift()!;
      this.runningTasks.set(task.taskId, task);
      return task;
    }

    // Need to consider preemption
    const highestPriority = this.queue[0]!;
    const decision = findTaskToPreempt(highestPriority, [...this.runningTasks.values()]);

    if (decision.shouldPreempt && decision.preemptedTaskId) {
      // Preempt the lower priority task
      const preempted = this.runningTasks.get(decision.preemptedTaskId);
      this.runningTasks.delete(decision.preemptedTaskId);

      // Re-queue the preempted task with updated wait time
      if (preempted) {
        preempted.waitedMs = Date.now() - preempted.enqueuedAt;
        // Re-insert into queue (it will be re-sorted)
        this.queue.unshift(preempted);
      }

      // Start the high priority task
      const task = this.queue.shift()!;
      this.runningTasks.set(task.taskId, task);
      return task;
    }

    return null;
  }

  /**
   * Mark a task as completed.
   */
  complete(taskId: string): void {
    this.runningTasks.delete(taskId);
    this.queue = this.queue.filter((t) => t.taskId !== taskId);
  }

  /**
   * Update wait times for all queued tasks.
   */
  tick(): void {
    const now = Date.now();
    for (const task of this.queue) {
      task.waitedMs = now - task.enqueuedAt;
    }

    // Check for starvation - upgrade if waiting too long
    for (const task of this.queue) {
      if (
        task.waitedMs > this.starvationThresholdMs
        && task.priorityClass !== "critical"
        && task.priorityClass !== "high"
      ) {
        // Starvation prevention: task waiting > 30min gets upgraded
        task.priorityClass = "high";
        task.priorityValue = PRIORITY_CLASSES.high.priorityValue;
      }
    }

    // Re-sort after priority updates
    this.queue.sort((a, b) => {
      if (a.priorityValue !== b.priorityValue) {
        return b.priorityValue - a.priorityValue;
      }
      return a.enqueuedAt - b.enqueuedAt;
    });
  }

  /**
   * Get current queue depth by priority class.
   */
  getQueueDepthByPriority(): Record<PriorityClassName, number> {
    const counts: Record<PriorityClassName, number> = {
      critical: 0,
      high: 0,
      standard: 0,
      background: 0,
      best_effort: 0,
    };
    for (const task of this.queue) {
      counts[task.priorityClass]++;
    }
    return counts;
  }

  /**
   * Get queue statistics.
   */
  getStats(): {
    totalQueued: number;
    totalRunning: number;
    byPriority: Record<PriorityClassName, number>;
    oldestTaskWaitMs: number;
  } {
    return {
      totalQueued: this.queue.length,
      totalRunning: this.runningTasks.size,
      byPriority: this.getQueueDepthByPriority(),
      oldestTaskWaitMs: this.queue.length > 0 ? Date.now() - this.queue[0]!.enqueuedAt : 0,
    };
  }
}

/**
 * Parses a timeout string like "30s", "5m", "1h" into milliseconds.
 */
export function parseTimeoutToMs(timeout: string): number {
  const match = /^(\d+)(s|m|h|d)$/.exec(timeout);
  if (!match) {
    return Infinity;
  }
  const value = parseInt(match[1]!, 10);
  switch (match[2]) {
    case "s": return value * 1000;
    case "m": return value * 60 * 1000;
    case "h": return value * 60 * 60 * 1000;
    case "d": return value * 24 * 60 * 60 * 1000;
    default: return Infinity;
  }
}

/**
 * Checks if a task has exceeded its queue timeout.
 */
export function hasExceededTimeout(task: QueuedTask): boolean {
  const timeoutMs = parseTimeoutToMs(PRIORITY_CLASSES[task.priorityClass].queueTimeout);
  return timeoutMs !== Infinity && task.waitedMs > timeoutMs;
}
