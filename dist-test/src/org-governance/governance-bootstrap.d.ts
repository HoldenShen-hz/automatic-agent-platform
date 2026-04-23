import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { type GovernanceCapabilityBaseline } from "./governance-baseline-catalog.js";
export type { GovernanceCapabilityBaseline } from "./governance-baseline-catalog.js";
export declare const GOVERNANCE_CATALOG_SERVICE_ID = "w3.governance.catalog";
export declare const GOVERNANCE_BOOTSTRAP_SERVICE_ID = "w3.governance.bootstrap";
export interface GovernanceBootstrap {
    readonly capabilityGroupId: "org-governance";
    readonly catalog: readonly GovernanceCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof GOVERNANCE_CATALOG_SERVICE_ID, typeof GOVERNANCE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildGovernanceBootstrap(): GovernanceBootstrap;
export declare function registerGovernanceBootstrap(registry?: ServiceRegistry): GovernanceBootstrap;
