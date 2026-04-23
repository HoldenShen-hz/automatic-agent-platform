import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { type ComplianceCapabilityBaseline } from "./compliance/compliance-bootstrap.js";
import { type ModelGatewayCapabilityBaseline } from "./model-gateway/model-gateway-bootstrap.js";
import { type HarnessCapabilityBaseline } from "./orchestration/harness/harness-bootstrap.js";
import { type PromptEngineCapabilityBaseline } from "./prompt-engine/prompt-engine-bootstrap.js";
export declare const AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID = "aiops.runtime.catalog";
export interface AiOperationsRuntimeCatalog {
    readonly modelGateway: readonly ModelGatewayCapabilityBaseline[];
    readonly promptEngine: readonly PromptEngineCapabilityBaseline[];
    readonly compliance: readonly ComplianceCapabilityBaseline[];
    readonly harness: readonly HarnessCapabilityBaseline[];
}
export declare function buildAiOperationsRuntimeCatalog(): AiOperationsRuntimeCatalog;
export declare function registerAiOperationsRuntimeCatalog(registry?: ServiceRegistry): AiOperationsRuntimeCatalog;
