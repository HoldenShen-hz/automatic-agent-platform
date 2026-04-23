import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listComplianceCapabilityBaselines, } from "./compliance-baseline.js";
export const COMPLIANCE_CATALOG_SERVICE_ID = "aiops.compliance.catalog";
export const COMPLIANCE_BOOTSTRAP_SERVICE_ID = "aiops.compliance.bootstrap";
export function buildComplianceBootstrap() {
    return {
        capabilityGroupId: "compliance",
        catalog: listComplianceCapabilityBaselines(),
        registeredServiceIds: [COMPLIANCE_CATALOG_SERVICE_ID, COMPLIANCE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerComplianceBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(COMPLIANCE_CATALOG_SERVICE_ID, {
        init: () => listComplianceCapabilityBaselines(),
    });
    registry.register(COMPLIANCE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildComplianceBootstrap(),
        dependsOn: [COMPLIANCE_CATALOG_SERVICE_ID],
    });
    return registry.get(COMPLIANCE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=compliance-bootstrap.js.map