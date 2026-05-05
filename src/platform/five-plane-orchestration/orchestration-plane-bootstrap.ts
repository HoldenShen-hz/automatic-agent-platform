import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listOrchestrationCapabilityBaselines,
  type OrchestrationCapabilityBaseline,
} from "./orchestration-plane-baseline.js";
export type { OrchestrationCapabilityBaseline } from "./orchestration-plane-baseline.js";

export const ORCHESTRATION_PLANE_CATALOG_SERVICE_ID = "plane.orchestration.catalog";
export const ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.orchestration.bootstrap";

export interface OrchestrationPlaneBootstrap {
  readonly planeId: "orchestration";
  readonly catalog: readonly OrchestrationCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, typeof ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID];
}

export function buildOrchestrationPlaneBootstrap(): OrchestrationPlaneBootstrap {
  return {
    planeId: "orchestration",
    catalog: listOrchestrationCapabilityBaselines(),
    registeredServiceIds: [ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerOrchestrationPlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): OrchestrationPlaneBootstrap {
  registry.register<readonly OrchestrationCapabilityBaseline[]>(ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, {
    init: () => listOrchestrationCapabilityBaselines(),
  });
  registry.register<OrchestrationPlaneBootstrap>(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildOrchestrationPlaneBootstrap(),
    dependsOn: [ORCHESTRATION_PLANE_CATALOG_SERVICE_ID],
  });

  return registry.get<OrchestrationPlaneBootstrap>(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID);
}
