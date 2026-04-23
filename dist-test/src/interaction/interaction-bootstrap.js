import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { listInteractionCapabilityBaselines, } from "./interaction-baseline-catalog.js";
export const INTERACTION_CATALOG_SERVICE_ID = "w3.interaction.catalog";
export const INTERACTION_BOOTSTRAP_SERVICE_ID = "w3.interaction.bootstrap";
export function buildInteractionBootstrap() {
    return {
        capabilityGroupId: "interaction",
        catalog: listInteractionCapabilityBaselines(),
        registeredServiceIds: [INTERACTION_CATALOG_SERVICE_ID, INTERACTION_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerInteractionBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(INTERACTION_CATALOG_SERVICE_ID, {
        init: () => listInteractionCapabilityBaselines(),
    });
    registry.register(INTERACTION_BOOTSTRAP_SERVICE_ID, {
        init: () => buildInteractionBootstrap(),
        dependsOn: [INTERACTION_CATALOG_SERVICE_ID],
    });
    return registry.get(INTERACTION_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=interaction-bootstrap.js.map