import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { type ScaleCapabilityBaseline } from "./scale-baseline-catalog.js";
export type { ScaleCapabilityBaseline } from "./scale-baseline-catalog.js";
export declare const SCALE_CATALOG_SERVICE_ID = "w4.scale.catalog";
export declare const SCALE_BOOTSTRAP_SERVICE_ID = "w4.scale.bootstrap";
export interface ScaleBootstrap {
    readonly capabilityGroupId: "scale-ecosystem";
    readonly catalog: readonly ScaleCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof SCALE_CATALOG_SERVICE_ID, typeof SCALE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildScaleBootstrap(): ScaleBootstrap;
export declare function registerScaleBootstrap(registry?: ServiceRegistry): ScaleBootstrap;
