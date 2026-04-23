import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type ModelGatewayCapabilityBaseline } from "./model-gateway-baseline.js";
export type { ModelGatewayCapabilityBaseline } from "./model-gateway-baseline.js";
export declare const MODEL_GATEWAY_CATALOG_SERVICE_ID = "aiops.model-gateway.catalog";
export declare const MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID = "aiops.model-gateway.bootstrap";
export interface ModelGatewayBootstrap {
    readonly capabilityGroupId: "model-gateway";
    readonly catalog: readonly ModelGatewayCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof MODEL_GATEWAY_CATALOG_SERVICE_ID, typeof MODEL_GATEWAY_BOOTSTRAP_SERVICE_ID];
}
export declare function buildModelGatewayBootstrap(): ModelGatewayBootstrap;
export declare function registerModelGatewayBootstrap(registry?: ServiceRegistry): ModelGatewayBootstrap;
