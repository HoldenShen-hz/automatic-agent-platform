import assert from "node:assert/strict";
import test from "node:test";
import { AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID, buildAiOperationsStartupPlan, registerAiOperationsStartupPlan, } from "../../../src/platform/ai-operations-startup-plan.js";
import { registerModelGatewayBootstrap } from "../../../src/platform/model-gateway/model-gateway-bootstrap.js";
import { registerPromptEngineBootstrap } from "../../../src/platform/prompt-engine/prompt-engine-bootstrap.js";
import { registerComplianceBootstrap } from "../../../src/platform/compliance/compliance-bootstrap.js";
import { registerHarnessBootstrap } from "../../../src/platform/orchestration/harness/harness-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("ai operations startup plan captures the canonical startup order", () => {
    const plan = buildAiOperationsStartupPlan();
    assert.deepEqual(plan.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);
    assert.equal(plan.totalCapabilityCount, 20);
    assert.equal(plan.steps[3]?.bootstrapServiceId, "aiops.harness.bootstrap");
});
test("ai operations startup plan registers after bootstrap services are available", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerModelGatewayBootstrap(registry);
        registerPromptEngineBootstrap(registry);
        registerComplianceBootstrap(registry);
        registerHarnessBootstrap(registry);
        const plan = registerAiOperationsStartupPlan(registry);
        assert.equal(plan.steps[0]?.entryModule, "src/platform/model-gateway/index.ts");
        assert.equal(plan.steps[3]?.dependsOnStepIds.includes("compliance"), true);
        assert.equal(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=ai-operations-startup-plan.test.js.map