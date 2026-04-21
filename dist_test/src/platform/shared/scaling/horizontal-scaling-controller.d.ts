/**
 * @fileoverview Horizontal Scaling Controller
 *
 * Implements §8 "可扩展性" - automatic scaling strategy.
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
/**
 * Determines scaling direction based on queue depth and worker utilization.
 *
 * @param metrics - Current worker pool and queue metrics
 * @param policy - Scaling policy thresholds
 * @returns ScalingAction with direction, desired count, and reason
 */
export declare function evaluateScalingAction(metrics: WorkerPoolMetrics, policy?: ScalingPolicy): ScalingAction;
/**
 * Horizontal Scaling Controller
 *
 * Monitors worker pool and queue metrics, emits HPA events when scaling thresholds are breached.
 * Implements the automatic scaling strategy from §8.4.
 */
export declare class HorizontalScalingController {
    private readonly poolName;
    private readonly policy;
    private lastScalingAction;
    private lastActionTimestamp;
    private cooldownMs;
    constructor(poolName: string, policy?: ScalingPolicy);
    /**
     * Process metrics and determine if scaling is needed.
     */
    processMetrics(queueStats: QueueStats, workerMetrics: WorkerPoolMetrics): HPAEvent | null;
    /**
     * Compute recommended worker count from queue depth using HPA-style formula.
     *
     * replicas = ceil(sum(requests) / targetAvg)
     * Simplified: desiredWorkers = ceil(queueDepth / targetWorkersPerWorker)
     */
    computeWorkerCount(queueStats: QueueStats, targetWorkersPerWorker?: number): number;
    /**
     * Get current scaling state.
     */
    getScalingState(): {
        lastAction: ScalingAction | null;
        cooldownRemainingMs: number;
    };
}
