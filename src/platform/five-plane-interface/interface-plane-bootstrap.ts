import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listInterfaceCapabilityBaselines,
  type InterfaceCapabilityBaseline,
} from "./interface-plane-baseline.js";
export type { InterfaceCapabilityBaseline } from "./interface-plane-baseline.js";

export const INTERFACE_PLANE_CATALOG_SERVICE_ID = "plane.interface.catalog";
export const INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.interface.bootstrap";

export interface InterfacePlaneBootstrap {
  readonly planeId: "interface";
  readonly catalog: readonly InterfaceCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof INTERFACE_PLANE_CATALOG_SERVICE_ID, typeof INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID];
}

export function buildInterfacePlaneBootstrap(): InterfacePlaneBootstrap {
  return {
    planeId: "interface",
    catalog: listInterfaceCapabilityBaselines(),
    registeredServiceIds: [INTERFACE_PLANE_CATALOG_SERVICE_ID, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerInterfacePlaneBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): InterfacePlaneBootstrap {
  registry.register<readonly InterfaceCapabilityBaseline[]>(INTERFACE_PLANE_CATALOG_SERVICE_ID, {
    init: () => listInterfaceCapabilityBaselines(),
  });
  registry.register<InterfacePlaneBootstrap>(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildInterfacePlaneBootstrap(),
    dependsOn: [INTERFACE_PLANE_CATALOG_SERVICE_ID],
  });

  return registry.get<InterfacePlaneBootstrap>(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID);
}
