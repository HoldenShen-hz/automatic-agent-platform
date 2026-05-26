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

import { computeCanonicalLoadScore } from "../../shared/load-score.js";

/** Maximum recommended share of active leases a single worker should handle (60%). */
export const MAX_RECOMMENDED_STICKY_SHARE = 0.6;

const MIN_LOAD_SKEW_ACTIVE_LEASES = 3;
const LOAD_SKEW_SCORE_MARGIN = 0.35;

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

export interface WorkerLoadSkewOptions {
  readonly maxRecommendedStickyShare?: number;
}

/**
 * Computes the effective active lease count for a worker.
 * Takes the max of activeLeaseCount and runningExecutionCount to account
 * for possible drift between the two tracking mechanisms.
 */
export function computeEffectiveActiveLeaseCount(signal: WorkerLoadSignal): number {
  return Math.max(signal.activeLeaseCount, signal.runningExecutionCount);
}

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
export function computeWorkerLoadScore(signal: WorkerLoadSignal): number {
  return computeCanonicalLoadScore({
    activeCount: computeEffectiveActiveLeaseCount(signal),
    maxConcurrency: signal.maxConcurrency,
    saturation: signal.saturation,
    backlogCount: signal.toolBacklogCount,
    cpuPct: signal.cpuPct,
  });
}

/**
 * Detects load skew across a set of workers.
 *
 * Skew is detected when a single worker holds more than MAX_RECOMMENDED_STICKY_SHARE
 * (60%) of total active leases AND alternative capacity exists on other workers.
 * This prevents overloading a single worker while ensuring load balancing is possible.
 */
export function summarizeWorkerLoadSkew(
  signals: ReadonlyArray<WorkerLoadSignal>,
  options: WorkerLoadSkewOptions = {},
): WorkerLoadSkewSummary {
  const maxRecommendedStickyShare = options.maxRecommendedStickyShare ?? MAX_RECOMMENDED_STICKY_SHARE;
  const workersWithLoad = signals
    .map((signal) => ({
      signal,
      effectiveActiveLeaseCount: computeEffectiveActiveLeaseCount(signal),
      loadScore: computeWorkerLoadScore(signal),
    }))
    .filter((item) => item.effectiveActiveLeaseCount > 0);

  const totalActiveLeaseCount = workersWithLoad.reduce(
    (sum, item) => sum + item.effectiveActiveLeaseCount,
    0,
  );
  if (signals.length < 2 || workersWithLoad.length === 0 || totalActiveLeaseCount < MIN_LOAD_SKEW_ACTIVE_LEASES) {
    return {
      detected: false,
      dominantWorkerId: null,
      dominantWorkerShare: null,
      skewedWorkerIds: [],
      totalActiveLeaseCount,
      maxRecommendedStickyShare,
    };
  }

  const dominant = [...workersWithLoad].sort((left, right) => {
    if (right.effectiveActiveLeaseCount !== left.effectiveActiveLeaseCount) {
      return right.effectiveActiveLeaseCount - left.effectiveActiveLeaseCount;
    }
    if (right.loadScore !== left.loadScore) {
      return right.loadScore - left.loadScore;
    }
    return left.signal.workerId.localeCompare(right.signal.workerId);
  })[0]!;

  const dominantWorkerShare = dominant.effectiveActiveLeaseCount / totalActiveLeaseCount;
  const alternativeCapacityExists = signals.some(
    (signal) =>
      signal.workerId !== dominant.signal.workerId &&
      signal.availableSlots > 0 &&
      computeWorkerLoadScore(signal) + LOAD_SKEW_SCORE_MARGIN < dominant.loadScore,
  );
  const detected = dominantWorkerShare > maxRecommendedStickyShare && alternativeCapacityExists;

  return {
    detected,
    dominantWorkerId: detected ? dominant.signal.workerId : null,
    dominantWorkerShare: detected ? dominantWorkerShare : null,
    skewedWorkerIds: detected ? [dominant.signal.workerId] : [],
    totalActiveLeaseCount,
    maxRecommendedStickyShare,
  };
}
