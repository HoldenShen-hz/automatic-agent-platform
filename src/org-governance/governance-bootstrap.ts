import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import {
  listGovernanceCapabilityBaselines,
  type GovernanceCapabilityBaseline,
} from "./governance-baseline-catalog.js";

export type { GovernanceCapabilityBaseline } from "./governance-baseline-catalog.js";

export const GOVERNANCE_CATALOG_SERVICE_ID = "w3.governance.catalog";
export const GOVERNANCE_BOOTSTRAP_SERVICE_ID = "w3.governance.bootstrap";

export interface GovernanceBootstrap {
  readonly capabilityGroupId: "org-governance";
  readonly catalog: readonly GovernanceCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof GOVERNANCE_CATALOG_SERVICE_ID, typeof GOVERNANCE_BOOTSTRAP_SERVICE_ID];
}

export function buildGovernanceBootstrap(): GovernanceBootstrap {
  return {
    capabilityGroupId: "org-governance",
    catalog: listGovernanceCapabilityBaselines(),
    registeredServiceIds: [GOVERNANCE_CATALOG_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerGovernanceBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): GovernanceBootstrap {
  registry.register<readonly GovernanceCapabilityBaseline[]>(GOVERNANCE_CATALOG_SERVICE_ID, {
    init: () => listGovernanceCapabilityBaselines(),
  });
  registry.register<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildGovernanceBootstrap(),
    dependsOn: [GOVERNANCE_CATALOG_SERVICE_ID],
  });
  return registry.get<GovernanceBootstrap>(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
}
