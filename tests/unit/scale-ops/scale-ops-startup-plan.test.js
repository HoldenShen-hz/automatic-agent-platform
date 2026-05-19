import assert from "node:assert/strict";
import test from "node:test";
import { buildScaleOpsStartupPlan, registerScaleOpsStartupPlan, SCALE_OPS_STARTUP_PLAN_SERVICE_ID, } from "../../../src/scale-ops-startup-plan.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("buildScaleOpsStartupPlan returns plan with two steps", () => {
    const plan = buildScaleOpsStartupPlan();
    assert.equal(plan.steps.length, 2);
});
test("buildScaleOpsStartupPlan has scale-ecosystem and ops-maturity steps", () => {
    const plan = buildScaleOpsStartupPlan();
    const stepIds = plan.steps.map((s) => s.stepId);
    assert.ok(stepIds.includes("scale-ecosystem"));
    assert.ok(stepIds.includes("ops-maturity"));
});
test("buildScaleOpsStartupPlan step order matches startupOrder", () => {
    const plan = buildScaleOpsStartupPlan();
    assert.deepEqual(plan.startupOrder, ["scale-ecosystem", "ops-maturity"]);
});
test("buildScaleOpsStartupPlan totalCapabilityCount is sum of step counts", () => {
    const plan = buildScaleOpsStartupPlan();
    const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);
    assert.equal(plan.totalCapabilityCount, sum);
});
test("buildScaleOpsStartupPlan ops-maturity depends on scale-ecosystem", () => {
    const plan = buildScaleOpsStartupPlan();
    const opsMaturityStep = plan.steps.find((s) => s.stepId === "ops-maturity");
    assert.ok(opsMaturityStep);
    assert.deepEqual(opsMaturityStep.dependsOnStepIds, ["scale-ecosystem"]);
});
test("buildScaleOpsStartupPlan scale-ecosystem has no dependencies", () => {
    const plan = buildScaleOpsStartupPlan();
    const scaleStep = plan.steps.find((s) => s.stepId === "scale-ecosystem");
    assert.ok(scaleStep);
    assert.deepEqual(scaleStep.dependsOnStepIds, []);
});
test("buildScaleOpsStartupPlan step entryModule paths are non-empty strings", () => {
    const plan = buildScaleOpsStartupPlan();
    for (const step of plan.steps) {
        assert.ok(typeof step.entryModule === "string");
        assert.ok(step.entryModule.length > 0);
    }
});
test("buildScaleOpsStartupPlan step bootstrapServiceIds are non-empty strings", () => {
    const plan = buildScaleOpsStartupPlan();
    for (const step of plan.steps) {
        assert.ok(typeof step.bootstrapServiceId === "string");
        assert.ok(step.bootstrapServiceId.length > 0);
    }
});
test("registerScaleOpsStartupPlan registers service in registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const plan = registerScaleOpsStartupPlan(registry);
        assert.equal(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID), true);
        assert.ok(Array.isArray(plan.steps));
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsStartupPlan returns same instance from registry", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        const first = registerScaleOpsStartupPlan(registry);
        const second = registry.get(SCALE_OPS_STARTUP_PLAN_SERVICE_ID);
        assert.equal(first, second);
    }
    finally {
        await registry.reset();
    }
});
test("registerScaleOpsStartupPlan depends on bootstrap services", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerScaleOpsStartupPlan(registry);
        assert.ok(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID));
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=scale-ops-startup-plan.test.js.map