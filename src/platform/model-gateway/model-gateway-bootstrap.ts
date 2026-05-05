import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listModelGatewayCapabilityBaselines,
  type ModelGatewayCapabilityBaseline,
} from "./model-gateway-baseline.js";

export type { ModelGatewayCapabilityBaseline } from "./model-gateway-baseline.js";

export const MODEL_GATEWAY_CATALOG_SERVICE_ID = "aiops.model-gateway.catalog";
export const MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID = "aiops.model-gateway.bootstrap";

export interface ModelGatewayBootstrap {
  readonly capabilityGroupId: "model-gateway";
  readonly catalog: readonly ModelGatewayCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof MODEL_GATEWAY_CATALOG_SERVICE_ID, typeof MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID];
}

export function buildModelGatewayBootstrap(): ModelGatewayBootstrap {
  return {
    capabilityGroupId: "model-gateway",
    catalog: listModelGatewayCapabilityBaselines(),
    registeredServiceIds: [MODEL_GATEWAY_CATALOG_SERVICE_ID, MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerModelGatewayBootstrap(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): ModelGatewayBootstrap {
  registry.register<readonly ModelGatewayCapabilityBaseline[]>(MODEL_GATEWAY_CATALOG_SERVICE_ID, {
    init: () => listModelGatewayCapabilityBaselines(),
  });
  registry.register<ModelGatewayBootstrap>(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID, {
    init: () => buildModelGatewayBootstrap(),
    dependsOn: [MODEL_GATEWAY_CATALOG_SERVICE_ID],
  });
  return registry.get<ModelGatewayBootstrap>(MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID);
}
