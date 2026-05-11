/**
 * @fileoverview Workflow Debugger Health Monitor
 *
 * Tracks step/execution health with time-bounded history to prevent
 * old failures from permanently poisoning the health state.
 *
 * Provides:
 * - Sliding window health tracking with configurable window duration
 * - Per-component health status with automatic recovery
 * - Failure history pruning to prevent stale data from poisoning state
 *
 * Issue 1917 fix: Previous implementation scanned all history - a single
 * old "failed" permanently poisoned the state. Now uses time-bounded
 * sliding window to only consider recent health data.
 */

import { nowIso } from "../../platform/contracts/types/ids.js";

export type ComponentStatus = "healthy" | "degraded" | "failed";

export interface HealthProbe {
  readonly componentId: string;
  readonly status: ComponentStatus;
  readonly timestamp: string;
  readonly latencyMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface HealthSnapshot {
  readonly componentId: string;
  readonly status: ComponentStatus;
  readonly totalProbes: number;
  readonly healthyCount: number;
  readonly degradedCount: number;
  readonly failedCount: number;
  readonly recentFailureCount: number;
  readonly healthScore: number;
  readonly windowStart: string;
  readonly windowEnd: string;
  readonly oldestProbeInWindow: string | null;
}

export interface HealthMonitorOptions {
  /** Sliding window duration in ms (default: 5 minutes) */
  windowMs?: number;
  /** Minimum sample size before declaring degraded/failed (default: 3) */
  minSampleSize?: number;
  /** Failure rate threshold for degraded status (default: 0.3 = 30%) */
  degradedThreshold?: number;
  /** Failure rate threshold for failed status (default: 0.5 = 50%) */
  failedThreshold?: number;
  /** Maximum probes to retain per component (default: 1000) */
  maxProbesPerComponent?: number;
}

const DEFAULT_WINDOW_MS = 5 * 60_000; // 5 minutes
const DEFAULT_MIN_SAMPLE_SIZE = 3;
const DEFAULT_DEGRADED_THRESHOLD = 0.3; // 30% failure rate
const DEFAULT_FAILED_THRESHOLD = 0.5; // 50% failure rate
const DEFAULT_MAX_PROBES = 1000;

export class WorkflowDebuggerHealthMonitor {
  private readonly windowMs: number;
  private readonly minSampleSize: number;
  private readonly degradedThreshold: number;
  private readonly failedThreshold: number;
  private readonly maxProbesPerComponent: number;
  private readonly probes = new Map<string, HealthProbe[]>();

  public constructor(options: HealthMonitorOptions = {}) {
    this.windowMs = options.windowMs ?? DEFAULT_WINDOW_MS;
    this.minSampleSize = options.minSampleSize ?? DEFAULT_MIN_SAMPLE_SIZE;
    this.degradedThreshold = options.degradedThreshold ?? DEFAULT_DEGRADED_THRESHOLD;
    this.failedThreshold = options.failedThreshold ?? DEFAULT_FAILED_THRESHOLD;
    this.maxProbesPerComponent = options.maxProbesPerComponent ?? DEFAULT_MAX_PROBES;
  }

  /**
   * Record a health probe for a component.
   */
  public recordProbe(probe: HealthProbe): void {
    const existing = this.probes.get(probe.componentId) ?? [];
    const updated = [...existing, probe];

    // Enforce max probes limit to prevent unbounded growth
    if (updated.length > this.maxProbesPerComponent) {
      updated.splice(0, updated.length - this.maxProbesPerComponent);
    }

    this.probes.set(probe.componentId, updated);
  }

  /**
   * Get a health snapshot for a specific component using sliding window.
   * Only probes within the time window are considered.
   */
  public getSnapshot(componentId: string, now: string = nowIso()): HealthSnapshot | null {
    const allProbes = this.probes.get(componentId);
    if (!allProbes || allProbes.length === 0) {
      return null;
    }

    const windowStart = new Date(new Date(now).getTime() - this.windowMs).toISOString();
    const windowEnd = now;

    // Filter to only probes within the sliding window
    const windowProbes = allProbes.filter((p) => p.timestamp >= windowStart && p.timestamp <= windowEnd);

    if (windowProbes.length === 0) {
      // No recent probes - return a null state indicating no data
      return {
        componentId,
        status: "healthy",
        totalProbes: 0,
        healthyCount: 0,
        degradedCount: 0,
        failedCount: 0,
        recentFailureCount: 0,
        healthScore: 100,
        windowStart,
        windowEnd,
        oldestProbeInWindow: null,
      };
    }

    const healthyCount = windowProbes.filter((p) => p.status === "healthy").length;
    const degradedCount = windowProbes.filter((p) => p.status === "degraded").length;
    const failedCount = windowProbes.filter((p) => p.status === "failed").length;
    const recentFailureCount = failedCount;

    // Calculate failure rate
    const failureRate = windowProbes.length > 0 ? failedCount / windowProbes.length : 0;
    const degradedRate = windowProbes.length > 0 ? degradedCount / windowProbes.length : 0;

    // Determine status based on failure rate and sample size
    let status: ComponentStatus = "healthy";
    if (windowProbes.length >= this.minSampleSize) {
      if (failureRate >= this.failedThreshold) {
        status = "failed";
      } else if (failureRate + degradedRate >= this.degradedThreshold) {
        status = "degraded";
      }
    }

    // Calculate health score (0-100)
    const healthScore = this.calculateHealthScore(healthyCount, degradedCount, failedCount, windowProbes.length);

    // Find oldest probe in window
    const oldestProbeInWindow = windowProbes.reduce<string | null>(
      (oldest, p) => (p.timestamp < oldest ? p.timestamp : oldest),
      windowProbes[0]!.timestamp,
    );

    return {
      componentId,
      status,
      totalProbes: windowProbes.length,
      healthyCount,
      degradedCount,
      failedCount,
      recentFailureCount,
      healthScore,
      windowStart,
      windowEnd,
      oldestProbeInWindow,
    };
  }

  /**
   * Get health snapshots for all tracked components.
   */
  public getAllSnapshots(now: string = nowIso()): HealthSnapshot[] {
    const snapshots: HealthSnapshot[] = [];
    const componentIds = [...this.probes.keys()];
    for (const componentId of componentIds) {
      const snapshot = this.getSnapshot(componentId, now);
      if (snapshot) {
        snapshots.push(snapshot);
      }
    }
    return snapshots;
  }

  /**
   * Get overall system health status.
   */
  public getSystemHealth(now: string = nowIso()): ComponentStatus {
    const snapshots = this.getAllSnapshots(now);

    if (snapshots.length === 0) {
      return "healthy";
    }

    // If any component is failed, system is failed
    if (snapshots.some((s) => s.status === "failed")) {
      return "failed";
    }

    // If any component is degraded, system is degraded
    if (snapshots.some((s) => s.status === "degraded")) {
      return "degraded";
    }

    return "healthy";
  }

  /**
   * Prune old probes outside the retention window for all components.
   * Called automatically during snapshot, but can be called manually for cleanup.
   */
  public pruneOldProbes(now: string = nowIso()): number {
    const cutoff = new Date(new Date(now).getTime() - this.windowMs).toISOString();
    let totalPruned = 0;
    const componentIds = [...this.probes.keys()];

    for (const componentId of componentIds) {
      const probes = this.probes.get(componentId);
      if (!probes) continue;

      const originalLength = probes.length;
      const pruned = probes.filter((p) => p.timestamp >= cutoff);
      const prunedCount = originalLength - pruned.length;
      totalPruned += prunedCount;

      if (pruned.length === 0) {
        this.probes.delete(componentId);
      } else {
        this.probes.set(componentId, pruned);
      }
    }

    return totalPruned;
  }

  /**
   * Reset health data for a specific component.
   */
  public resetComponent(componentId: string): void {
    this.probes.delete(componentId);
  }

  /**
   * Reset all health data.
   */
  public reset(): void {
    this.probes.clear();
  }

  /**
   * Get the number of probes for a component (all-time, for debugging).
   */
  public getProbeCount(componentId: string): number {
    return this.probes.get(componentId)?.length ?? 0;
  }

  private calculateHealthScore(healthy: number, degraded: number, failed: number, total: number): number {
    if (total === 0) {
      return 100;
    }
    // Weight: healthy = 100, degraded = 50, failed = 0
    const score = (healthy * 100 + degraded * 50 + failed * 0) / total;
    return Math.round(score);
  }
}