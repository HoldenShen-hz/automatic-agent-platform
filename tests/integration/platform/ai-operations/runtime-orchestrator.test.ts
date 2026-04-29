import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  AiOperationsRuntimeOrchestrator,
  registerAiOperationsRuntimeOrchestrator,
  type AiOperationsRuntimeStartupResult,
  type AiOperationsReadinessSnapshot,
} from "../../../../src/platform/ai-operations-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../../src/platform/shared/lifecycle/service-registry.js";

test("AI operations orchestrator integration - prepare returns startup plan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();

    assert.ok(plan.steps.length === 4, "prepared plan should have 4 steps");
    assert.ok(plan.startupOrder.length === 4, "prepared plan should have 4 startupOrder entries");
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - startup returns result with ready status", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.ok(typeof result.ready === "boolean", "result should have boolean ready field");
    assert.ok(result.startupOrder.length === 4, "result should have 4 startupOrder entries");
    assert.ok(result.steps.length === 4, "result should have 4 execution steps");
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - snapshotReadiness reflects registry state", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();

    const snapshot = orchestrator.snapshotReadiness();

    assert.ok(typeof snapshot.runtimeCatalogInitialized === "boolean", "snapshot should have runtimeCatalogInitialized");
    assert.ok(typeof snapshot.startupPlanInitialized === "boolean", "snapshot should have startupPlanInitialized");
    assert.ok(typeof snapshot.orchestratorInitialized === "boolean", "snapshot should have orchestratorInitialized");
    assert.ok(snapshot.capabilityReadiness.length === 4, "snapshot should have 4 capability readiness entries");
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - register registers orchestrator in registry", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);

    assert.ok(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID), "orchestrator service should be initialized");
    assert.ok(orchestrator, "registered orchestrator should be returned");
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - all dependencies are satisfied after prepare", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    for (const step of result.steps) {
      assert.ok(
        step.initializedDependencyServiceIds.length >= 0,
        `step ${step.stepId} should have valid dependency service ids`,
      );
    }
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - startup order follows dependency chain", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();
    const order = result.startupOrder;

    assert.ok(order.indexOf("model-gateway") < order.indexOf("prompt-engine"), "model-gateway should precede prompt-engine");
    assert.ok(order.indexOf("prompt-engine") < order.indexOf("compliance"), "prompt-engine should precede compliance");
    assert.ok(order.indexOf("compliance") < order.indexOf("harness"), "compliance should precede harness");
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - initializedServiceIds contains all bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const expectedServiceIds = [
      "aiops.model-gateway.bootstrap",
      "aiops.prompt-engine.bootstrap",
      "aiops.compliance.bootstrap",
      "aiops.harness.bootstrap",
    ];

    for (const serviceId of expectedServiceIds) {
      assert.ok(
        result.initializedServiceIds.includes(serviceId),
        `service ${serviceId} should be in initializedServiceIds`,
      );
    }
  } finally {
    await registry.reset();
  }
});

test("AI operations orchestrator integration - service ID constant is correct", () => {
  assert.equal(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID, "aiops.runtime.orchestrator");
});

test("AI operations orchestrator integration - capabilityReadiness entries match steps", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();

    const snapshot = orchestrator.snapshotReadiness();
    const stepIds = snapshot.capabilityReadiness.map((c) => c.stepId);

    assert.ok(stepIds.includes("model-gateway"), "capabilityReadiness should include model-gateway");
    assert.ok(stepIds.includes("prompt-engine"), "capabilityReadiness should include prompt-engine");
    assert.ok(stepIds.includes("compliance"), "capabilityReadiness should include compliance");
    assert.ok(stepIds.includes("harness"), "capabilityReadiness should include harness");
  } finally {
    await registry.reset();
  }
});