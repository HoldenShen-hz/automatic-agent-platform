import type { RolloutStatus } from "../oapeflir/types/rollout-record.js";

export interface CanaryRoutingDecision {
  matched: boolean;
  trafficPercentage: number;
  bucket: number;
}

const TRAFFIC_PERCENTAGES: Readonly<Record<RolloutStatus, number>> = {
  draft: 0,
  pending_approval: 0,
  shadow: 0,
  canary_5: 5,
  partial_25: 25,
  partial_50: 50,
  partial_75: 75,
  stable: 100,
  rejected: 0,
  rolled_back: 0,
  paused: 0,
};

function hashToBucket(value: string): number {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash * 31) + value.charCodeAt(index)) >>> 0;
  }
  return hash % 100;
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
}
