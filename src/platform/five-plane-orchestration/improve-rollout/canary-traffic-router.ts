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

const TRAFFIC_PERCENTAGES: Readonly<Record<RolloutStatus, number>> = {
  candidate_created: 0,
  under_review: 0,
  draft: 0,
  pending_approval: 0,
  evaluation_enabled: 0,
  canary_5: 5,
  canary_20: 20,
  canary_50: 50,
  stable_100: 100,
  released: 100,
  rejected: 0,
  rolled_back: 0,
  paused: 0,
};

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
