import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listExecutionCapabilityBaselines, } from "./execution-plane-baseline.js";
export const EXECUTION_PLANE_CATALOG_SERVICE_ID = "plane.execution.catalog";
export const EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.execution.bootstrap";
export function buildExecutionPlaneBootstrap() {
    return {
        planeId: "execution",
        catalog: listExecutionCapabilityBaselines(),
        registeredServiceIds: [EXECUTION_PLANE_CATALOG_SERVICE_ID, EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerExecutionPlaneBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(EXECUTION_PLANE_CATALOG_SERVICE_ID, {
        init: () => listExecutionCapabilityBaselines(),
    });
    registry.register(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildExecutionPlaneBootstrap(),
        dependsOn: [EXECUTION_PLANE_CATALOG_SERVICE_ID],
    });
    return registry.get(EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=execution-plane-bootstrap.js.map