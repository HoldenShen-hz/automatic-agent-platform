import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type AiOperationsStartupPlan, type AiOperationsStartupStepId } from "./ai-operations-startup-plan.js";
export declare const AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "aiops.runtime.orchestrator";
export interface AiOperationsStartupExecutionStep {
    readonly stepId: AiOperationsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly initialized: boolean;
    readonly initializedDependencyServiceIds: readonly string[];
}
export interface AiOperationsRuntimeStartupResult {
    readonly ready: boolean;
    readonly startupOrder: readonly AiOperationsStartupStepId[];
    readonly initializedServiceIds: readonly string[];
    readonly steps: readonly AiOperationsStartupExecutionStep[];
}
export interface AiOperationsReadinessSnapshot {
    readonly runtimeCatalogInitialized: boolean;
    readonly startupPlanInitialized: boolean;
    readonly orchestratorInitialized: boolean;
    readonly capabilityReadiness: readonly {
        readonly stepId: AiOperationsStartupStepId;
        readonly bootstrapServiceId: string;
        readonly initialized: boolean;
    }[];
}
export declare class AiOperationsRuntimeOrchestrator {
    private readonly registry;
    constructor(registry?: ServiceRegistry);
    prepare(): AiOperationsStartupPlan;
    startup(): AiOperationsRuntimeStartupResult;
    snapshotReadiness(): AiOperationsReadinessSnapshot;
}
export declare function registerAiOperationsRuntimeOrchestrator(registry?: ServiceRegistry): AiOperationsRuntimeOrchestrator;
