import assert from "node:assert/strict";
import test from "node:test";
import { buildAiOperationsRuntimeCatalog, buildAiOperationsStartupPlan, buildFivePlaneRuntimeCatalog, buildModelGatewayBootstrap, registerAiOperationsRuntimeCatalog, registerFivePlaneRuntimeOrchestrator, buildFivePlaneStartupPlan, buildInterfacePlaneBootstrap, HarnessRuntimeService, PromptTemplateRegistryService, registerPlatformSurfaceCatalog, WebhookIngressService, ExecutionLeaseService, HaCoordinatorService, TransitionService, HitlApprovalOrchestrationService, OapeflirLoopService, TaskDecompositionService, } from "../../../src/platform/index.js";
test("platform root barrel exposes canonical cross-surface capabilities", () => {
    assert.equal(typeof registerPlatformSurfaceCatalog, "function");
    assert.equal(typeof buildAiOperationsRuntimeCatalog, "function");
    assert.equal(typeof registerAiOperationsRuntimeCatalog, "function");
    assert.equal(typeof buildAiOperationsStartupPlan, "function");
    assert.equal(typeof buildFivePlaneRuntimeCatalog, "function");
    assert.equal(typeof buildModelGatewayBootstrap, "function");
    assert.equal(typeof registerFivePlaneRuntimeOrchestrator, "function");
    assert.equal(typeof buildFivePlaneStartupPlan, "function");
    assert.equal(typeof buildInterfacePlaneBootstrap, "function");
    assert.equal(typeof WebhookIngressService, "function");
    assert.equal(typeof PromptTemplateRegistryService, "function");
    assert.equal(typeof HarnessRuntimeService, "function");
});
test("platform root barrel exports execution services", () => {
    assert.equal(typeof ExecutionLeaseService, "function");
    assert.equal(typeof HaCoordinatorService, "function");
    assert.equal(typeof TransitionService, "function");
});
test("platform root barrel exports orchestration services", () => {
    assert.equal(typeof HitlApprovalOrchestrationService, "function");
    assert.equal(typeof OapeflirLoopService, "function");
    assert.equal(typeof TaskDecompositionService, "function");
});
//# sourceMappingURL=index.test.js.map