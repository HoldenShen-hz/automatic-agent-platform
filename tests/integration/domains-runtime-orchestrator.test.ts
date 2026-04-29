/**
 * Integration Test: Domains Runtime Orchestrator
 *
 * Tests DomainsRuntimeOrchestrator with actual ServiceRegistry integration,
 * including full bootstrap chain, startup plan, and ring initialization.
 */

import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  DomainsRuntimeOrchestrator,
  registerDomainsRuntimeOrchestrator,
  type DomainsRuntimeStartupResult,
  type DomainsReadinessSnapshot,
} from "../../src/domains-runtime-orchestrator.js";
import {
  DOMAINS_BOOTSTRAP_SERVICE_ID,
  DOMAIN_RING_BOOTSTRAP_SERVICE_IDS,
} from "../../src/domains/domains-bootstrap.js";
import {
  DOMAINS_RUNTIME_CATALOG_SERVICE_ID,
} from "../../src/domains-runtime-catalog.js";
import {
  DOMAINS_STARTUP_PLAN_SERVICE_ID,
} from "../../src/domains-startup-plan.js";

test.beforeEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test.afterEach(async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();
});

test("integration: DomainsRuntimeOrchestrator.startup returns complete result structure", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok("ready" in result, "result should have ready field");
  assert.ok("startupOrder" in result, "result should have startupOrder field");
  assert.ok("initializedServiceIds" in result, "result should have initializedServiceIds field");
  assert.ok("steps" in result, "result should have steps field");
  assert.ok(Array.isArray(result.steps), "steps should be an array");
});

test("integration: DomainsRuntimeOrchestrator.startup produces correct ring sequence", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.startupOrder, ["ring1", "ring2", "ring3"]);
});

test("integration: DomainsRuntimeOrchestrator.startup all steps are initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  for (const step of result.steps) {
    assert.equal(step.initialized, true, `step ${step.stepId} should be initialized`);
  }
});

test("integration: DomainsRuntimeOrchestrator.startup first step has no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const firstStep = result.steps[0]!;
  assert.equal(firstStep.stepId, "ring1");
  assert.deepEqual(firstStep.initializedDependencyServiceIds, []);
});

test("integration: DomainsRuntimeOrchestrator.startup second step depends on first ring", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const secondStep = result.steps[1]!;
  assert.equal(secondStep.stepId, "ring2");
  assert.deepEqual(secondStep.initializedDependencyServiceIds, [DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1]);
});

test("integration: DomainsRuntimeOrchestrator.startup third step depends on previously initialized rings", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const thirdStep = result.steps[2]!;
  assert.equal(thirdStep.stepId, "ring3");
  // ring3 depends on ring1 and ring2, but only ring2 is initialized at this point in the loop
  assert.deepEqual(thirdStep.initializedDependencyServiceIds, [DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2]);
});

test("integration: DomainsRuntimeOrchestrator.startup initializedServiceIds contains all ring bootstraps", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok(result.initializedServiceIds.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1));
  assert.ok(result.initializedServiceIds.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2));
  assert.ok(result.initializedServiceIds.includes(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring3));
});

test("integration: DomainsRuntimeOrchestrator.snapshotReadiness returns complete snapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.ok("runtimeCatalogInitialized" in snapshot);
  assert.ok("startupPlanInitialized" in snapshot);
  assert.ok("orchestratorInitialized" in snapshot);
  assert.ok("capabilityReadiness" in snapshot);
  assert.ok(Array.isArray(snapshot.capabilityReadiness));
});

test("integration: DomainsRuntimeOrchestrator.snapshotReadiness all capabilities ready after startup", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.equal(snapshot.orchestratorInitialized, true);
  assert.equal(snapshot.runtimeCatalogInitialized, true);
  assert.equal(snapshot.startupPlanInitialized, true);
  for (const capability of snapshot.capabilityReadiness) {
    assert.equal(capability.initialized, true, `${capability.stepId} should be initialized`);
  }
});

test("integration: DomainsRuntimeOrchestrator.snapshotReadiness capabilityReadiness has all rings", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  const stepIds = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(stepIds.includes("ring1"));
  assert.ok(stepIds.includes("ring2"));
  assert.ok(stepIds.includes("ring3"));
});

test("integration: registerDomainsRuntimeOrchestrator registers orchestrator service", async () => {
  const registry = ServiceRegistry.getInstance();
  registerDomainsRuntimeOrchestrator(registry);

  assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID));
});

test("integration: registerDomainsRuntimeOrchestrator returns orchestrator instance", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerDomainsRuntimeOrchestrator(registry);

  assert.ok(orchestrator instanceof DomainsRuntimeOrchestrator);
});

test("integration: registerDomainsRuntimeOrchestrator startup produces correct result", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true);
  assert.deepEqual(result.startupOrder, ["ring1", "ring2", "ring3"]);
  assert.equal(result.steps.length, 3);
});

test("integration: registerDomainsRuntimeOrchestrator startup step dependencies follow ring order", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.steps[0]!.initializedDependencyServiceIds, []);
  assert.deepEqual(result.steps[1]!.initializedDependencyServiceIds, [DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1]);
  assert.deepEqual(result.steps[2]!.initializedDependencyServiceIds, [DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2]);
});

test("integration: orchestrator depends on all bootstrap, catalog, and startup-plan services", async () => {
  const registry = ServiceRegistry.getInstance();
  registerDomainsRuntimeOrchestrator(registry);
  registry.get(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID);

  assert.ok(registry.isInitialized(DOMAINS_BOOTSTRAP_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_RUNTIME_CATALOG_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAINS_STARTUP_PLAN_SERVICE_ID));
  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1));
  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2));
  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring3));
});

test("integration: DomainsRuntimeOrchestrator.prepare returns plan with ring steps", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan.steps.length > 0);
  assert.deepEqual(plan.startupOrder, ["ring1", "ring2", "ring3"]);
  for (const step of plan.steps) {
    assert.ok("stepId" in step);
    assert.ok("bootstrapServiceId" in step);
    assert.ok("capabilityCount" in step);
    assert.ok("dependsOnStepIds" in step);
  }
});

test("integration: DomainsRuntimeOrchestrator.prepare registers ring bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  orchestrator.prepare();

  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring1));
  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring2));
  assert.ok(registry.isInitialized(DOMAIN_RING_BOOTSTRAP_SERVICE_IDS.ring3));
});

test("integration: startup result steps have correct structure and data", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  for (const step of result.steps) {
    assert.ok("stepId" in step);
    assert.ok("bootstrapServiceId" in step);
    assert.ok("capabilityCount" in step);
    assert.ok("initialized" in step);
    assert.ok("initializedDependencyServiceIds" in step);
    assert.ok(typeof step.stepId === "string");
    assert.ok(typeof step.bootstrapServiceId === "string");
    assert.ok(typeof step.capabilityCount === "number");
    assert.ok(typeof step.initialized === "boolean");
    assert.ok(Array.isArray(step.initializedDependencyServiceIds));
  }
});

test("integration: DomainsRuntimeOrchestrator can be instantiated without arguments", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator();
  assert.ok(orchestrator instanceof DomainsRuntimeOrchestrator);

  const result = orchestrator.startup();
  assert.equal(result.ready, true);
});

test("integration: multiple startups maintain consistent state", async () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new DomainsRuntimeOrchestrator(registry);

  const result1 = orchestrator.startup();
  const result2 = orchestrator.startup();

  assert.deepEqual(result1.startupOrder, result2.startupOrder);
  assert.equal(result1.ready, result2.ready);
  assert.equal(result1.steps.length, result2.steps.length);
});