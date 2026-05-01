/**
 * @fileoverview Horizontal Scaling Controller
 *
 * Implements §8 "Scalability" - automatic scaling strategy.
 * Monitors queue depth and worker utilization to trigger HPA events.
 *
 * Scaling triggers:
 * - Queue backlog > threshold → scale out workers
 * - Worker utilization > 80% → scale out
 * - Queue depth < threshold × 0.3 → scale in
 * - Worker utilization < 30% → scale in
 */

import type { QueueStats } from "../../execution/queue/queue-adapter-types.js";

export type ScalingDirection = "out" | "in" | "none";

export interface ScalingMetric {
  name: string;
  current: number;
  target: number;
  unit: string;
}

export interface WorkerPoolMetrics {
  activeWorkers: number;
  busyWorkers: number;
  utilizationPercent: number;
  queueDepth: number;
  avgLatencyMs: number;
}

export interface ScalingPolicy {
  scaleOutThreshold: number;
  scaleInThreshold: number;
  targetUtilization: number;
  minWorkers: number;
  maxWorkers: number;
  stabilizationWindowSeconds: number;
  cooldownSeconds: number;
}

export interface ScalingAction {
  direction: ScalingDirection;
  desiredWorkers: number;
  reason: string;
  metrics: ScalingMetric[];
  timestamp: string;
}

export interface HPAEvent {
  eventType: "scale_out" | "scale_in" | "scale_blocked" | "cooldown_active";
  timestamp: string;
  workerPool: string;
  action: ScalingAction;
  cooldownRemainingMs?: number;
}

export const DEFAULT_SCALING_POLICY: ScalingPolicy = {
  scaleOutThreshold: 10,
  scaleInThreshold: 3,
  targetUtilization: 70,
  minWorkers: 1,
  maxWorkers: 100,
  stabilizationWindowSeconds: 300,
  cooldownSeconds: 60,
};

/**
 * Determines scaling direction based on queue depth and worker utilization.
 *
 * @param metrics - Current worker pool and queue metrics
 * @param policy - Scaling policy thresholds
 * @returns ScalingAction with direction, desired count, and reason
 */
export function evaluateScalingAction(
  metrics: WorkerPoolMetrics,
  policy: ScalingPolicy = DEFAULT_SCALING_POLICY,
): ScalingAction {
  const now = new Date().toISOString();
  const metricsList: ScalingMetric[] = [
    { name: "utilization", current: metrics.utilizationPercent, target: policy.targetUtilization, unit: "%" },
    { name: "queueDepth", current: metrics.queueDepth, target: policy.scaleOutThreshold, unit: "tasks" },
  ];

  // Scale out conditions
  if (metrics.queueDepth > policy.scaleOutThreshold && metrics.utilizationPercent > policy.targetUtilization) {
    const desiredWorkers = Math.min(
      Math.ceil(metrics.activeWorkers * 1.5),
      policy.maxWorkers,
    );
    return {
      direction: "out",
      desiredWorkers,
      reason: `Queue depth (${metrics.queueDepth}) exceeds threshold (${policy.scaleOutThreshold}) and utilization (${metrics.utilizationPercent}%) above target (${policy.targetUtilization}%)`,
      metrics: metricsList,
      timestamp: now,
    };
  }

  if (metrics.utilizationPercent > 80 && metrics.queueDepth > policy.scaleOutThreshold * 0.5) {
    const desiredWorkers = Math.min(metrics.activeWorkers + 2, policy.maxWorkers);
    return {
      direction: "out",
      desiredWorkers,
      reason: `High utilization (${metrics.utilizationPercent}%) with backlog`,
      metrics: metricsList,
      timestamp: now,
    };
  }

  // Scale in conditions
  if (metrics.utilizationPercent < 30 && metrics.queueDepth < policy.scaleInThreshold) {
    const desiredWorkers = Math.max(Math.floor(metrics.activeWorkers * 0.7), policy.minWorkers);
    return {
      direction: "in",
      desiredWorkers,
      reason: `Low utilization (${metrics.utilizationPercent}%) and queue nearly empty (${metrics.queueDepth})`,
      metrics: metricsList,
      timestamp: now,
    };
  }

  return {
    direction: "none",
    desiredWorkers: metrics.activeWorkers,
    reason: "Metrics within acceptable range",
    metrics: metricsList,
    timestamp: now,
  };
}

/**
 * Horizontal Scaling Controller
 *
 * Monitors worker pool and queue metrics, emits HPA events when scaling thresholds are breached.
 * Implements the automatic scaling strategy from §8.4.
 */
export class HorizontalScalingController {
  private lastScalingAction: ScalingAction | null = null;
  private lastActionTimestamp: number = 0;
  private cooldownMs: number;

  constructor(
    private readonly poolName: string,
    private readonly policy: ScalingPolicy = DEFAULT_SCALING_POLICY,
  ) {
    this.cooldownMs = policy.cooldownSeconds * 1000;
  }

  /**
   * Process metrics and determine if scaling is needed.
   */
  processMetrics(
    queueStats: QueueStats,
    workerMetrics: WorkerPoolMetrics,
  ): HPAEvent | null {
    const now = Date.now();
    const action = evaluateScalingAction(workerMetrics, this.policy);

    // Check cooldown
    if (action.direction !== "none" && this.lastScalingAction?.direction === action.direction) {
      const elapsed = now - this.lastActionTimestamp;
      if (elapsed < this.cooldownMs) {
        return {
          eventType: "cooldown_active",
          timestamp: new Date().toISOString(),
          workerPool: this.poolName,
          action: {
            direction: "none",
            desiredWorkers: workerMetrics.activeWorkers,
            reason: `Cooldown active, ${Math.ceil((this.cooldownMs - elapsed) / 1000)}s remaining`,
            metrics: action.metrics,
            timestamp: action.timestamp,
          },
          cooldownRemainingMs: this.cooldownMs - elapsed,
        };
      }
    }

    // No action needed
    if (action.direction === "none") {
      this.lastScalingAction = action;
      return null;
    }

    this.lastScalingAction = action;
    this.lastActionTimestamp = now;

    return {
      eventType: action.direction === "out" ? "scale_out" : "scale_in",
      timestamp: new Date().toISOString(),
      workerPool: this.poolName,
      action,
    };
  }

  /**
   * Compute recommended worker count from queue depth using HPA-style formula.
   *
   * replicas = ceil(sum(requests) / targetAvg)
   * Simplified: desiredWorkers = ceil(queueDepth / targetWorkersPerWorker)
   */
  computeWorkerCount(queueStats: QueueStats, targetWorkersPerWorker: number = 5): number {
    const pending = queueStats.waiting + queueStats.delayed + queueStats.active;
    return Math.max(1, Math.ceil(pending / targetWorkersPerWorker));
  }

  /**
   * Get current scaling state.
   */
  getScalingState(): { lastAction: ScalingAction | null; cooldownRemainingMs: number } {
    const elapsed = Date.now() - this.lastActionTimestamp;
    return {
      lastAction: this.lastScalingAction,
      cooldownRemainingMs: Math.max(0, this.cooldownMs - elapsed),
    };
  }
}
