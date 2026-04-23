import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listInterfaceCapabilityBaselines, } from "./interface-plane-baseline.js";
export const INTERFACE_PLANE_CATALOG_SERVICE_ID = "plane.interface.catalog";
export const INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.interface.bootstrap";
export function buildInterfacePlaneBootstrap() {
    return {
        planeId: "interface",
        catalog: listInterfaceCapabilityBaselines(),
        registeredServiceIds: [INTERFACE_PLANE_CATALOG_SERVICE_ID, INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerInterfacePlaneBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(INTERFACE_PLANE_CATALOG_SERVICE_ID, {
        init: () => listInterfaceCapabilityBaselines(),
    });
    registry.register(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildInterfacePlaneBootstrap(),
        dependsOn: [INTERFACE_PLANE_CATALOG_SERVICE_ID],
    });
    return registry.get(INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=interface-plane-bootstrap.js.map