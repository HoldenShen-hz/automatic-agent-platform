import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type InteractionCapabilityBaseline } from "./interaction/interaction-bootstrap.js";
import { type GovernanceCapabilityBaseline } from "./org-governance/governance-bootstrap.js";
export declare const INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID = "w3.runtime.catalog";
export interface InteractionGovernanceRuntimeCatalog {
    readonly interaction: readonly InteractionCapabilityBaseline[];
    readonly governance: readonly GovernanceCapabilityBaseline[];
}
export declare function buildInteractionGovernanceRuntimeCatalog(): InteractionGovernanceRuntimeCatalog;
export declare function registerInteractionGovernanceRuntimeCatalog(registry?: ServiceRegistry): InteractionGovernanceRuntimeCatalog;
