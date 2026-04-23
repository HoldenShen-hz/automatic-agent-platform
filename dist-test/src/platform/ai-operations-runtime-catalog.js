import { ServiceRegistry } from "./shared/lifecycle/service-registry.js";
import { registerComplianceBootstrap, } from "./compliance/compliance-bootstrap.js";
import { registerModelGatewayBootstrap, } from "./model-gateway/model-gateway-bootstrap.js";
import { registerHarnessBootstrap, } from "./orchestration/harness/harness-bootstrap.js";
import { registerPromptEngineBootstrap, } from "./prompt-engine/prompt-engine-bootstrap.js";
export const AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID = "aiops.runtime.catalog";
export function buildAiOperationsRuntimeCatalog() {
    return {
        modelGateway: registerModelGatewayBootstrap().catalog,
        promptEngine: registerPromptEngineBootstrap().catalog,
        compliance: registerComplianceBootstrap().catalog,
        harness: registerHarnessBootstrap().catalog,
    };
}
export function registerAiOperationsRuntimeCatalog(registry = ServiceRegistry.getInstance()) {
    const modelGateway = registerModelGatewayBootstrap(registry).catalog;
    const promptEngine = registerPromptEngineBootstrap(registry).catalog;
    const compliance = registerComplianceBootstrap(registry).catalog;
    const harness = registerHarnessBootstrap(registry).catalog;
    registry.register(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID, {
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
    return registry.get(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID);
}
//# sourceMappingURL=ai-operations-runtime-catalog.js.map