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

const TRAFFIC_PERCENTAGES: Readonly<Record<string, number>> = {
  draft: 0,
  pending_approval: 0,
  shadow: 0,
  candidate_created: 0,
  under_review: 0,
  proposed: 0,
  approved: 0,
  evaluation_enabled: 0,
  canary_5: 5,
  partial_25: 25,
  partial_50: 50,
  partial_75: 75,
  stable_75: 75,
  stable: 100,
  stable_100: 100,
  released: 100,
  rejected: 0,
  rolled_back: 0,
  paused: 0,
};

function hashToBucket(value: string): number {
  // R23-52 fix: Use djb2-style hash which provides better distribution
  // than simple polynomial accumulation. Also ensure full 32-bit range.
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) + value.charCodeAt(index);
  }
  return Math.abs(hash) % 100;
}

export class CanaryTrafficRouter {
  public getTrafficPercentage(status: RolloutStatus | string): number {
    return TRAFFIC_PERCENTAGES[status] ?? 0;
  }

  public shouldRoute(taskId: string, status: RolloutStatus | string, rolloutSalt?: string): boolean {
    return this.route(taskId, status, rolloutSalt).matched;
  }

  public route(taskId: string, status: RolloutStatus | string, rolloutSalt?: string): CanaryRoutingDecision {
    const trafficPercentage = this.getTrafficPercentage(status);
    const bucket = hashToBucket(buildRoutingKey(taskId, status, rolloutSalt));
    return {
      matched: bucket < trafficPercentage,
      trafficPercentage,
      bucket,
    };
  }

  public computeCanaryAllocation(status: RolloutStatus): CanaryAllocation {
    const canaryPercentage = status === "stable_100" || status === "released" ? 0 : this.getTrafficPercentage(status);
    return {
      targetLevel: status,
      canaryPercentage,
      stablePercentage: 100 - canaryPercentage,
    };
  }
}

function buildRoutingKey(taskId: string, status: RolloutStatus | string, rolloutSalt?: string): string {
  const salt = rolloutSalt?.trim() || String(status);
  return `${salt}::${taskId}`;
}
