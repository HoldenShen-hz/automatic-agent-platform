import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type InterfaceCapabilityBaseline } from "./interface-plane-baseline.js";
export type { InterfaceCapabilityBaseline } from "./interface-plane-baseline.js";
export declare const INTERFACE_PLANE_CATALOG_SERVICE_ID = "plane.interface.catalog";
export declare const INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID = "plane.interface.bootstrap";
export interface InterfacePlaneBootstrap {
    readonly planeId: "interface";
    readonly catalog: readonly InterfaceCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof INTERFACE_PLANE_CATALOG_SERVICE_ID, typeof INTERFACE_PLANE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildInterfacePlaneBootstrap(): InterfacePlaneBootstrap;
export declare function registerInterfacePlaneBootstrap(registry?: ServiceRegistry): InterfacePlaneBootstrap;
