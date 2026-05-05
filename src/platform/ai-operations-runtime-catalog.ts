import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import {
  registerComplianceBootstrap,
  type ComplianceCapabilityBaseline,
} from "./compliance/compliance-bootstrap.js";
import {
  registerModelGatewayBootstrap,
  type ModelGatewayCapabilityBaseline,
} from "./model-gateway/model-gateway-bootstrap.js";
import {
  registerHarnessBootstrap,
  type HarnessCapabilityBaseline,
} from "./orchestration/harness/harness-bootstrap.js";
import {
  registerPromptEngineBootstrap,
  type PromptEngineCapabilityBaseline,
} from "./prompt-engine/prompt-engine-bootstrap.js";

export const AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID = "aiops.runtime.catalog";

export interface AiOperationsRuntimeCatalog {
  readonly modelGateway: readonly ModelGatewayCapabilityBaseline[];
  readonly promptEngine: readonly PromptEngineCapabilityBaseline[];
  readonly compliance: readonly ComplianceCapabilityBaseline[];
  readonly harness: readonly HarnessCapabilityBaseline[];
}

export function buildAiOperationsRuntimeCatalog(): AiOperationsRuntimeCatalog {
  return {
    modelGateway: registerModelGatewayBootstrap().catalog,
    promptEngine: registerPromptEngineBootstrap().catalog,
    compliance: registerComplianceBootstrap().catalog,
    harness: registerHarnessBootstrap().catalog,
  };
}

export function registerAiOperationsRuntimeCatalog(
  registry: ServiceRegistry = ServiceRegistry.createScoped(),
): AiOperationsRuntimeCatalog {
  const modelGateway = registerModelGatewayBootstrap(registry).catalog;
  const promptEngine = registerPromptEngineBootstrap(registry).catalog;
  const compliance = registerComplianceBootstrap(registry).catalog;
  const harness = registerHarnessBootstrap(registry).catalog;

  registry.register<AiOperationsRuntimeCatalog>(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID, {
    init: () => ({
      modelGateway,
      promptEngine,
      compliance,
      harness,
    }),
    dependsOn: [
      "aiops.model-gateway.bootstrap",
      "aiops.prompt-engine.bootstrap",
      "aiops.compliance.bootstrap",
      "aiops.harness.bootstrap",
    ],
  });

  return registry.get<AiOperationsRuntimeCatalog>(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID);
}
