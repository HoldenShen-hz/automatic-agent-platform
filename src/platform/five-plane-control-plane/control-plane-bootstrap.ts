import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listControlPlaneCapabilityBaselines,
  type ControlPlaneCapabilityBaseline,
} from "./control-plane-baseline.js";
export type { ControlPlaneCapabilityBaseline } from "./control-plane-baseline.js";

export const CONTROL_PLANE_CATALOG_SERVICE_ID = "plane.control.catalog";
export const CONTROL_PLANE_BOOTSTRAP_SERVICE_ID = "plane.control.bootstrap";

export interface ControlPlaneBootstrap {
  readonly planeId: "control-plane";
  readonly catalog: readonly ControlPlaneCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof CONTROL_PLANE_CATALOG_SERVICE_ID, typeof CONTROL_PLANE_BOOTSTRAP_SERVICE_ID];
}

export function buildControlPlaneBootstrap(): ControlPlaneBootstrap {
  return {
    planeId: "control-plane",
    catalog: listControlPlaneCapabilityBaselines(),
    registeredServiceIds: [CONTROL_PLANE_CATALOG_SERVICE_ID, CONTROL_PLANE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerControlPlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): ControlPlaneBootstrap {
  registry.register<readonly ControlPlaneCapabilityBaseline[]>(CONTROL_PLANE_CATALOG_SERVICE_ID, {
    init: () => listControlPlaneCapabilityBaselines(),
  });
  registry.register<ControlPlaneBootstrap>(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildControlPlaneBootstrap(),
    dependsOn: [CONTROL_PLANE_CATALOG_SERVICE_ID],
  });

  return registry.get<ControlPlaneBootstrap>(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID);
}
