import { ServiceRegistry } from "./platform/shared/lifecycle/service-registry.js";
import { type ScaleCapabilityBaseline } from "./scale-ecosystem/scale-bootstrap.js";
import { type OpsMaturityCapabilityBaseline } from "./ops-maturity/ops-maturity-bootstrap.js";
export declare const SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID = "w4.runtime.catalog";
export interface ScaleOpsRuntimeCatalog {
    readonly scaleEcosystem: readonly ScaleCapabilityBaseline[];
    readonly opsMaturity: readonly OpsMaturityCapabilityBaseline[];
}
export declare function buildScaleOpsRuntimeCatalog(): ScaleOpsRuntimeCatalog;
export declare function registerScaleOpsRuntimeCatalog(registry?: ServiceRegistry): ScaleOpsRuntimeCatalog;
