import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type ScaleOpsStartupPlan, type ScaleOpsStartupStepId } from "./scale-ops-startup-plan.js";
export declare const SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w4.runtime.orchestrator";
export interface ScaleOpsStartupExecutionStep {
    readonly stepId: ScaleOpsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly initialized: boolean;
    readonly initializedDependencyServiceIds: readonly string[];
}
export interface ScaleOpsRuntimeStartupResult {
    readonly ready: boolean;
    readonly startupOrder: readonly ScaleOpsStartupStepId[];
    readonly initializedServiceIds: readonly string[];
    readonly steps: readonly ScaleOpsStartupExecutionStep[];
}
export interface ScaleOpsReadinessSnapshot {
    readonly runtimeCatalogInitialized: boolean;
    readonly startupPlanInitialized: boolean;
    readonly orchestratorInitialized: boolean;
    readonly capabilityReadiness: readonly {
        readonly stepId: ScaleOpsStartupStepId;
        readonly bootstrapServiceId: string;
        readonly initialized: boolean;
    }[];
}
export declare class ScaleOpsRuntimeOrchestrator {
    private readonly registry;
    constructor(registry?: ServiceRegistry);
    prepare(): ScaleOpsStartupPlan;
    startup(): ScaleOpsRuntimeStartupResult;
    snapshotReadiness(): ScaleOpsReadinessSnapshot;
}
export declare function registerScaleOpsRuntimeOrchestrator(registry?: ServiceRegistry): ScaleOpsRuntimeOrchestrator;
