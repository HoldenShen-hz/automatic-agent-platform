import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { listOpsMaturityCapabilityBaselines, } from "./ops-maturity-baseline-catalog.js";
export const OPS_MATURITY_CATALOG_SERVICE_ID = "w4.ops-maturity.catalog";
export const OPS_MATURITY_BOOTSTRAP_SERVICE_ID = "w4.ops-maturity.bootstrap";
export function buildOpsMaturityBootstrap() {
    return {
        capabilityGroupId: "ops-maturity",
        catalog: listOpsMaturityCapabilityBaselines(),
        registeredServiceIds: [OPS_MATURITY_CATALOG_SERVICE_ID, OPS_MATURITY_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerOpsMaturityBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(OPS_MATURITY_CATALOG_SERVICE_ID, {
        init: () => listOpsMaturityCapabilityBaselines(),
    });
    registry.register(OPS_MATURITY_BOOTSTRAP_SERVICE_ID, {
        init: () => buildOpsMaturityBootstrap(),
        dependsOn: [OPS_MATURITY_CATALOG_SERVICE_ID],
    });
    return registry.get(OPS_MATURITY_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=ops-maturity-bootstrap.js.map