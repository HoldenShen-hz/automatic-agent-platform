import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import {
  listInteractionCapabilityBaselines,
  type InteractionCapabilityBaseline,
} from "./interaction-baseline-catalog.js";

export type { InteractionCapabilityBaseline } from "./interaction-baseline-catalog.js";

export const INTERACTION_CATALOG_SERVICE_ID = "w3.interaction.catalog";
export const INTERACTION_BOOTSTRAP_SERVICE_ID = "w3.interaction.bootstrap";

export interface InteractionBootstrap {
  readonly capabilityGroupId: "interaction";
  readonly catalog: readonly InteractionCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof INTERACTION_CATALOG_SERVICE_ID, typeof INTERACTION_BOOTSTRAP_SERVICE_ID];
}

export function buildInteractionBootstrap(): InteractionBootstrap {
  return {
    capabilityGroupId: "interaction",
    catalog: listInteractionCapabilityBaselines(),
    registeredServiceIds: [INTERACTION_CATALOG_SERVICE_ID, INTERACTION_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerInteractionBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): InteractionBootstrap {
  registry.register<readonly InteractionCapabilityBaseline[]>(INTERACTION_CATALOG_SERVICE_ID, {
    init: () => listInteractionCapabilityBaselines(),
  });
  registry.register<InteractionBootstrap>(INTERACTION_BOOTSTRAP_SERVICE_ID, {
    init: () => buildInteractionBootstrap(),
    dependsOn: [INTERACTION_CATALOG_SERVICE_ID],
  });
  return registry.get<InteractionBootstrap>(INTERACTION_BOOTSTRAP_SERVICE_ID);
}
