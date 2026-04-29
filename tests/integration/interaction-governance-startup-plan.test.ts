import assert from "node:assert/strict";
import test from "node:test";

import {
  buildInteractionGovernanceStartupPlan,
  registerInteractionGovernanceStartupPlan,
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID,
  INTERACTION_GOVERNANCE_STARTUP_PLAN_SERVICE_ID as SERVICE_ID,
  type InteractionGovernanceStartupPlan,
} from "../../src/interaction-governance-startup-plan.js";
import { registerInteractionBootstrap } from "../../src/interaction/interaction-bootstrap.js";
import { registerGovernanceBootstrap } from "../../src/org-governance/governance-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("integration: registerInteractionGovernanceStartupPlan wires bootstrap dependencies correctly", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan = registerInteractionGovernanceStartupPlan(registry);

    assert.ok(plan instanceof Object);
    assert.equal(plan.steps.length, 2);
    assert.equal(registry.isInitialized(SERVICE_ID), true);
    assert.equal(registry.isInitialized("w3.interaction.bootstrap"), true);
    assert.equal(registry.isInitialized("w3.governance.bootstrap"), true);
  } finally {
    await registry.reset();
  }
});

test("integration: startup plan is retrievable from registry after registration", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    registerInteractionGovernanceStartupPlan(registry);

    const retrieved = registry.get<InteractionGovernanceStartupPlan>(SERVICE_ID);
    assert.deepEqual(retrieved.startupOrder, ["interaction", "org-governance"]);
  } finally {
    await registry.reset();
  }
});

test("integration: interaction step bootstrapServiceId is correct", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan = registerInteractionGovernanceStartupPlan(registry);

    const interactionStep = plan.steps.find((s) => s.stepId === "interaction");
    assert.ok(interactionStep);
    assert.equal(interactionStep.bootstrapServiceId, "w3.interaction.bootstrap");
  } finally {
    await registry.reset();
  }
});

test("integration: org-governance step bootstrapServiceId is correct", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    const plan = registerInteractionGovernanceStartupPlan(registry);

    const governanceStep = plan.steps.find((s) => s.stepId === "org-governance");
    assert.ok(governanceStep);
    assert.equal(governanceStep.bootstrapServiceId, "w3.governance.bootstrap");
  } finally {
    await registry.reset();
  }
});

test("integration: registry tracks all registered service IDs", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    registerInteractionGovernanceStartupPlan(registry);

    assert.equal(registry.isInitialized("w3.interaction.catalog"), true);
    assert.equal(registry.isInitialized("w3.governance.catalog"), true);
    assert.equal(registry.isInitialized("w3.interaction.bootstrap"), true);
    assert.equal(registry.isInitialized("w3.governance.bootstrap"), true);
    assert.equal(registry.isInitialized(SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("integration: reset clears all registered services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerInteractionBootstrap(registry);
    registerGovernanceBootstrap(registry);
    registerInteractionGovernanceStartupPlan(registry);
  } finally {
    await registry.reset();
  }

  assert.equal(registry.isInitialized(SERVICE_ID), false);
  assert.equal(registry.isInitialized("w3.interaction.bootstrap"), false);
  assert.equal(registry.isInitialized("w3.governance.bootstrap"), false);
});
