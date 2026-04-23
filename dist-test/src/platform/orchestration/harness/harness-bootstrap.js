import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";
import { listHarnessCapabilityBaselines, } from "./harness-baseline.js";
export const HARNESS_CATALOG_SERVICE_ID = "aiops.harness.catalog";
export const HARNESS_BOOTSTRAP_SERVICE_ID = "aiops.harness.bootstrap";
export function buildHarnessBootstrap() {
    return {
        capabilityGroupId: "harness",
        catalog: listHarnessCapabilityBaselines(),
        registeredServiceIds: [HARNESS_CATALOG_SERVICE_ID, HARNESS_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerHarnessBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(HARNESS_CATALOG_SERVICE_ID, {
        init: () => listHarnessCapabilityBaselines(),
    });
    registry.register(HARNESS_BOOTSTRAP_SERVICE_ID, {
        init: () => buildHarnessBootstrap(),
        dependsOn: [HARNESS_CATALOG_SERVICE_ID],
    });
    return registry.get(HARNESS_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=harness-bootstrap.js.map