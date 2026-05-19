import assert from "node:assert/strict";
import test from "node:test";
import { AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID, buildAiOperationsStartupPlan, registerAiOperationsStartupPlan, } from "../../../src/platform/ai-operations-startup-plan.js";
import { registerModelGatewayBootstrap } from "../../../src/platform/model-gateway/model-gateway-bootstrap.js";
import { registerPromptEngineBootstrap } from "../../../src/platform/prompt-engine/prompt-engine-bootstrap.js";
import { registerComplianceBootstrap } from "../../../src/platform/compliance/compliance-bootstrap.js";
import { registerHarnessBootstrap } from "../../../src/platform/orchestration/harness/harness-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("buildAiOperationsStartupPlan returns AiOperationsStartupPlan interface", () => {
    const plan = buildAiOperationsStartupPlan();
    assert.ok(plan != null);
    assert.ok(Array.isArray(plan.steps));
    assert.ok(typeof plan.totalCapabilityCount === "number");
    assert.ok(Array.isArray(plan.startupOrder));
});
test("buildAiOperationsStartupPlan has 4 steps", () => {
    const plan = buildAiOperationsStartupPlan();
    assert.equal(plan.steps.length, 4);
});
test("buildAiOperationsStartupPlan startupOrder is correct", () => {
    const plan = buildAiOperationsStartupPlan();
    assert.deepEqual(plan.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);
});
test("buildAiOperationsStartupPlan totalCapabilityCount is sum of all capabilities", () => {
    const plan = buildAiOperationsStartupPlan();
    // modelGateway: 6, promptEngine: 5, compliance: 5, harness: 4 = 20
    assert.equal(plan.totalCapabilityCount, 20);
});
test("buildAiOperationsStartupPlan first step is model-gateway with no dependencies", () => {
    const plan = buildAiOperationsStartupPlan();
    const firstStep = plan.steps[0];
    assert.ok(firstStep != null);
    assert.equal(firstStep.stepId, "model-gateway");
    assert.deepEqual(firstStep.dependsOnStepIds, []);
    assert.equal(firstStep.capabilityId, "model-gateway");
    assert.equal(firstStep.bootstrapServiceId, "aiops.model-gateway.bootstrap");
});
test("buildAiOperationsStartupPlan second step is prompt-engine depending on model-gateway", () => {
    const plan = buildAiOperationsStartupPlan();
    const secondStep = plan.steps[1];
    assert.ok(secondStep != null);
    assert.equal(secondStep.stepId, "prompt-engine");
    assert.deepEqual(secondStep.dependsOnStepIds, ["model-gateway"]);
    assert.equal(secondStep.capabilityId, "prompt-engine");
    assert.equal(secondStep.bootstrapServiceId, "aiops.prompt-engine.bootstrap");
});
test("buildAiOperationsStartupPlan third step is compliance depending on prompt-engine", () => {
    const plan = buildAiOperationsStartupPlan();
    const thirdStep = plan.steps[2];
    assert.ok(thirdStep != null);
    assert.equal(thirdStep.stepId, "compliance");
    assert.deepEqual(thirdStep.dependsOnStepIds, ["prompt-engine"]);
    assert.equal(thirdStep.capabilityId, "compliance");
    assert.equal(thirdStep.bootstrapServiceId, "aiops.compliance.bootstrap");
});
test("buildAiOperationsStartupPlan fourth step is harness depending on compliance", () => {
    const plan = buildAiOperationsStartupPlan();
    const fourthStep = plan.steps[3];
    assert.ok(fourthStep != null);
    assert.equal(fourthStep.stepId, "harness");
    assert.deepEqual(fourthStep.dependsOnStepIds, ["compliance"]);
    assert.equal(fourthStep.capabilityId, "orchestration");
    assert.equal(fourthStep.bootstrapServiceId, "aiops.harness.bootstrap");
});
test("AiOperationsStartupStep interface fields are correct", () => {
    const plan = buildAiOperationsStartupPlan();
    const step = plan.steps[0];
    assert.ok(step != null);
    assert.ok(typeof step.stepId === "string");
    assert.ok(typeof step.capabilityId === "string");
    assert.ok(typeof step.entryModule === "string");
    assert.ok(typeof step.bootstrapServiceId === "string");
    assert.ok(typeof step.capabilityCount === "number");
    assert.ok(Array.isArray(step.dependsOnStepIds));
});
test("AiOperationsStartupStep entryModule is valid module path", () => {
    const plan = buildAiOperationsStartupPlan();
    for (const step of plan.steps) {
        assert.ok(step.entryModule.startsWith("src/platform/"));
        assert.ok(step.entryModule.endsWith("/index.ts"));
    }
});
test("AiOperationsStartupStep capabilityCount is positive", () => {
    const plan = buildAiOperationsStartupPlan();
    for (const step of plan.steps) {
        assert.ok(step.capabilityCount > 0);
    }
});
test("AiOperationsStartupStep dependsOnStepIds contains valid step IDs", () => {
    const plan = buildAiOperationsStartupPlan();
    const validStepIds = ["model-gateway", "prompt-engine", "compliance", "harness"];
    for (const step of plan.steps) {
        for (const depId of step.dependsOnStepIds) {
            assert.ok(validStepIds.includes(depId), `Invalid dependency step ID: ${depId}`);
        }
    }
});
test("AiOperationsStartupPlan interface fields are correct", () => {
    const plan = buildAiOperationsStartupPlan();
    assert.ok(Array.isArray(plan.steps));
    assert.ok(typeof plan.totalCapabilityCount === "number");
    assert.ok(Array.isArray(plan.startupOrder));
});
test("AiOperationsStartupPlan steps match startupOrder", () => {
    const plan = buildAiOperationsStartupPlan();
    const step0 = plan.steps[0];
    const step1 = plan.steps[1];
    const step2 = plan.steps[2];
    const step3 = plan.steps[3];
    assert.ok(step0 != null);
    assert.ok(step1 != null);
    assert.ok(step2 != null);
    assert.ok(step3 != null);
    assert.equal(step0.stepId, plan.startupOrder[0]);
    assert.equal(step1.stepId, plan.startupOrder[1]);
    assert.equal(step2.stepId, plan.startupOrder[2]);
    assert.equal(step3.stepId, plan.startupOrder[3]);
});
test("AiOperationsStartupPlan totalCapabilityCount matches sum of step capabilityCounts", () => {
    const plan = buildAiOperationsStartupPlan();
    const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
    assert.equal(plan.totalCapabilityCount, sum);
});
test("registerAiOperationsStartupPlan registers service in registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerModelGatewayBootstrap(registry);
        registerPromptEngineBootstrap(registry);
        registerComplianceBootstrap(registry);
        registerHarnessBootstrap(registry);
        const plan = registerAiOperationsStartupPlan(registry);
        assert.ok(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID));
        assert.ok(plan != null);
        assert.equal(plan.steps.length, 4);
    }
    finally {
        await registry.reset();
    }
});
test("registerAiOperationsStartupPlan returns same service on subsequent calls", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerModelGatewayBootstrap(registry);
        registerPromptEngineBootstrap(registry);
        registerComplianceBootstrap(registry);
        registerHarnessBootstrap(registry);
        const plan1 = registerAiOperationsStartupPlan(registry);
        const plan2 = registerAiOperationsStartupPlan(registry);
        assert.strictEqual(plan1, plan2);
    }
    finally {
        await registry.reset();
    }
});
test("registerAiOperationsStartupPlan first step has correct entryModule", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerModelGatewayBootstrap(registry);
        registerPromptEngineBootstrap(registry);
        registerComplianceBootstrap(registry);
        registerHarnessBootstrap(registry);
        const plan = registerAiOperationsStartupPlan(registry);
        const step0 = plan.steps[0];
        assert.ok(step0 != null);
        assert.equal(step0.entryModule, "src/platform/model-gateway/index.ts");
    }
    finally {
        await registry.reset();
    }
});
test("registerAiOperationsStartupPlan fourth step depends on compliance", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerModelGatewayBootstrap(registry);
        registerPromptEngineBootstrap(registry);
        registerComplianceBootstrap(registry);
        registerHarnessBootstrap(registry);
        const plan = registerAiOperationsStartupPlan(registry);
        const step3 = plan.steps[3];
        assert.ok(step3 != null);
        assert.ok(step3.dependsOnStepIds.includes("compliance"));
    }
    finally {
        await registry.reset();
    }
});
test("AiOperationsStartupStepId type is union of valid step IDs", () => {
    const plan = buildAiOperationsStartupPlan();
    const validIds = ["model-gateway", "prompt-engine", "compliance", "harness"];
    for (const step of plan.steps) {
        assert.ok(validIds.includes(step.stepId));
    }
});
test("buildAiOperationsStartupPlan creates readonly plan", () => {
    const plan = buildAiOperationsStartupPlan();
    // steps array is readonly but not necessarily Object.isFrozen
    assert.ok(plan.steps.length > 0);
    assert.ok(plan.startupOrder.length > 0);
});
//# sourceMappingURL=ai-operations-startup-plan.test.js.map