import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type DomainsStartupPlan, type DomainsStartupStepId } from "./domains-startup-plan.js";
export declare const DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID = "w5.runtime.orchestrator";
export interface DomainsStartupExecutionStep {
    readonly stepId: DomainsStartupStepId;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly initialized: boolean;
    readonly initializedDependencyServiceIds: readonly string[];
}
export interface DomainsRuntimeStartupResult {
    readonly ready: boolean;
    readonly startupOrder: readonly DomainsStartupStepId[];
    readonly initializedServiceIds: readonly string[];
    readonly steps: readonly DomainsStartupExecutionStep[];
}
export interface DomainsReadinessSnapshot {
    readonly runtimeCatalogInitialized: boolean;
    readonly startupPlanInitialized: boolean;
    readonly orchestratorInitialized: boolean;
    readonly capabilityReadiness: readonly {
        readonly stepId: DomainsStartupStepId;
        readonly bootstrapServiceId: string;
        readonly initialized: boolean;
    }[];
}
export declare class DomainsRuntimeOrchestrator {
    private readonly registry;
    constructor(registry?: ServiceRegistry);
    prepare(): DomainsStartupPlan;
    startup(): DomainsRuntimeStartupResult;
    snapshotReadiness(): DomainsReadinessSnapshot;
}
export declare function registerDomainsRuntimeOrchestrator(registry?: ServiceRegistry): DomainsRuntimeOrchestrator;
