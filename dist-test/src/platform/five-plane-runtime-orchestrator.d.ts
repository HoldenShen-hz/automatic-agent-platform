import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type FivePlaneRuntimeCatalog } from "./five-plane-runtime-bootstrap.js";
import { type FivePlaneStartupPlan, type FivePlaneStartupStepId } from "./five-plane-startup-plan.js";
export declare const FIVE_PLANE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "plane.runtime.orchestrator";
export interface FivePlaneStartupExecutionStep {
    readonly stepId: FivePlaneStartupStepId;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly initialized: boolean;
    readonly initializedDependencyServiceIds: readonly string[];
}
export interface FivePlaneRuntimeStartupResult {
    readonly ready: boolean;
    readonly startupOrder: readonly FivePlaneStartupStepId[];
    readonly initializedServiceIds: readonly string[];
    readonly steps: readonly FivePlaneStartupExecutionStep[];
    readonly runtimeCatalog: FivePlaneRuntimeCatalog;
}
export interface FivePlaneRuntimeReadinessSnapshot {
    readonly runtimeCatalogInitialized: boolean;
    readonly startupPlanInitialized: boolean;
    readonly orchestratorInitialized: boolean;
    readonly planeReadiness: readonly {
        readonly stepId: FivePlaneStartupStepId;
        readonly bootstrapServiceId: string;
        readonly initialized: boolean;
    }[];
}
export declare class FivePlaneRuntimeOrchestrator {
    private readonly registry;
    constructor(registry?: ServiceRegistry);
    prepare(): {
        readonly startupPlan: FivePlaneStartupPlan;
        readonly runtimeCatalog: FivePlaneRuntimeCatalog;
    };
    startup(): FivePlaneRuntimeStartupResult;
    snapshotReadiness(): FivePlaneRuntimeReadinessSnapshot;
}
export declare function registerFivePlaneRuntimeOrchestrator(registry?: ServiceRegistry): FivePlaneRuntimeOrchestrator;
