/**
 * SLO Tracking Module
 *
 * Provides Service Level Objective tracking with:
 * - Per-domain SLO scope (R14-06)
 * - Multi-window burn-rate alerting (R14-08)
 * - Gradient response to SLO breaches (R14-07)
 *
 * §67.2 Dynamic N+1 Failover Reserve per SLA Tier
 *
 * This module complements the SloAlertingService in platform/shared/observability/
 * by providing runtime SLO tracking with automatic failover reserve calculation.
 */

import { nowIso } from "../../contracts/types/ids.js";

/**
 * SLA tier for capacity planning
 */
export type SlaTier = "gold" | "silver" | "bronze";

/**
 * SLO tracking entry for a specific domain
 */
export interface SloTrackerEntry {
  sloId: string;
  domain: string;
  targetValue: number;
  operator: "lte" | "gte" | "lt" | "gt";
  windowMinutes: number;
  currentValue: number;
  lastUpdated: string;
  burnRate: number;
  errorBudgetRemaining: number;
  status: "healthy" | "at_risk" | "breached";
}

/**
 * Failover reserve configuration per SLA tier
 * §67.2: Dynamic N+1 failover reserve
 */
export const FAILOVER_RESERVE_PER_TIER: Readonly<Record<SlaTier, number>> = {
  gold: 30,   // 30% reserve for gold SLA
  silver: 20, // 20% reserve for silver SLA
  bronze: 15,  // 15% reserve for bronze SLA
} as const;

/**
 * Gradient response levels for SLO degradation
 * R14-07: Gradient response to SLO breaches
 */
export const GRADIENT_LEVELS = {
  HEALTHY: 0,
  WARNING: 1,   // Notify, no action
  CRITICAL: 2,  // Notify + start rate limiting
  SEVERE: 3,   // Partial rollout freeze
  FREEZE: 4,   // Full rollout freeze
} as const;

export type GradientLevel = typeof GRADIENT_LEVELS[keyof typeof GRADIENT_LEVELS];

/**
 * Burn rate alert configuration for multi-window alerting
 * R14-08: Multi-window burn-rate alerting strategy
 */
export interface BurnRateWindow {
  windowMs: number;
  threshold: number;      // burn rate multiplier
  severity: "warning" | "critical" | "page";
}

export const MULTI_WINDOW_BURN_RATE_CONFIG: readonly BurnRateWindow[] = [
  { windowMs: 3_600_000, threshold: 5, severity: "warning" },   // 1h: 5x burn = slow burn
  { windowMs: 600_000, threshold: 10, severity: "critical" },   // 10m: 10x burn = fast burn
  { windowMs: 60_000, threshold: 20, severity: "page" },        // 1m: 20x burn = immediate
];

/**
 * SLO Tracker Service
 *
 * Tracks SLO status per domain with automatic failover reserve calculation.
 * Provides burn-rate alerting and gradient response capabilities.
 */
export class SloTrackerService {
  private readonly trackers = new Map<string, SloTrackerEntry>();
  private readonly domainTrackers = new Map<string, Set<string>>();

  /**
   * R14-06: Register an SLO with per-domain scope
   */
  registerSlo(
    sloId: string,
    domain: string,
    targetValue: number,
    operator: "lte" | "gte" | "lt" | "gt" = "lte",
    windowMinutes: number = 60,
  ): SloTrackerEntry {
    const entry: SloTrackerEntry = {
      sloId,
      domain,
      targetValue,
      operator,
      windowMinutes,
      currentValue: targetValue, // Start at target
      lastUpdated: nowIso(),
      burnRate: 0,
      errorBudgetRemaining: 100,
      status: "healthy",
    };

    this.trackers.set(sloId, entry);

    // R14-06: Index by domain for per-domain queries
    let domainSet = this.domainTrackers.get(domain);
    if (!domainSet) {
      domainSet = new Set<string>();
      this.domainTrackers.set(domain, domainSet);
    }
    domainSet.add(sloId);

    return entry;
  }

  /**
   * R14-06: Get trackers filtered by domain scope
   */
  getTrackersByDomain(domain: string): SloTrackerEntry[] {
    const sloIds = this.domainTrackers.get(domain);
    if (!sloIds) return [];
    return [...sloIds]
      .map((id) => this.trackers.get(id))
      .filter((e): e is SloTrackerEntry => e !== undefined);
  }

  /**
   * Update SLO current value and compute burn rate
   */
  updateSloValue(sloId: string, value: number): SloTrackerEntry | null {
    const entry = this.trackers.get(sloId);
    if (!entry) return null;

    const now = nowIso();
    entry.currentValue = value;
    entry.lastUpdated = now;

    // Calculate burn rate based on operator
    if (entry.operator === "lte") {
      // For latency-style SLOs where lower is better
      const errorBudget = entry.targetValue; // budget is target value
      entry.errorBudgetRemaining = Math.max(0, 100 - (value / entry.targetValue * 100));
      entry.burnRate = value > 0 ? value / entry.targetValue : 0;
    } else {
      // For success-rate style SLOs where higher is better
      const errorBudget = 100 - entry.targetValue;
      entry.errorBudgetRemaining = Math.max(0, 100 - (100 - value));
      entry.burnRate = value > 0 ? (100 - value) / errorBudget : 0;
    }

    // Update status
    this.updateStatus(entry);

    return entry;
  }

  private updateStatus(entry: SloTrackerEntry): void {
    if (entry.operator === "lte") {
      // Lower is better
      if (entry.currentValue <= entry.targetValue * 0.9) {
        entry.status = "healthy";
      } else if (entry.currentValue <= entry.targetValue) {
        entry.status = "at_risk";
      } else {
        entry.status = "breached";
      }
    } else {
      // Higher is better
      if (entry.currentValue >= entry.targetValue) {
        entry.status = "healthy";
      } else if (entry.currentValue >= entry.targetValue * 0.95) {
        entry.status = "at_risk";
      } else {
        entry.status = "breached";
      }
    }
  }

  /**
   * R14-07: Compute gradient response level based on SLO status
   */
  computeGradientLevel(sloId: string): GradientLevel {
    const entry = this.trackers.get(sloId);
    if (!entry) return GRADIENT_LEVELS.HEALTHY;

    if (entry.status === "breached") {
      if (entry.burnRate > 10) return GRADIENT_LEVELS.FREEZE;
      if (entry.burnRate > 5) return GRADIENT_LEVELS.SEVERE;
      return GRADIENT_LEVELS.CRITICAL;
    }

    if (entry.status === "at_risk") {
      if (entry.burnRate > 2) return GRADIENT_LEVELS.CRITICAL;
      return GRADIENT_LEVELS.WARNING;
    }

    return GRADIENT_LEVELS.HEALTHY;
  }

  /**
   * R14-08: Evaluate multi-window burn rate alerts
   */
  evaluateBurnRateAlerts(sloId: string): Array<{ window: BurnRateWindow; breached: boolean }> {
    const entry = this.trackers.get(sloId);
    if (!entry) return [];

    return MULTI_WINDOW_BURN_RATE_CONFIG.map((window) => ({
      window,
      breached: entry.burnRate >= window.threshold,
    }));
  }

  /**
   * Get failover reserve percent for a given SLA tier
   * §67.2: Dynamic N+1 per SLA tier
   */
  getFailoverReservePercent(tier: SlaTier): number {
    return FAILOVER_RESERVE_PER_TIER[tier];
  }

  /**
   * Compute required capacity including failover reserve
   * §67.2: N+1 failover with tier-based reserve
   */
  computeRequiredCapacity(baseCapacity: number, tier: SlaTier): number {
    const reservePercent = this.getFailoverReservePercent(tier);
    return Math.ceil(baseCapacity * (1 + reservePercent / 100));
  }

  /**
   * Get all trackers with their current status
   */
  getAllTrackers(): SloTrackerEntry[] {
    return [...this.trackers.values()];
  }

  /**
   * Get a specific tracker by SLO ID
   */
  getTracker(sloId: string): SloTrackerEntry | null {
    return this.trackers.get(sloId) ?? null;
  }

  /**
   * Get all breached SLOs across domains
   */
  getBreachedSlos(): SloTrackerEntry[] {
    return [...this.trackers.values()].filter((e) => e.status === "breached");
  }

  /**
   * Get all at-risk SLOs across domains
   */
  getAtRiskSlos(): SloTrackerEntry[] {
    return [...this.trackers.values()].filter((e) => e.status === "at_risk");
  }

  /**
   * Unregister an SLO tracker
   */
  unregisterSlo(sloId: string): boolean {
    const entry = this.trackers.get(sloId);
    if (!entry) return false;

    this.trackers.delete(sloId);

    const domainSet = this.domainTrackers.get(entry.domain);
    if (domainSet) {
      domainSet.delete(sloId);
    }

    return true;
  }
}