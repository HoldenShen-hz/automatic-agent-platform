import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { listGovernanceCapabilityBaselines, } from "./governance-baseline-catalog.js";
export const GOVERNANCE_CATALOG_SERVICE_ID = "w3.governance.catalog";
export const GOVERNANCE_BOOTSTRAP_SERVICE_ID = "w3.governance.bootstrap";
export function buildGovernanceBootstrap() {
    return {
        capabilityGroupId: "org-governance",
        catalog: listGovernanceCapabilityBaselines(),
        registeredServiceIds: [GOVERNANCE_CATALOG_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerGovernanceBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(GOVERNANCE_CATALOG_SERVICE_ID, {
        init: () => listGovernanceCapabilityBaselines(),
    });
    registry.register(GOVERNANCE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildGovernanceBootstrap(),
        dependsOn: [GOVERNANCE_CATALOG_SERVICE_ID],
    });
    return registry.get(GOVERNANCE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=governance-bootstrap.js.map