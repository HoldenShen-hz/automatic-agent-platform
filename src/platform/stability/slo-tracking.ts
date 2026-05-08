/**
 * SLO Tracking Module
 *
 * Provides Service Level Objective (SLO) tracking and compliance monitoring.
 * This module enables tracking of SLOs across different domains, computing
 * error budgets, and generating compliance reports.
 *
 * R17-49: SLO tracking module implementation
 */

import { newId, nowIso } from "../contracts/types/ids.js";

/**
 * SLO compliance status
 */
export type SloComplianceStatus = "healthy" | "at_risk" | "breached" | "no_data";

/**
 * An SLO tracking record with current compliance state
 */
export interface SloTrackingRecord {
  sloId: string;
  domain: string;  // R14-06: Per-domain scope
  name: string;
  targetValue: number;
  currentValue: number;
  windowStart: string;
  windowEnd: string;
  complianceStatus: SloComplianceStatus;
  errorBudgetUsed: number;  // percentage (0-100)
  lastUpdated: string;
}

/**
 * SLO compliance report for a time period
 */
export interface SloComplianceReport {
  reportId: string;
  domain: string | null;  // null means all domains
  periodStart: string;
  periodEnd: string;
  totalSlos: number;
  healthySlos: number;
  atRiskSlos: number;
  breachedSlos: number;
  overallCompliancePercent: number;
  generatedAt: string;
}

/**
 * Options for SLO tracking configuration
 */
export interface SloTrackingOptions {
  /** Default lookback window in minutes for computing compliance */
  defaultWindowMinutes?: number;
  /** Domains to track (null means all domains) */
  domains?: string[] | null;
}

/**
 * SLO Tracker - tracks SLO compliance and generates reports
 */
export class SloTracker {
  private readonly trackingRecords = new Map<string, SloTrackingRecord>();
  private readonly defaultWindowMinutes: number;
  private readonly domains: string[] | null;

  public constructor(options: SloTrackingOptions = {}) {
    this.defaultWindowMinutes = options.defaultWindowMinutes ?? 60;
    this.domains = options.domains ?? null;
  }

  /**
   * Updates tracking for an SLO with current measurements.
   */
  public trackSlo(params: {
    sloId: string;
    domain: string;
    name: string;
    targetValue: number;
    currentValue: number;
    windowMinutes?: number;
  }): SloTrackingRecord {
    const windowMinutes = params.windowMinutes ?? this.defaultWindowMinutes;
    const now = new Date();
    const windowStart = new Date(now.getTime() - windowMinutes * 60_000).toISOString();
    const windowEnd = now.toISOString();

    // Calculate error budget usage
    let errorBudgetUsed: number;
    if (params.targetValue >= 100) {
      // Availability-style SLO (e.g., 99.9%)
      errorBudgetUsed = Math.max(0, Math.min(100, (1 - params.currentValue / params.targetValue) * 100));
    } else {
      // Rate-style SLO (e.g., error rate < 0.1%)
      errorBudgetUsed = Math.max(0, Math.min(100, (params.currentValue / params.targetValue) * 100 - 100));
    }

    // Determine compliance status
    let complianceStatus: SloComplianceStatus;
    if (params.currentValue >= params.targetValue) {
      if (errorBudgetUsed > 80) {
        complianceStatus = "at_risk";
      } else {
        complianceStatus = "healthy";
      }
    } else {
      complianceStatus = errorBudgetUsed >= 100 ? "breached" : "at_risk";
    }

    const record: SloTrackingRecord = {
      sloId: params.sloId,
      domain: params.domain,
      name: params.name,
      targetValue: params.targetValue,
      currentValue: params.currentValue,
      windowStart,
      windowEnd,
      complianceStatus,
      errorBudgetUsed: Math.round(errorBudgetUsed * 100) / 100,
      lastUpdated: nowIso(),
    };

    this.trackingRecords.set(params.sloId, record);
    return record;
  }

  /**
   * Gets tracking record for an SLO.
   */
  public getTrackingRecord(sloId: string): SloTrackingRecord | null {
    return this.trackingRecords.get(sloId) ?? null;
  }

  /**
   * Lists all tracking records, optionally filtered by domain.
   */
  public listTrackingRecords(domain?: string): SloTrackingRecord[] {
    const all = [...this.trackingRecords.values()];
    if (domain) {
      return all.filter((r) => r.domain === domain);
    }
    return all;
  }

  /**
   * Lists tracking records filtered by compliance status.
   */
  public listByStatus(status: SloComplianceStatus): SloTrackingRecord[] {
    return [...this.trackingRecords.values()].filter((r) => r.complianceStatus === status);
  }

  /**
   * Generates a compliance report for the specified period.
   */
  public generateComplianceReport(params?: {
    domain?: string;
    periodStart?: string;
    periodEnd?: string;
  }): SloComplianceReport {
    const records = params?.domain
      ? this.listTrackingRecords(params.domain)
      : [...this.trackingRecords.values()];

    const periodStart = params?.periodStart ?? new Date(Date.now() - 24 * 60 * 60_000).toISOString();
    const periodEnd = params?.periodEnd ?? nowIso();

    const healthySlos = records.filter((r) => r.complianceStatus === "healthy").length;
    const atRiskSlos = records.filter((r) => r.complianceStatus === "at_risk").length;
    const breachedSlos = records.filter((r) => r.complianceStatus === "breached").length;
    const totalSlos = records.length;

    const overallCompliancePercent = totalSlos > 0
      ? Math.round((healthySlos / totalSlos) * 10000) / 100
      : 0;

    return {
      reportId: newId("slo_report"),
      domain: params?.domain ?? null,
      periodStart,
      periodEnd,
      totalSlos,
      healthySlos,
      atRiskSlos,
      breachedSlos,
      overallCompliancePercent,
      generatedAt: nowIso(),
    };
  }

  /**
   * Gets error budget remaining for an SLO.
   */
  public getErrorBudgetRemaining(sloId: string): number {
    const record = this.trackingRecords.get(sloId);
    if (!record) return 100;
    return Math.max(0, 100 - record.errorBudgetUsed);
  }

  /**
   * Checks if an SLO is within its error budget.
   */
  public isWithinErrorBudget(sloId: string): boolean {
    const record = this.trackingRecords.get(sloId);
    if (!record) return true;
    return record.errorBudgetUsed < 100;
  }

  /**
   * Clears all tracking records.
   */
  public reset(): void {
    this.trackingRecords.clear();
  }
}