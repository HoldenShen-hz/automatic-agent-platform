import { ServiceRegistry } from "../platform/shared/lifecycle/service-registry.js";
import { type InteractionCapabilityBaseline } from "./interaction-baseline-catalog.js";
export type { InteractionCapabilityBaseline } from "./interaction-baseline-catalog.js";
export declare const INTERACTION_CATALOG_SERVICE_ID = "w3.interaction.catalog";
export declare const INTERACTION_BOOTSTRAP_SERVICE_ID = "w3.interaction.bootstrap";
export interface InteractionBootstrap {
    readonly capabilityGroupId: "interaction";
    readonly catalog: readonly InteractionCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof INTERACTION_CATALOG_SERVICE_ID, typeof INTERACTION_BOOTSTRAP_SERVICE_ID];
}
export declare function buildInteractionBootstrap(): InteractionBootstrap;
export declare function registerInteractionBootstrap(registry?: ServiceRegistry): InteractionBootstrap;
