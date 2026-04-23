import assert from "node:assert/strict";
import test from "node:test";
import { buildFivePlaneStartupPlan, FIVE_PLANE_STARTUP_PLAN_SERVICE_ID, registerFivePlaneStartupPlan, } from "../../../src/platform/five-plane-startup-plan.js";
import { registerFivePlaneRuntimeCatalog } from "../../../src/platform/five-plane-runtime-bootstrap.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";
test("five-plane startup plan captures the canonical startup order", () => {
    const plan = buildFivePlaneStartupPlan();
    assert.deepEqual(plan.startupOrder, [
        "interface",
        "control-plane",
        "orchestration",
        "execution",
        "state-evidence",
    ]);
    assert.equal(plan.totalCapabilityCount, 50);
    assert.equal(plan.steps[2]?.bootstrapServiceId, "plane.orchestration.bootstrap");
});
test("five-plane startup plan registers after plane bootstraps are available", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerFivePlaneRuntimeCatalog(registry);
        const plan = registerFivePlaneStartupPlan(registry);
        assert.equal(plan.steps[0]?.entryModule, "src/platform/interface/index.ts");
        assert.equal(plan.steps[4]?.dependsOnStepIds.includes("execution"), true);
        assert.equal(registry.isInitialized(FIVE_PLANE_STARTUP_PLAN_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=five-plane-startup-plan.test.js.map