import assert from "node:assert/strict";
import test from "node:test";
import { buildDomainsStartupPlan, registerDomainsStartupPlan, DOMAINS_STARTUP_PLAN_SERVICE_ID, } from "../../src/domains-startup-plan.js";
import { registerDomainsBootstrap } from "../../src/domains/domains-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
test("domains startup plan captures canonical W5 startup order", () => {
    const plan = buildDomainsStartupPlan();
    assert.deepEqual(plan.startupOrder, ["ring1", "ring2", "ring3"]);
    assert.equal(plan.totalCapabilityCount, 31);
    assert.equal(plan.steps[2]?.capabilityCount, 12);
});
test("domains startup plan registers after W5 bootstraps are available", async () => {
    const registry = ServiceRegistry.getInstance();
    try {
        registerDomainsBootstrap(registry);
        const plan = registerDomainsStartupPlan(registry);
        assert.equal(plan.steps[0]?.entryModule, "src/domains/index.ts");
        assert.equal(plan.steps[1]?.dependsOnStepIds.includes("ring1"), true);
        assert.equal(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID), true);
    }
    finally {
        await registry.reset();
    }
});
//# sourceMappingURL=domains-startup-plan.test.js.map