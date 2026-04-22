import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import {
  listPromptEngineCapabilityBaselines,
  type PromptEngineCapabilityBaseline,
} from "./prompt-engine-baseline.js";

export type { PromptEngineCapabilityBaseline } from "./prompt-engine-baseline.js";

export const PROMPT_ENGINE_CATALOG_SERVICE_ID = "aiops.prompt-engine.catalog";
export const PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID = "aiops.prompt-engine.bootstrap";

export interface PromptEngineBootstrap {
  readonly capabilityGroupId: "prompt-engine";
  readonly catalog: readonly PromptEngineCapabilityBaseline[];
  readonly registeredServiceIds: readonly [typeof PROMPT_ENGINE_CATALOG_SERVICE_ID, typeof PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID];
}

export function buildPromptEngineBootstrap(): PromptEngineBootstrap {
  return {
    capabilityGroupId: "prompt-engine",
    catalog: listPromptEngineCapabilityBaselines(),
    registeredServiceIds: [PROMPT_ENGINE_CATALOG_SERVICE_ID, PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID],
  };
}

export function registerPromptEngineBootstrap(
  registry: ServiceRegistry = ServiceRegistry.getInstance(),
): PromptEngineBootstrap {
  registry.register<readonly PromptEngineCapabilityBaseline[]>(PROMPT_ENGINE_CATALOG_SERVICE_ID, {
    init: () => listPromptEngineCapabilityBaselines(),
  });
  registry.register<PromptEngineBootstrap>(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, {
    init: () => buildPromptEngineBootstrap(),
    dependsOn: [PROMPT_ENGINE_CATALOG_SERVICE_ID],
  });
  return registry.get<PromptEngineBootstrap>(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID);
}
