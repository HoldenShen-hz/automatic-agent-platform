import test from "node:test";
import assert from "node:assert/strict";

import {
  AiOperationsRuntimeOrchestrator,
  registerAiOperationsRuntimeOrchestrator,
  AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  type AiOperationsStartupExecutionStep,
  type AiOperationsRuntimeStartupResult,
  type AiOperationsReadinessSnapshot,
} from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("AiOperationsRuntimeOrchestrator can be instantiated", () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be created");
});

test("AiOperationsRuntimeOrchestrator.prepare returns a startup plan", () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.prepare();

  assert.ok(result != null, "prepare should return a result");
  assert.ok(Array.isArray(result.steps), "should have steps array");
  assert.equal(result.steps.length, 4, "should have 4 steps");
});

test("AiOperationsRuntimeOrchestrator.startup returns startup result", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.ok(result != null, "startup should return a result");
  assert.equal(typeof result.ready, "boolean", "ready should be a boolean");
  assert.ok(Array.isArray(result.startupOrder), "startupOrder should be an array");
  assert.ok(Array.isArray(result.initializedServiceIds), "initializedServiceIds should be an array");
  assert.ok(Array.isArray(result.steps), "steps should be an array");

  await registry.reset();
});

test("AiOperationsRuntimeOrchestrator.startup includes all step IDs in order", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.deepStrictEqual(result.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);

  await registry.reset();
});

test("AiOperationsRuntimeOrchestrator.startup marks all steps as initialized after startup", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  for (const step of result.steps as AiOperationsStartupExecutionStep[]) {
    assert.equal(step.initialized, true, `step ${step.stepId} should be initialized`);
  }

  await registry.reset();
});

test("AiOperationsRuntimeOrchestrator.snapshotReadiness returns readiness snapshot", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  // Prepare first (registers services)
  orchestrator.prepare();

  const snapshot = orchestrator.snapshotReadiness();

  assert.ok(snapshot != null, "snapshot should not be null");
  assert.equal(typeof snapshot.runtimeCatalogInitialized, "boolean", "runtimeCatalogInitialized should be boolean");
  assert.equal(typeof snapshot.startupPlanInitialized, "boolean", "startupPlanInitialized should be boolean");
  assert.equal(typeof snapshot.orchestratorInitialized, "boolean", "orchestratorInitialized should be boolean");
  assert.ok(Array.isArray(snapshot.capabilityReadiness), "capabilityReadiness should be an array");

  await registry.reset();
});

test("AiOperationsRuntimeOrchestrator steps have correct dependency chain", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  // Verify dependency chain: model-gateway -> prompt-engine -> compliance -> harness
  const modelGateway = (result.steps as AiOperationsStartupExecutionStep[]).find((s) => s.stepId === "model-gateway");
  const promptEngine = (result.steps as AiOperationsStartupExecutionStep[]).find((s) => s.stepId === "prompt-engine");
  const compliance = (result.steps as AiOperationsStartupExecutionStep[]).find((s) => s.stepId === "compliance");
  const harness = (result.steps as AiOperationsStartupExecutionStep[]).find((s) => s.stepId === "harness");

  assert.equal(modelGateway?.initializedDependencyServiceIds.length, 0, "model-gateway has no dependencies");
  // Service IDs are prefixed with "aiops." based on actual implementation
  assert.deepStrictEqual(promptEngine?.initializedDependencyServiceIds, ["aiops.model-gateway.bootstrap"], "prompt-engine depends on model-gateway");
  assert.deepStrictEqual(compliance?.initializedDependencyServiceIds, ["aiops.prompt-engine.bootstrap"], "compliance depends on prompt-engine");
  assert.deepStrictEqual(harness?.initializedDependencyServiceIds, ["aiops.compliance.bootstrap"], "harness depends on compliance");

  await registry.reset();
});

test("registerAiOperationsRuntimeOrchestrator registers orchestrator in registry", async () => {
  const registry = new ServiceRegistry();

  // Before registering, orchestrator should not be initialized
  assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID), false, "orchestrator should not be initialized before register");

  const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);

  assert.ok(orchestrator != null, "orchestrator should be registered");

  // After registration, orchestrator should be initialized (register calls get internally)
  assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true, "orchestrator should be initialized after register");

  await registry.reset();
});

test("AiOperationsRuntimeStartupResult.ready is true when all steps initialize", async () => {
  const registry = new ServiceRegistry();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);

  const result = orchestrator.startup();

  assert.equal(result.ready, true, "all steps should be ready after startup");

  await registry.reset();
});