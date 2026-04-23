import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { type OpsMaturityCapabilityBaseline } from "./ops-maturity-baseline-catalog.js";
export type { OpsMaturityCapabilityBaseline } from "./ops-maturity-baseline-catalog.js";
export declare const OPS_MATURITY_CATALOG_SERVICE_ID = "w4.ops-maturity.catalog";
export declare const OPS_MATURITY_BOOTSTRAP_SERVICE_ID = "w4.ops-maturity.bootstrap";
export interface OpsMaturityBootstrap {
    readonly capabilityGroupId: "ops-maturity";
    readonly catalog: readonly OpsMaturityCapabilityBaseline[];
    readonly registeredServiceIds: readonly [
        typeof OPS_MATURITY_CATALOG_SERVICE_ID,
        typeof OPS_MATURITY_BOOTSTRAP_SERVICE_ID
    ];
}
export declare function buildOpsMaturityBootstrap(): OpsMaturityBootstrap;
export declare function registerOpsMaturityBootstrap(registry?: ServiceRegistry): OpsMaturityBootstrap;
