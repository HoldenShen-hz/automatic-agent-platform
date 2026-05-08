import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import {
  listScaleCapabilityBaselines,
  type ScaleCapabilityBaseline,
} from "./scale-baseline-catalog.js";

export type { ScaleCapabilityBaseline } from "./scale-baseline-catalog.js";

export const SCALE_CATALOG_SERVICE_ID = "w4.scale.catalog";
export const SCALE_BOOTSTRAP_SERVICE_ID = "w4.scale.bootstrap";

export interface ScaleBootstrap {
  readonly capabilityGroupId: "scale-ecosystem";
  readonly catalog: readonly ScaleCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof SCALE_CATALOG_SERVICE_ID, typeof SCALE_BOOTSTRAP_SERVICE_ID];
}

export function buildScaleBootstrap(): ScaleBootstrap {
  return {
    capabilityGroupId: "scale-ecosystem",
    catalog: listScaleCapabilityBaselines(),
    registeredServiceIds: [SCALE_CATALOG_SERVICE_ID, SCALE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerScaleBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): ScaleBootstrap {
  registry.register<readonly ScaleCapabilityBaseline[]>(SCALE_CATALOG_SERVICE_ID, {
    init: () => listScaleCapabilityBaselines(),
  });
  registry.register<ScaleBootstrap>(SCALE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildScaleBootstrap(),
    dependsOn: [SCALE_CATALOG_SERVICE_ID],
  });
  return registry.get<ScaleBootstrap>(SCALE_BOOTSTRAP_SERVICE_ID);
}
