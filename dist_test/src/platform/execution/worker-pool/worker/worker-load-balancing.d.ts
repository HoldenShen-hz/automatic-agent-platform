/**
 * @fileoverview Worker Load Balancing - Metrics for dispatch decisions.
 *
 * Provides load scoring and skew detection utilities for the worker dispatch
 * system. Used by ExecutionDispatchService to balance load across workers
 * and detect when a single worker is handling too much work (load skew).
 *
 * Key concepts:
 * - Load score: Weighted metric combining lease count, saturation, backlog, and CPU
 * - Load skew: When one worker has a disproportionate share of active leases
 * - Sticky dispatch: Assigning work to the same worker for cache efficiency
 *
 * @see Execution Dispatch Service: execution-dispatch-service.ts
 */
/** Maximum recommended share of active leases a single worker should handle (60%). */
export declare const MAX_RECOMMENDED_STICKY_SHARE = 0.6;
/**
 * Worker load signal - snapshot of a worker's current load state.
 *
 * Captures all metrics needed to compute load score and detect skew.
 * Used by the dispatch service to make informed worker selection decisions.
 */
export interface WorkerLoadSignal {
    workerId: string;
    queueAffinity: string | null;
    maxConcurrency: number;
    availableSlots: number;
    activeLeaseCount: number;
    runningExecutionCount: number;
    saturation: number | null;
    toolBacklogCount: number;
    cpuPct: number | null;
}
/**
 * Load skew detection result.
 *
 * Detects when a single worker has a disproportionate share of work,
 * which could cause performance issues or create a single point of failure.
 */
export interface WorkerLoadSkewSummary {
    detected: boolean;
    dominantWorkerId: string | null;
    dominantWorkerShare: number | null;
    skewedWorkerIds: string[];
    totalActiveLeaseCount: number;
    maxRecommendedStickyShare: number;
}
/**
 * Computes the effective active lease count for a worker.
 * Takes the max of activeLeaseCount and runningExecutionCount to account
 * for possible drift between the two tracking mechanisms.
 */
export declare function computeEffectiveActiveLeaseCount(signal: WorkerLoadSignal): number;
/**
 * Computes a composite load score for a worker.
 *
 * The score combines multiple signals:
 * - Active lease ratio (primary metric)
 * - Saturation penalty (worker-reported utilization)
 * - Backlog penalty (pending tool calls)
 * - CPU penalty (if reported)
 *
 * Higher scores indicate heavier load.
 */
export declare function computeWorkerLoadScore(signal: WorkerLoadSignal): number;
/**
 * Detects load skew across a set of workers.
 *
 * Skew is detected when a single worker holds more than MAX_RECOMMENDED_STICKY_SHARE
 * (60%) of total active leases AND alternative capacity exists on other workers.
 * This prevents overloading a single worker while ensuring load balancing is possible.
 */
export declare function summarizeWorkerLoadSkew(signals: ReadonlyArray<WorkerLoadSignal>): WorkerLoadSkewSummary;
