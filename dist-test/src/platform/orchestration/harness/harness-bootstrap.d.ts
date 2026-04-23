import { ServiceRegistry } from "../../shared/lifecycle/service-registry.js";
import { type HarnessCapabilityBaseline } from "./harness-baseline.js";
export type { HarnessCapabilityBaseline } from "./harness-baseline.js";
export declare const HARNESS_CATALOG_SERVICE_ID = "aiops.harness.catalog";
export declare const HARNESS_BOOTSTRAP_SERVICE_ID = "aiops.harness.bootstrap";
export interface HarnessBootstrap {
    readonly capabilityGroupId: "harness";
    readonly catalog: readonly HarnessCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof HARNESS_CATALOG_SERVICE_ID, typeof HARNESS_BOOTSTRAP_SERVICE_ID];
}
export declare function buildHarnessBootstrap(): HarnessBootstrap;
export declare function registerHarnessBootstrap(registry?: ServiceRegistry): HarnessBootstrap;
