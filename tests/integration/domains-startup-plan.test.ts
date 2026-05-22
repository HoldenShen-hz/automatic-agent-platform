import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDomainsStartupPlan,
  registerDomainsStartupPlan,
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
  type DomainsStartupPlan,
} from "../../src/domains-startup-plan.js";
import {
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
  registerDomainsBootstrap,
  type DomainRingBootstrap,
} from "../../src/domains/domains-bootstrap.js";
import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";

test("buildDomainsStartupPlan returns correct structure", () => {
  const plan = buildDomainsStartupPlan();

  assert.equal(typeof plan.totalCapabilityCount, "number");
  assert.ok(plan.totalCapabilityCount >= 0);
  assert.equal(plan.steps.length, 3);
  assert.deepEqual(plan.startupOrder.length, 3);
});

test("domains startup plan has correct ring order", () => {
  const plan = buildDomainsStartupPlan();

  assert.deepEqual(plan.startupOrder, ["ring1", "ring2", "ring3"]);
});

test("ring1 has no dependencies", () => {
  const plan = buildDomainsStartupPlan();
  const ring1 = plan.steps[0];
  if (!ring1) return;

  assert.equal(ring1.stepId, "ring1");
  assert.deepEqual(ring1.dependsOnStepIds, []);
});

test("ring2 depends on ring1", () => {
  const plan = buildDomainsStartupPlan();
  const ring2 = plan.steps[1];
  if (!ring2) return;

  assert.equal(ring2.stepId, "ring2");
  assert.deepEqual(ring2.dependsOnStepIds, ["ring1"]);
});

test("ring3 depends on ring2", () => {
  const plan = buildDomainsStartupPlan();
  const ring3 = plan.steps[2];
  if (!ring3) return;

  assert.equal(ring3.stepId, "ring3");
  assert.deepEqual(ring3.dependsOnStepIds, ["ring2"]);
});

test("totalCapabilityCount equals sum of step capabilityCounts", () => {
  const plan = buildDomainsStartupPlan();
  const sum = plan.steps.reduce((acc, step) => acc + step.capabilityCount, 0);

  assert.equal(plan.totalCapabilityCount, sum);
});

test("registerDomainsStartupPlan registers and returns plan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerDomainsBootstrap(registry);
    const plan = registerDomainsStartupPlan(registry);

    assert.ok(plan instanceof Object);
    assert.equal(plan.steps.length, 3);
    assert.equal(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registered plan returns same instance on subsequent calls", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerDomainsBootstrap(registry);
    const plan1 = registerDomainsStartupPlan(registry);
    const plan2 = registry.get<DomainsStartupPlan>(DOMAINS_STARTUP_PLAN_SERVICE_ID);

    assert.equal(plan1, plan2);
  } finally {
    await registry.reset();
  }
});

test("registerDomainsStartupPlan does not override ring bootstrap registrations", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerDomainsBootstrap(registry);
    const ringBootstrapBefore = registry.get<DomainRingBootstrap>(
      DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1,
    );

    registerDomainsStartupPlan(registry);

    const ringBootstrapAfter = registry.get<DomainRingBootstrap>(
      DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1,
    );

    assert.equal(ringBootstrapAfter, ringBootstrapBefore);
    assert.equal(ringBootstrapAfter.ringId, "ring1");
    assert.ok(Array.isArray(ringBootstrapAfter.baselines));
  } finally {
    await registry.reset();
  }
});

test("each step has correct structure and bootstrapServiceId", () => {
  const plan = buildDomainsStartupPlan();
  const expectedServiceIds = ["w5.domains.ring.ring1.bootstrap", "w5.domains.ring.ring2.bootstrap", "w5.domains.ring.ring3.bootstrap"];

  for (let i = 0; i < plan.steps.length; i++) {
    const step = plan.steps[i];
    if (!step) continue;
    assert.equal(typeof step.stepId, "string");
    assert.equal(typeof step.entryModule, "string");
    assert.equal(typeof step.bootstrapServiceId, "string");
    assert.equal(step.bootstrapServiceId, expectedServiceIds[i]);
    assert.equal(typeof step.capabilityCount, "number");
    assert.ok(Array.isArray(step.dependsOnStepIds));
  }
});
