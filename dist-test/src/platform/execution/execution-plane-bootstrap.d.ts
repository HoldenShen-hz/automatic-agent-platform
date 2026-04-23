import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type ExecutionCapabilityBaseline } from "./execution-plane-baseline.js";
export type { ExecutionCapabilityBaseline } from "./execution-plane-baseline.js";
export declare const EXECUTION_PLANE_CATALOG_SERVICE_ID = "plane.execution.catalog";
export declare const EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID = "plane.execution.bootstrap";
export interface ExecutionPlaneBootstrap {
    readonly planeId: "execution";
    readonly catalog: readonly ExecutionCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof EXECUTION_PLANE_CATALOG_SERVICE_ID, typeof EXECUTION_PLANE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildExecutionPlaneBootstrap(): ExecutionPlaneBootstrap;
export declare function registerExecutionPlaneBootstrap(registry?: ServiceRegistry): ExecutionPlaneBootstrap;
