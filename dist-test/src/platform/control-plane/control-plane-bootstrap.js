import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listControlPlaneCapabilityBaselines, } from "./control-plane-baseline.js";
export const CONTROL_PLANE_CATALOG_SERVICE_ID = "plane.control.catalog";
export const CONTROL_PLANE_BOOTSTRAP_SERVICE_ID = "plane.control.bootstrap";
export function buildControlPlaneBootstrap() {
    return {
        planeId: "control-plane",
        catalog: listControlPlaneCapabilityBaselines(),
        registeredServiceIds: [CONTROL_PLANE_CATALOG_SERVICE_ID, CONTROL_PLANE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerControlPlaneBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(CONTROL_PLANE_CATALOG_SERVICE_ID, {
        init: () => listControlPlaneCapabilityBaselines(),
    });
    registry.register(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildControlPlaneBootstrap(),
        dependsOn: [CONTROL_PLANE_CATALOG_SERVICE_ID],
    });
    return registry.get(CONTROL_PLANE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=control-plane-bootstrap.js.map