import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
export declare const SCALE_OPS_STARTUP_PLAN_SERVICE_ID = "w4.runtime.startup-plan";
export type ScaleOpsStartupStepId = "scale-ecosystem" | "ops-maturity";
export interface ScaleOpsStartupStep {
    readonly stepId: ScaleOpsStartupStepId;
    readonly entryModule: string;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly dependsOnStepIds: readonly ScaleOpsStartupStepId[];
}
export interface ScaleOpsStartupPlan {
    readonly steps: readonly ScaleOpsStartupStep[];
    readonly totalCapabilityCount: number;
    readonly startupOrder: readonly ScaleOpsStartupStepId[];
}
export declare function buildScaleOpsStartupPlan(): ScaleOpsStartupPlan;
export declare function registerScaleOpsStartupPlan(registry?: ServiceRegistry): ScaleOpsStartupPlan;
