/**
 * Scheduler queue contracts shared by interface-level queue APIs and tests.
 *
 * This module remains the canonical type surface for queue payloads and
 * scheduler metadata; workflow sleep/runtime scheduling implementations are
 * exported separately from the scheduler barrel.
 */

export interface TaskQueueConfig {
  queueName: string;
  maxSize: number;
  priorityLevels?: number;
  timeout?: number;
  retryPolicy?: RetryPolicy;
}

export interface TaskQueueItem {
  taskId: string;
  priority: number;
  enqueuedAt: string;
  payload: Record<string, unknown>;
}

export interface TaskQueuePartition {
  partitionId: string;
  queueName: string;
  workerId: string;
  currentLoad: number;
  maxLoad: number;
}

export interface TaskSchedulerConfig {
  schedulerId: string;
  numPartitions: number;
  strategy: "round-robin" | "least-loaded" | "random" | "priority";
  enabled: boolean;
}

export interface QueueMetrics {
  queueName: string;
  depth: number;
  enqueuedPerMinute: number;
  dequeuedPerMinute: number;
  averageWaitTimeMs: number;
}

export interface PartitionAssignment {
  partitionId: string;
  assignedTo: string;
  assignedAt: string;
  expiresAt: string;
}

export interface RetryPolicy {
  maxAttempts: number;
  backoffMs: number;
  backoffMultiplier?: number;
  maxBackoffMs?: number;
  jitter?: boolean;
}

export interface TaskDequeueResult {
  taskId: string;
  partitionId: string;
  dequeuedAt: string;
  waitTimeMs: number;
}

export * from "./index.js";
