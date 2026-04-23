import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
export declare const INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID = "w3.runtime.startup-plan";
export type InteractionGovernanceStartupStepId = "interaction" | "org-governance";
export interface InteractionGovernanceStartupStep {
    readonly stepId: InteractionGovernanceStartupStepId;
    readonly entryModule: string;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly dependsOnStepIds: readonly InteractionGovernanceStartupStepId[];
}
export interface InteractionGovernanceStartupPlan {
    readonly steps: readonly InteractionGovernanceStartupStep[];
    readonly totalCapabilityCount: number;
    readonly startupOrder: readonly InteractionGovernanceStartupStepId[];
}
export declare function buildInteractionGovernanceStartupPlan(): InteractionGovernanceStartupPlan;
export declare function registerInteractionGovernanceStartupPlan(registry?: ServiceRegistry): InteractionGovernanceStartupPlan;
