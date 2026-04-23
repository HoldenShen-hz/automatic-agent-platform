import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type InteractionGovernanceStartupPlan, type InteractionGovernanceStartupStepId } from "./interaction-governance-startup-plan.js";
export declare const INTERACTION_GOVERNANCE_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w3.runtime.orchestrator";
export interface InteractionGovernanceStartupExecutionStep {
    readonly stepId: InteractionGovernanceStartupStepId;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly initialized: boolean;
    readonly initializedDependencyServiceIds: readonly string[];
}
export interface InteractionGovernanceRuntimeStartupResult {
    readonly ready: boolean;
    readonly startupOrder: readonly InteractionGovernanceStartupStepId[];
    readonly initializedServiceIds: readonly string[];
    readonly steps: readonly InteractionGovernanceStartupExecutionStep[];
}
export interface InteractionGovernanceReadinessSnapshot {
    readonly runtimeCatalogInitialized: boolean;
    readonly startupPlanInitialized: boolean;
    readonly orchestratorInitialized: boolean;
    readonly capabilityReadiness: readonly {
        readonly stepId: InteractionGovernanceStartupStepId;
        readonly bootstrapServiceId: string;
        readonly initialized: boolean;
    }[];
}
export declare class InteractionGovernanceRuntimeOrchestrator {
    private readonly registry;
    constructor(registry?: ServiceRegistry);
    prepare(): InteractionGovernanceStartupPlan;
    startup(): InteractionGovernanceRuntimeStartupResult;
    snapshotReadiness(): InteractionGovernanceReadinessSnapshot;
}
export declare function registerInteractionGovernanceRuntimeOrchestrator(registry?: ServiceRegistry): InteractionGovernanceRuntimeOrchestrator;
