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

test.beforeEach(async () => {
  await ServiceRegistry.getInstance().reset();
});

test.afterEach(async () => {
  await ServiceRegistry.getInstance().reset();
});

test("DomainsRuntimeOrchestrator constructor accepts optional registry", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be constructed");
});

test("DomainsRuntimeOrchestrator.prepare registers bootstrap, catalog, and startup plan", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan != null, "prepare should return a startup plan");
  assert.ok(Array.isArray(plan.steps), "plan should have steps array");
  assert.ok(plan.steps.length > 0, "plan should have at least one step");
});

test("DomainsRuntimeOrchestrator.prepare returns plan with correct step structure", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  const firstStep = plan.steps[0]!;
  assert.ok("stepId" in firstStep, "step should have stepId");
  assert.ok("bootstrapServiceId" in firstStep, "step should have bootstrapServiceId");
  assert.ok("capabilityCount" in firstStep, "step should have capabilityCount");
  assert.ok("dependsOnStepIds" in firstStep, "step should have dependsOnStepIds");
});

test("DomainsRuntimeOrchestrator.startup returns DomainsRuntimeStartupResult", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok("ready" in result, "result should have ready field");
  assert.ok("startupOrder" in result, "result should have startupOrder field");
  assert.ok("initializedServiceIds" in result, "result should have initializedServiceIds field");
  assert.ok("steps" in result, "result should have steps field");
});

test("DomainsRuntimeOrchestrator.startup startupOrder matches ring sequence", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const expectedOrder = ["ring1", "ring2", "ring3"];
  assert.deepEqual(result.startupOrder, expectedOrder, "startup order should follow ring sequence");
});

test("DomainsRuntimeOrchestrator.startup steps contain execution details", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok(result.steps.length > 0, "should have at least one step");

  const firstStep = result.steps[0]!;
  assert.ok("stepId" in firstStep, "step should have stepId");
  assert.ok("bootstrapServiceId" in firstStep, "step should have bootstrapServiceId");
  assert.ok("capabilityCount" in firstStep, "step should have capabilityCount");
  assert.ok("initialized" in firstStep, "step should have initialized field");
  assert.ok("initializedDependencyServiceIds" in firstStep, "step should have initializedDependencyServiceIds");
});

test("DomainsRuntimeOrchestrator.startup first step has no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const firstStep = result.steps[0]!;
  assert.deepEqual(firstStep.initializedDependencyServiceIds, [], "first step should have no dependency service ids");
});

test("DomainsRuntimeOrchestrator.startup later steps depend on earlier rings", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const ring2 = result.steps.find((s) => s.stepId === "ring2");
  assert.ok(ring2 !== undefined, "ring2 step should exist");
  assert.deepEqual(ring2.initializedDependencyServiceIds, ["w5.domains.ring.ring1.bootstrap"]);
});

test("DomainsRuntimeOrchestrator.startup result ready flag is true after full startup", async () => {
  const registry = ServiceRegistry.getInstance();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.ready, true, "ready should be true after successful startup");
});

test("DomainsRuntimeOrchestrator.startup initializedServiceIds are from plan steps", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const plan = orchestrator.prepare();
  const expectedServiceIds = plan.steps.map((step) => step.bootstrapServiceId);

  for (const serviceId of result.initializedServiceIds) {
    assert.ok(
      expectedServiceIds.includes(serviceId),
      `service ${serviceId} should be in plan bootstrapServiceIds`
    );
  }
});

test("DomainsRuntimeOrchestrator.snapshotReadiness returns DomainsReadinessSnapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const snapshot = orchestrator.snapshotReadiness();

  assert.ok("runtimeCatalogInitialized" in snapshot, "snapshot should have runtimeCatalogInitialized");
  assert.ok("startupPlanInitialized" in snapshot, "snapshot should have startupPlanInitialized");
  assert.ok("orchestratorInitialized" in snapshot, "snapshot should have orchestratorInitialized");
  assert.ok("capabilityReadiness" in snapshot, "snapshot should have capabilityReadiness");
});

test("DomainsRuntimeOrchestrator.snapshotReadiness capabilityReadiness contains all rings", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const snapshot = orchestrator.snapshotReadiness();

  const rings = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(rings.includes("ring1"), "should include ring1");
  assert.ok(rings.includes("ring2"), "should include ring2");
  assert.ok(rings.includes("ring3"), "should include ring3");
});

test("DomainsRuntimeOrchestrator.snapshotReadiness all steps initialized after startup", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  orchestrator.startup();
  const snapshot = orchestrator.snapshotReadiness();

  assert.equal(snapshot.orchestratorInitialized, true);
  assert.equal(snapshot.runtimeCatalogInitialized, true);
  assert.equal(snapshot.startupPlanInitialized, true);
  assert.equal(snapshot.capabilityReadiness.every((step) => step.initialized), true);
});

test("registerDomainsRuntimeOrchestrator registers orchestrator in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  registerDomainsRuntimeOrchestrator(registry);

  assert.ok(registry.isInitialized(DOMAINS_RUNTIME_ORCHESTRATOR_SERVICE_ID), "orchestrator should be registered");
});

test("registerDomainsRuntimeOrchestrator returns DomainsRuntimeOrchestrator instance", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);

  assert.ok(orchestrator instanceof DomainsRuntimeOrchestrator, "should return DomainsRuntimeOrchestrator instance");
});

test("registerDomainsRuntimeOrchestrator startup produces correct ring order", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.startupOrder, ["ring1", "ring2", "ring3"]);
});

test("registerDomainsRuntimeOrchestrator startup first step has empty dependency ids", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
});

test("registerDomainsRuntimeOrchestrator startup second step depends on first ring", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["w5.domains.ring.ring1.bootstrap"]);
});
