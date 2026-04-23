import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listModelGatewayCapabilityBaselines, } from "./model-gateway-baseline.js";
export const MODEL_GATEWAY_CATALOG_SERVICE_ID = "aiops.model-gateway.catalog";
export const MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID = "aiops.model-gateway.bootstrap";
export function buildModelGatewayBootstrap() {
    return {
        capabilityGroupId: "model-gateway",
        catalog: listModelGatewayCapabilityBaselines(),
        registeredServiceIds: [MODEL_GATEWAY_CATALOG_SERVICE_ID, MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerModelGatewayBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(MODEL_GATEWAY_CATALOG_SERVICE_ID, {
        init: () => listModelGatewayCapabilityBaselines(),
    });
    registry.register(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID, {
        init: () => buildModelGatewayBootstrap(),
        dependsOn: [MODEL_GATEWAY_CATALOG_SERVICE_ID],
    });
    return registry.get(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=model-gateway-bootstrap.js.map