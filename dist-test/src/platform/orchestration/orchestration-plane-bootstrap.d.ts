import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type OrchestrationCapabilityBaseline } from "./orchestration-plane-baseline.js";
export type { OrchestrationCapabilityBaseline } from "./orchestration-plane-baseline.js";
export declare const ORCHESTRATION_PLANE_CATALOG_SERVICE_ID = "plane.orchestration.catalog";
export declare const ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.orchestration.bootstrap";
export interface OrchestrationPlaneBootstrap {
    readonly planeId: "orchestration";
    readonly catalog: readonly OrchestrationCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof ORCHESTRATION_PLANE_CATALOG_SERVICE_ID, typeof ORCHESTRATION_PLANE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildOrchestrationPlaneBootstrap(): OrchestrationPlaneBootstrap;
export declare function registerOrchestrationPlaneBootstrap(registry?: ServiceRegistry): OrchestrationPlaneBootstrap;
