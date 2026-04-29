import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  AiOperationsRuntimeOrchestrator,
  registerAiOperationsRuntimeOrchestrator,
  type AiOperationsStartupExecutionStep,
  type AiOperationsReadinessSnapshot,
  type AiOperationsRuntimeStartupResult,
} from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID is defined correctly", () => {
  assert.equal(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID, "aiops.runtime.orchestrator");
});

test("AiOperationsRuntimeOrchestrator can be instantiated", () => {
  const orchestrator = new AiOperationsRuntimeOrchestrator();
  assert.ok(orchestrator, "orchestrator should be truthy");
});

test("prepare returns a startup plan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();
    assert.ok(plan, "prepare should return a plan");
    assert.ok(plan.steps, "plan should have steps");
    assert.ok(plan.steps.length > 0, "plan should have steps");
  } finally {
    await registry.reset();
  }
});

test("startup returns a startup result", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.ok(result, "startup should return a result");
    assert.ok("ready" in result, "result should have ready field");
    assert.ok("startupOrder" in result, "result should have startupOrder field");
    assert.ok("initializedServiceIds" in result, "result should have initializedServiceIds field");
    assert.ok("steps" in result, "result should have steps field");
  } finally {
    await registry.reset();
  }
});

test("snapshotReadiness returns a readiness snapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();
    const snapshot = orchestrator.snapshotReadiness();
    assert.ok(snapshot, "snapshotReadiness should return a snapshot");
    assert.ok("runtimeCatalogInitialized" in snapshot, "snapshot should have runtimeCatalogInitialized");
    assert.ok("startupPlanInitialized" in snapshot, "snapshot should have startupPlanInitialized");
    assert.ok("orchestratorInitialized" in snapshot, "snapshot should have orchestratorInitialized");
    assert.ok("capabilityReadiness" in snapshot, "snapshot should have capabilityReadiness");
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeStartupResult has correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    assert.equal(typeof result.ready, "boolean");
    assert.ok(Array.isArray(result.startupOrder));
    assert.ok(Array.isArray(result.initializedServiceIds));
    assert.ok(Array.isArray(result.steps));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsStartupExecutionStep has correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    for (const step of result.steps) {
      assert.ok("stepId" in step, "step should have stepId");
      assert.ok("bootstrapServiceId" in step, "step should have bootstrapServiceId");
      assert.ok("capabilityCount" in step, "step should have capabilityCount");
      assert.ok("initialized" in step, "step should have initialized");
      assert.ok("initializedDependencyServiceIds" in step, "step should have initializedDependencyServiceIds");
    }
  } finally {
    await registry.reset();
  }
});

test("AiOperationsReadinessSnapshot has correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();
    const snapshot = orchestrator.snapshotReadiness();
    assert.equal(typeof snapshot.runtimeCatalogInitialized, "boolean");
    assert.equal(typeof snapshot.startupPlanInitialized, "boolean");
    assert.equal(typeof snapshot.orchestratorInitialized, "boolean");
    assert.ok(Array.isArray(snapshot.capabilityReadiness));
  } finally {
    await registry.reset();
  }
});

test("registerAiOperationsRuntimeOrchestrator registers orchestrator in service registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    assert.equal(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
    assert.ok(orchestrator, "orchestrator should be registered");
  } finally {
    await registry.reset();
  }
});

test("startup order follows dependency chain", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    const order = result.startupOrder;
    assert.ok(order.indexOf("model-gateway") < order.indexOf("prompt-engine"), "model-gateway should come before prompt-engine");
    assert.ok(order.indexOf("prompt-engine") < order.indexOf("compliance"), "prompt-engine should come before compliance");
    assert.ok(order.indexOf("compliance") < order.indexOf("harness"), "compliance should come before harness");
  } finally {
    await registry.reset();
  }
});

test("capabilityReadiness has entry for each step", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();
    const snapshot = orchestrator.snapshotReadiness();
    const readinessStepIds = snapshot.capabilityReadiness.map((c) => c.stepId);
    assert.ok(readinessStepIds.includes("model-gateway"));
    assert.ok(readinessStepIds.includes("prompt-engine"));
    assert.ok(readinessStepIds.includes("compliance"));
    assert.ok(readinessStepIds.includes("harness"));
  } finally {
    await registry.reset();
  }
});