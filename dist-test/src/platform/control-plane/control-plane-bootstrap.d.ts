import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type ControlPlaneCapabilityBaseline } from "./control-plane-baseline.js";
export type { ControlPlaneCapabilityBaseline } from "./control-plane-baseline.js";
export declare const CONTROL_PLANE_CATALOG_SERVICE_ID = "plane.control.catalog";
export declare const CONTROL_PLANE_BOOTSTRAP_SERVICE_ID = "plane.control.bootstrap";
export interface ControlPlaneBootstrap {
    readonly planeId: "control-plane";
    readonly catalog: readonly ControlPlaneCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof CONTROL_PLANE_CATALOG_SERVICE_ID, typeof CONTROL_PLANE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildControlPlaneBootstrap(): ControlPlaneBootstrap;
export declare function registerControlPlaneBootstrap(registry?: ServiceRegistry): ControlPlaneBootstrap;
