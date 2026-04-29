import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInteractionGovernanceStartupPlan,
  registerInteractionGovernanceStartupPlan,
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
  type InteractionGovernanceStartupPlan,
  type InteractionGovernanceStartupStep,
} from "../../src/interaction-governance-startup-plan.js";
import { registerInteractionBootstrap } from "../../src/interaction/interaction-bootstrap.js";
import { registerGovernanceBootstrap } from "../../src/org-governance/governance-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("buildInteractionGovernanceStartupPlan returns correct structure", () => {
  const plan = buildInteractionGovernanceStartupPlan();

  assert.equal(typeof plan.totalCapabilityCount, "number");
  assert.ok(plan.totalCapabilityCount > 0);
  assert.deepEqual(plan.steps.length, 2);
});

test("interaction-governance startup plan has correct startup order", () => {
  const plan = buildInteractionGovernanceStartupPlan();

  assert.deepEqual(plan.startupOrder, ["interaction", "org-governance"]);
});

test("first step is interaction with no dependencies", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  const interactionStep = plan.steps[0];

  assert.equal(interactionStep?.stepId, "interaction");
  assert.equal(interactionStep?.dependsOnStepIds.length, 0);
  assert.equal(interactionStep?.entryModule, "src/interaction/index.ts");
  assert.equal(interactionStep?.bootstrapServiceId, "w3.interaction.bootstrap");
  assert.ok(interactionStep?.capabilityCount > 0);
});

test("second step is org-governance depending on interaction", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  const governanceStep = plan.steps[1];

  assert.equal(governanceStep?.stepId, "org-governance");
  assert.deepEqual(governanceStep?.dependsOnStepIds, ["interaction"]);
  assert.equal(governanceStep?.entryModule, "src/org-governance/index.ts");
  assert.equal(governanceStep?.bootstrapServiceId, "w3.governance.bootstrap");
  assert.ok(governanceStep?.capabilityCount > 0);
});

test("totalCapabilityCount equals sum of step capabilityCounts", () => {
  const plan = buildInteractionGovernanceStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);

  assert.equal(plan.totalCapabilityCount, sum);
});

test("registerInteractionGovernanceStartupPlan registers and returns plan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan = registerInteractionGovernanceStartupPlan(registry);

    assert.ok(plan instanceof Object);
    assert.equal(plan.steps.length, 2);
    assert.equal(registry.isInitialized(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registered plan returns same instance on subsequent calls", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan1 = registerInteractionGovernanceStartupPlan(registry);
    const plan2 = registry.get<InteractionGovernanceStartupPlan>(INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID);

    assert.equal(plan1, plan2);
  } finally {
    await registry.reset();
  }
});

test("each step has correct structure", () => {
  const plan = buildInteractionGovernanceStartupPlan();

  for (const step of plan.steps) {
    assert.equal(typeof step.stepId, "string");
    assert.equal(typeof step.entryModule, "string");
    assert.equal(typeof step.bootstrapServiceId, "string");
    assert.equal(typeof step.capabilityCount, "number");
    assert.ok(Array.isArray(step.dependsOnStepIds));
  }
});
