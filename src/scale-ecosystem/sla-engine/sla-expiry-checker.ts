/**
 * SLA Expiry Checker Service
 *
 * Per §54.3: Provides advance warning for SLA expiration at 7d/3d/1d intervals.
 * Supports domain-specific threshold overrides for expiration warnings.
 */

import { nowIso } from "../../platform/contracts/types/ids.js";

// §54.3: SLA expiration warning intervals in days
export const SLA_EXPIRY_WARNING_DAYS = [7, 3, 1] as const;
export type SlaExpiryWarningDays = typeof SLA_EXPIRY_WARNING_DAYS[number];

// §54.3: Domain-specific expiration thresholds
export interface DomainExpiryThresholds {
  readonly domainId: string;
  readonly warningIntervals?: readonly number[];
  readonly customWarningThresholds?: ReadonlyArray<{
    readonly daysBeforeExpiry: number;
    readonly severity: "info" | "warning" | "critical";
  }>;
}

export interface SlaExpiryRecord {
  readonly slaId: string;
  readonly tierId: string;
  readonly domainId: string;
  readonly expiresAt: string;
  readonly currentStatus: "active" | "expiring_soon" | "expired";
  readonly warningLevel: "none" | "info" | "warning" | "critical" | null;
  readonly warningsIssued: readonly string[];
}

export interface SlaExpiryCheckRequest {
  readonly slaId: string;
  readonly tierId: string;
  readonly domainId: string;
  readonly expiresAt: string;
  readonly domainThresholds?: DomainExpiryThresholds | null;
}

export interface SlaExpiryCheckResult {
  readonly record: SlaExpiryRecord;
  readonly shouldWarn: boolean;
  readonly warningMessage: string | null;
}

/**
 * SLA Expiry Checker
 *
 * Per §54.3: Provides advance warning for SLA expiration at 7d/3d/1d intervals.
 * Automatically computes warning level based on days until expiry.
 */
export class SlaExpiryChecker {
  // Default warning thresholds if not overridden
  private static readonly DEFAULT_WARNING_THRESHOLDS = [
    { daysBeforeExpiry: 7, severity: "info" as const },
    { daysBeforeExpiry: 3, severity: "warning" as const },
    { daysBeforeExpiry: 1, severity: "critical" as const },
  ];

  /**
   * Check if an SLA is expiring and issue warnings at configured intervals.
   * §54.3: Supports 7d/3d/1d advance warning schedule.
   */
  public checkExpiry(request: SlaExpiryCheckRequest): SlaExpiryCheckResult {
    const now = new Date();
    const expiresAt = new Date(request.expiresAt);
    const daysUntilExpiry = Math.ceil((expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

    // Determine warning thresholds (custom or default)
    const thresholds = this.resolveThresholds(request.domainThresholds);

    // Find the highest severity warning that applies
    let warningLevel: "none" | "info" | "warning" | "critical" = "none";
    let shouldWarn = false;
    let warningMessage: string | null = null;

    for (const threshold of thresholds) {
      if (daysUntilExpiry <= threshold.daysBeforeExpiry) {
        warningLevel = threshold.severity;
        shouldWarn = true;
        warningMessage = `SLA ${request.slaId} (tier: ${request.tierId}) expires in ${daysUntilExpiry} days (${threshold.severity} level)`;
        break;
      }
    }

    // Determine current status
    let currentStatus: "active" | "expiring_soon" | "expired";
    if (daysUntilExpiry <= 0) {
      currentStatus = "expired";
    } else if (daysUntilExpiry <= 7) {
      currentStatus = "expiring_soon";
    } else {
      currentStatus = "active";
    }

    const record: SlaExpiryRecord = {
      slaId: request.slaId,
      tierId: request.tierId,
      domainId: request.domainId,
      expiresAt: request.expiresAt,
      currentStatus,
      warningLevel: shouldWarn ? warningLevel : null,
      warningsIssued: shouldWarn && warningMessage ? [warningMessage] : [],
    };

    return {
      record,
      shouldWarn,
      warningMessage,
    };
  }

  /**
   * Batch check multiple SLA expirations.
   */
  public checkBatch(requests: readonly SlaExpiryCheckRequest[]): SlaExpiryCheckResult[] {
    return requests.map((request) => this.checkExpiry(request));
  }

  /**
   * Resolve warning thresholds from domain-specific config or use defaults.
   */
  private resolveThresholds(
    domainThresholds: DomainExpiryThresholds | null | undefined,
  ): ReadonlyArray<{ readonly daysBeforeExpiry: number; readonly severity: "info" | "warning" | "critical" }> {
    if (domainThresholds?.customWarningThresholds != null) {
      return domainThresholds.customWarningThresholds;
    }
    if (domainThresholds?.warningIntervals != null) {
      // Convert simple day intervals to threshold objects
      return domainThresholds.warningIntervals.map((days, index) => ({
        daysBeforeExpiry: days,
        severity: (["info", "warning", "critical"] as const)[Math.min(index, 2)]!,
      }));
    }
    return SlaExpiryChecker.DEFAULT_WARNING_THRESHOLDS;
  }
}
