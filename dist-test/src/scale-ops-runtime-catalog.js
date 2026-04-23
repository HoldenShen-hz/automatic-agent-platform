import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { SCALE_BOOTSTRAP_SERVICE_ID, registerScaleBootstrap, } from "./scale-ecosystem/scale-bootstrap.js";
import { OPS_MATURITY_BOOTSTRAP_SERVICE_ID, registerOpsMaturityBootstrap, } from "./ops-maturity/ops-maturity-bootstrap.js";
export const SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID = "w4.runtime.catalog";
export function buildScaleOpsRuntimeCatalog() {
    return {
        scaleEcosystem: registerScaleBootstrap().catalog,
        opsMaturity: registerOpsMaturityBootstrap().catalog,
    };
}
export function registerScaleOpsRuntimeCatalog(registry = ServiceRegistry.getInstance()) {
    const scaleEcosystem = registerScaleBootstrap(registry).catalog;
    const opsMaturity = registerOpsMaturityBootstrap(registry).catalog;
    registry.register(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID, {
        init: () => ({ scaleEcosystem, opsMaturity }),
        dependsOn: [SCALE_BOOTSTRAP_SERVICE_ID, OPS_MATURITY_BOOTSTRAP_SERVICE_ID],
    });
    return registry.get(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID);
}
//# sourceMappingURL=scale-ops-runtime-catalog.js.map