import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { INTERACTION_BOOTSTRAP_SERVICE_ID, registerInteractionBootstrap, } from "./interaction/interaction-bootstrap.js";
import { GOVERNANCE_BOOTSTRAP_SERVICE_ID, registerGovernanceBootstrap, } from "./org-governance/governance-bootstrap.js";
export const INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID = "w3.runtime.catalog";
export function buildInteractionGovernanceRuntimeCatalog() {
    return {
        interaction: registerInteractionBootstrap().catalog,
        governance: registerGovernanceBootstrap().catalog,
    };
}
export function registerInteractionGovernanceRuntimeCatalog(registry = ServiceRegistry.getInstance()) {
    const interaction = registerInteractionBootstrap(registry).catalog;
    const governance = registerGovernanceBootstrap(registry).catalog;
    registry.register(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID, {
        init: () => ({ interaction, governance }),
        dependsOn: [INTERACTION_BOOTSTRAP_SERVICE_ID, GOVERNANCE_BOOTSTRAP_SERVICE_ID],
    });
    return registry.get(INTERACTION_GOVERNANCE_RUNTIME_CATALOG_SERVICE_ID);
}
//# sourceMappingURL=interaction-governance-runtime-catalog.js.map