import assert from "node:assert/strict";
import test from "node:test";

import {
  buildScaleOpsStartupPlan,
  registerScaleOpsStartupPlan,
  SCALE_OPS_STARTUP_PLAN_SERVICE_ID,
} from "../../src/scale-ops-startup-plan.js";
import { registerScaleBootstrap } from "../../src/scale-ecosystem/scale-bootstrap.js";
import { registerOpsMaturityBootstrap } from "../../src/ops-maturity/ops-maturity-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("scale-ops startup plan captures canonical W4 startup order", () => {
  const plan = buildScaleOpsStartupPlan();
  assert.deepEqual(plan.startupOrder, ["scale-ecosystem", "ops-maturity"]);
  assert.equal(plan.totalCapabilityCount, 18);
  assert.equal(plan.steps[1]?.bootstrapServiceId, "w4.ops-maturity.bootstrap");
});

test("scale-ops startup plan registers after W4 bootstraps are available", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerScaleBootstrap(registry);
    registerOpsMaturityBootstrap(registry);
    const plan = registerScaleOpsStartupPlan(registry);
    assert.equal(plan.steps[0]?.entryModule, "src/scale-ecosystem/index.ts");
    assert.equal(plan.steps[1]?.dependsOnStepIds.includes("scale-ecosystem"), true);
    assert.equal(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
