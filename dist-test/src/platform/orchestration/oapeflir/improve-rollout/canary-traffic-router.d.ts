import type { RolloutStatus } from "../types/rollout-record.js";
export interface CanaryRoutingDecision {
    matched: boolean;
    trafficPercentage: number;
    bucket: number;
}
export declare class CanaryTrafficRouter {
    getTrafficPercentage(status: RolloutStatus): number;
    shouldRoute(taskId: string, status: RolloutStatus): boolean;
    route(taskId: string, status: RolloutStatus): CanaryRoutingDecision;
}
