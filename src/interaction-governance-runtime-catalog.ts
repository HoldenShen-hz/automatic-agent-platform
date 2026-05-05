import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import {
  INTERACTION_BOOTSTRAP_SERVICE_ID,
  registerInteractionBootstrap,
  type InteractionCapabilityBaseline,
} from "./interaction/interaction-bootstrap.js";
import {
  GOVERNANCE_BOOTSTRAP_SERVICE_ID,
  registerGovernanceBootstrap,
  type GovernanceCapabilityBaseline,
} from "./org-governance/governance-bootstrap.js";

export const INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID = "w3.runtime.catalog";

export interface InteractionGovernanceRuntimeCatalog {
  readonly interaction: readonly InteractionCapabilityBaseline[];
  readonly governance: readonly GovernanceCapabilityBaseline[];
}

export function buildInteractionGovernanceRuntimeCatalog(): InteractionGovernanceRuntimeCatalog {
  return {
    interaction: registerInteractionBootstrap().catalog,
    governance: registerGovernanceBootstrap().catalog,
  };
}

export function registerInteractionGovernanceRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): InteractionGovernanceRuntimeCatalog {
  const interaction = registerInteractionBootstrap(registry).catalog;
  const governance = registerGovernanceBootstrap(registry).catalog;

  registry.register<InteractionGovernanceRuntimeCatalog>(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => ({ interaction, governance }),
    dependsOn: [INTERACTION_BOOTSTRAP_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
  });

  return registry.get<InteractionGovernanceRuntimeCatalog>(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID);
}
