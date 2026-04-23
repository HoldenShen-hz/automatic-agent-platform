import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listOrchestrationCapabilityBaselines, } from "./orchestration-plane-baseline.js";
export const ORCHESTRATION_PLANE_CATALOG_SERVICE_ID = "plane.orchestration.catalog";
export const ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.orchestration.bootstrap";
export function buildOrchestrationPlaneBootstrap() {
    return {
        planeId: "orchestration",
        catalog: listOrchestrationCapabilityBaselines(),
        registeredServiceIds: [ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerOrchestrationPlaneBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, {
        init: () => listOrchestrationCapabilityBaselines(),
    });
    registry.register(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildOrchestrationPlaneBootstrap(),
        dependsOn: [ORCHESTRATION_PLANE_CATALOG_SERVICE_ID],
    });
    return registry.get(ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=orchestration-plane-bootstrap.js.map