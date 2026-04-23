import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { listScaleCapabilityBaselines, } from "./scale-baseline-catalog.js";
export const SCALE_CATALOG_SERVICE_ID = "w4.scale.catalog";
export const SCALE_BOOTSTRAP_SERVICE_ID = "w4.scale.bootstrap";
export function buildScaleBootstrap() {
    return {
        capabilityGroupId: "scale-ecosystem",
        catalog: listScaleCapabilityBaselines(),
        registeredServiceIds: [SCALE_CATALOG_SERVICE_ID, SCALE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerScaleBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(SCALE_CATALOG_SERVICE_ID, {
        init: () => listScaleCapabilityBaselines(),
    });
    registry.register(SCALE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildScaleBootstrap(),
        dependsOn: [SCALE_CATALOG_SERVICE_ID],
    });
    return registry.get(SCALE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=scale-bootstrap.js.map