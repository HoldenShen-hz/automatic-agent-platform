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

test("DomainsRuntimeOrchestrator constructor accepts optional registry", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be constructed");
});

test("DomainsRuntimeOrchestrator.prepare registers bootstrap, catalog, and startup plan", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const plan = orchestrator.prepare();

  assert.ok(plan != null, "prepare should return a startup plan");
  assert.ok(Array.isArray(plan.steps), "plan should have steps array");
  assert.ok(plan.steps.length > 0, "plan should have at least one step");
});

test("DomainsRuntimeOrchestrator.prepare returns plan with correct step structure", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

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
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.ok("ready" in result, "result should have ready field");
  assert.ok("startupOrder" in result, "result should have startupOrder field");
  assert.ok("initializedServiceIds" in result, "result should have initializedServiceIds field");
  assert.ok("steps" in result, "result should have steps field");
});

test("DomainsRuntimeOrchestrator.startup startupOrder matches phase sequence", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const expectedOrder = ["9a", "9b", "9c", "9d", "9e", "9f"];
  assert.deepEqual(result.startupOrder, expectedOrder, "startup order should follow phase sequence");
});

test("DomainsRuntimeOrchestrator.startup steps contain execution details", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

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
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  const firstStep = result.steps[0]!;
  assert.deepEqual(firstStep.initializedDependencyServiceIds, [], "first step should have no dependency service ids");
});

test("DomainsRuntimeOrchestrator.startup later steps depend on earlier phases", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  // Phase 9b should depend on 9a
  const step9b = result.steps.find((s) => s.stepId === "9b")!;
  assert.ok(step9b.initializedDependencyServiceIds.length > 0, "9b should have dependency service ids");
});

test("DomainsRuntimeOrchestrator.startup result ready flag is true after full startup", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

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

test("DomainsRuntimeOrchestrator.snapshotReadiness capabilityReadiness contains all phases", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = new DomainsRuntimeOrchestrator(registry);
  const snapshot = orchestrator.snapshotReadiness();

  const phases = snapshot.capabilityReadiness.map((c) => c.stepId);
  assert.ok(phases.includes("9a"), "should include phase 9a");
  assert.ok(phases.includes("9b"), "should include phase 9b");
  assert.ok(phases.includes("9c"), "should include phase 9c");
  assert.ok(phases.includes("9d"), "should include phase 9d");
  assert.ok(phases.includes("9e"), "should include phase 9e");
  assert.ok(phases.includes("9f"), "should include phase 9f");
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

test("registerDomainsRuntimeOrchestrator startup produces correct phase order", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.startupOrder, ["9a", "9b", "9c", "9d", "9e", "9f"]);
});

test("registerDomainsRuntimeOrchestrator startup first step has empty dependency ids", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
});

test("registerDomainsRuntimeOrchestrator startup second step depends on first phase", async () => {
  const registry = ServiceRegistry.getInstance();
  await registry.reset();

  const orchestrator = registerDomainsRuntimeOrchestrator(registry);
  const result = orchestrator.startup();

  assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["w5.domains.phase.9a.bootstrap"]);
});
