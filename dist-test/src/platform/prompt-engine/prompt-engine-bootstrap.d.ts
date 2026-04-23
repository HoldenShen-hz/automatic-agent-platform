import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { type PromptEngineCapabilityBaseline } from "./prompt-engine-baseline.js";
export type { PromptEngineCapabilityBaseline } from "./prompt-engine-baseline.js";
export declare const PROMPT_ENGINE_CATALOG_SERVICE_ID = "aiops.prompt-engine.catalog";
export declare const PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID = "aiops.prompt-engine.bootstrap";
export interface PromptEngineBootstrap {
    readonly capabilityGroupId: "prompt-engine";
    readonly catalog: readonly PromptEngineCapabilityBaseline[];
    readonly registeredServiceIds: readonly [typeof PROMPT_ENGINE_CATALOG_SERVICE_ID, typeof PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID];
}
export declare function buildPromptEngineBootstrap(): PromptEngineBootstrap;
export declare function registerPromptEngineBootstrap(registry?: ServiceRegistry): PromptEngineBootstrap;
