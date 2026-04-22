import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listComplianceCapabilityBaselines,
  type ComplianceCapabilityBaseline,
} from "./compliance-baseline.js";

export type { ComplianceCapabilityBaseline } from "./compliance-baseline.js";

export const COMPLIANCE_CATALOG_SERVICE_ID = "aiops.compliance.catalog";
export const COMPLIANCE_BOOTSTRAP_SERVICE_ID = "aiops.compliance.bootstrap";

export interface ComplianceBootstrap {
  readonly capabilityGroupId: "compliance";
  readonly catalog: readonly ComplianceCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof COMPLIANCE_CATALOG_SERVICE_ID, typeof COMPLIANCE_BOOTSTRAP_SERVICE_ID];
}

export function buildComplianceBootstrap(): ComplianceBootstrap {
  return {
    capabilityGroupId: "compliance",
    catalog: listComplianceCapabilityBaselines(),
    registeredServiceIds: [COMPLIANCE_CATALOG_SERVICE_ID, COMPLIANCE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerComplianceBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): ComplianceBootstrap {
  registry.register<readonly ComplianceCapabilityBaseline[]>(COMPLIANCE_CATALOG_SERVICE_ID, {
    init: () => listComplianceCapabilityBaselines(),
  });
  registry.register<ComplianceBootstrap>(COMPLIANCE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildComplianceBootstrap(),
    dependsOn: [COMPLIANCE_CATALOG_SERVICE_ID],
  });
  return registry.get<ComplianceBootstrap>(COMPLIANCE_BOOTSTRAP_SERVICE_ID);
}
