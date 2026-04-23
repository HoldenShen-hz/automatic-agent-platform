import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type ComplianceCapabilityBaseline } from "./compliance-baseline.js";
export type { ComplianceCapabilityBaseline } from "./compliance-baseline.js";
export declare const COMPLIANCE_CATALOG_SERVICE_ID = "aiops.compliance.catalog";
export declare const COMPLIANCE_BOOTSTRAP_SERVICE_ID = "aiops.compliance.bootstrap";
export interface ComplianceBootstrap {
    readonly capabilityGroupId: "compliance";
    readonly catalog: readonly ComplianceCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof COMPLIANCE_CATALOG_SERVICE_ID, typeof COMPLIANCE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildComplianceBootstrap(): ComplianceBootstrap;
export declare function registerComplianceBootstrap(registry?: ServiceRegistry): ComplianceBootstrap;
