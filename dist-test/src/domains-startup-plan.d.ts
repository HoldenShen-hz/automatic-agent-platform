import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type VerticalDomainPhase } from "./domains/domains-bootstrap.js";
export declare const DOMAINS_STARTUP_PLAN_SERVICE_ID = "w5.runtime.startup-plan";
export type DomainsStartupStepId = VerticalDomainPhase;
export interface DomainsStartupStep {
    readonly stepId: DomainsStartupStepId;
    readonly entryModule: string;
    readonly bootstrapServiceId: string;
    readonly capabilityCount: number;
    readonly dependsOnStepIds: readonly DomainsStartupStepId[];
}
export interface DomainsStartupPlan {
    readonly steps: readonly DomainsStartupStep[];
    readonly totalCapabilityCount: number;
    readonly startupOrder: readonly DomainsStartupStepId[];
}
export declare function buildDomainsStartupPlan(): DomainsStartupPlan;
export declare function registerDomainsStartupPlan(registry?: ServiceRegistry): DomainsStartupPlan;
