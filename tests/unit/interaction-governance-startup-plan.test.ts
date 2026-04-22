import assert from "node:assert/strict";
import test from "node:test";

import {
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
  buildInteractionGovernanceStartupPlan,
  registerInteractionGovernanceStartupPlan,
} from "../../src/interaction-governance-startup-plan.js";
import { registerInteractionBootstrap } from "../../src/interaction/interaction-bootstrap.js";
import { registerGovernanceBootstrap } from "../../src/org-governance/governance-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("interaction-governance startup plan captures canonical W3 startup order", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  assert.deepEqual(plan.startupOrder, ["interaction", "org-governance"]);
  assert.equal(plan.totalCapabilityCount, 12);
  assert.equal(plan.steps[1]?.bootstrapServiceId, "w3.governance.bootstrap");
});

test("interaction-governance startup plan registers after W3 bootstraps are available", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan = registerInteractionGovernanceStartupPlan(registry);
    assert.equal(plan.steps[0]?.entryModule, "src/interaction/index.ts");
    assert.equal(plan.steps[1]?.dependsOnStepIds.includes("interaction"), true);
    assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});
