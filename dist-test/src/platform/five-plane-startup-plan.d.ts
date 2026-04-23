import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type PlatformSurfaceId } from "./platform-module-catalog.js";
export declare const FIVE_PLANE_STARTUP_PLAN_SERVICE_ID = "plane.runtime.startup-plan";
export type FivePlaneStartupStepId = "interface" | "control-plane" | "orchestration" | "execution" | "state-evidence";
export interface FivePlaneStartupStep {
    readonly stepId: FivePlaneStartupStepId;
    readonly surfaceId: PlatformSurfaceId;
    readonly entryModule: string;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly dependsOnStepIds: readonly FivePlaneStartupStepId[];
}
export interface FivePlaneStartupPlan {
    readonly steps: readonly FivePlaneStartupStep[];
    readonly totalCapabilityCount: number;
    readonly startupOrder: readonly FivePlaneStartupStepId[];
}
export declare function buildFivePlaneStartupPlan(): FivePlaneStartupPlan;
export declare function registerFivePlaneStartupPlan(registry?: ServiceRegistry): FivePlaneStartupPlan;
