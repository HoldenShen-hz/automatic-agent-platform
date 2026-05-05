import type { RolloutStatus } from "../oapeflir/types/rollout-record.js";

export interface CanaryRoutingDecision {
  matched: boolean;
  trafficPercentage: number;
  bucket: number;
}

export interface CanaryAllocation {
  targetLevel: RolloutStatus;
  canaryPercentage: number;
  stablePercentage: number;
}

/**
 * Validation result for canary rollout percentages
 */
export interface CanaryValidationResult {
  valid: boolean;
  errors: readonly string[];
  warnings: readonly string[];
}

/**
 * Validates canary rollout progression and percentages.
 * Ensures that canary stages progress monotonically and percentages are within valid ranges.
 */
export function validateCanaryRolloutPercentages(): CanaryValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate that canary percentages are monotonically increasing
  const canaryStages: RolloutStatus[] = ["canary_5", "canary_20", "canary_50"];
  const expectedPercentages: number[] = [5, 20, 50];

  for (let idx = 0; idx < canaryStages.length; idx++) {
    const stage = canaryStages[idx]!; // assert defined - array is literal
    const expected = expectedPercentages[idx]!;
    const actualPercentage = TRAFFIC_PERCENTAGES[stage];

    if (actualPercentage === undefined) {
      errors.push(`Missing percentage for ${stage}`);
    } else if (actualPercentage !== expected) {
      errors.push(`Invalid percentage for ${stage}: expected ${expected}, got ${actualPercentage}`);
    }
  }

  // Validate stable_100 is 100%
  const stablePercentage = TRAFFIC_PERCENTAGES["stable_100"];
  if (stablePercentage !== 100) {
    errors.push(`Invalid percentage for stable_100: expected 100, got ${stablePercentage}`);
  }

  // Validate canary progression is monotonically increasing
  const canary5 = TRAFFIC_PERCENTAGES["canary_5"];
  const canary20 = TRAFFIC_PERCENTAGES["canary_20"];
  const canary50 = TRAFFIC_PERCENTAGES["canary_50"];

  if (canary5 !== undefined && canary20 !== undefined && canary5 >= canary20) {
    errors.push("canary_5 percentage must be less than canary_20");
  }
  if (canary20 !== undefined && canary50 !== undefined && canary20 >= canary50) {
    errors.push("canary_20 percentage must be less than canary_50");
  }
  if (canary50 !== undefined && stablePercentage !== undefined && canary50 >= stablePercentage) {
    errors.push("canary_50 percentage must be less than stable_100");
  }

  // Warn if canary percentages seem unusual
  if (canary5 !== undefined && (canary5 < 1 || canary5 > 10)) {
    warnings.push(`canary_5 percentage ${canary5} is outside typical range (1-10%)`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

const TRAFFIC_PERCENTAGES: Readonly<Record<RolloutStatus, number>> = {
  candidate_created: 0,
  under_review: 0,
  draft: 0,
  pending_approval: 0,
  evaluation_enabled: 0,
  suggest: 0,
  shadow: 1,
  canary_5: 5,
  canary_20: 20,
  canary_50: 50,
  partial_25: 25,
  partial_50: 50,
  partial_75: 75,
  stable: 90,
  stable_100: 100,
  released: 100,
  rejected: 0,
  rolled_back: 0,
  paused: 0,
} as const;

function hashToBucket(value: string): number {
  // R16-16 FIX: Short IDs had bias with simple djb2 hash (31-based).
  // Use FNV-1a hash for better distribution especially for short IDs.
  // FNV-1a has better avalanche behavior and fewer collisions for short strings.
  const FNV_OFFSET_BASIS = 2166136261;
  const FNV_PRIME = 16777619;
  let hash = FNV_OFFSET_BASIS;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, FNV_PRIME);
  }
  // Ensure positive and reduce to bucket range
  return (hash >>> 0) % 100;
}

export class CanaryTrafficRouter {
  public getTrafficPercentage(status: RolloutStatus): number {
    return TRAFFIC_PERCENTAGES[status] ?? 0;
  }

  public shouldRoute(taskId: string, status: RolloutStatus): boolean {
    return this.route(taskId, status).matched;
  }

  public route(taskId: string, status: RolloutStatus): CanaryRoutingDecision {
    const trafficPercentage = this.getTrafficPercentage(status);
    const bucket = hashToBucket(taskId);
    return {
      matched: bucket < trafficPercentage,
      trafficPercentage,
      bucket,
    };
  }

  public computeCanaryAllocation(status: RolloutStatus): CanaryAllocation {
    const canaryPercentage = status === "stable_100" || status === "released"
      ? 0
      : this.getTrafficPercentage(status);
    return {
      targetLevel: status,
      canaryPercentage,
      stablePercentage: 100 - canaryPercentage,
    };
  }
}
