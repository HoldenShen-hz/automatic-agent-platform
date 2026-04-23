import { ServiceRegistry } from "../shared/lifecycle/service-registry.js";
import { listPromptEngineCapabilityBaselines, } from "./prompt-engine-baseline.js";
export const PROMPT_ENGINE_CATALOG_SERVICE_ID = "aiops.prompt-engine.catalog";
export const PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID = "aiops.prompt-engine.bootstrap";
export function buildPromptEngineBootstrap() {
    return {
        capabilityGroupId: "prompt-engine",
        catalog: listPromptEngineCapabilityBaselines(),
        registeredServiceIds: [PROMPT_ENGINE_CATALOG_SERVICE_ID, PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID],
    };
}
export function registerPromptEngineBootstrap(registry = ServiceRegistry.getInstance()) {
    registry.register(PROMPT_ENGINE_CATALOG_SERVICE_ID, {
        init: () => listPromptEngineCapabilityBaselines(),
    });
    registry.register(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID, {
        init: () => buildPromptEngineBootstrap(),
        dependsOn: [PROMPT_ENGINE_CATALOG_SERVICE_ID],
    });
    return registry.get(PROMPT_ENGINE_BOOTSTRAP_SERVICE_ID);
}
//# sourceMappingURL=prompt-engine-bootstrap.js.map