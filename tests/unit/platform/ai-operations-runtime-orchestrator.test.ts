import assert from "node:assert/strict";
import test from "node:test";

import {
  AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID,
  registerAiOperationsRuntimeCatalog,
} from "../../../src/platform/ai-operations-runtime-catalog.js";
import {
  AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID,
  buildAiOperationsStartupPlan,
  registerAiOperationsStartupPlan,
} from "../../../src/platform/ai-operations-startup-plan.js";
import {
  AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  AiOperationsRuntimeOrchestrator,
  registerAiOperationsRuntimeOrchestrator,
  type AiOperationsStartupExecutionStep,
  type AiOperationsRuntimeStartupResult,
  type AiOperationsReadinessSnapshot,
} from "../../../src/platform/ai-operations-runtime-orchestrator.js";
import { ServiceRegistry } from "../../../src/platform/shared/lifecycle/service-registry.js";

test("AiOperationsRuntimeOrchestrator constructor creates instance with default registry", () => {
  const orchestrator = new AiOperationsRuntimeOrchestrator();
  assert.ok(orchestrator != null);
});

test("AiOperationsRuntimeOrchestrator constructor creates instance with custom registry", () => {
  const registry = ServiceRegistry.getInstance();
  const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
  assert.ok(orchestrator != null);
});

test("AiOperationsRuntimeOrchestrator prepare returns AiOperationsStartupPlan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();

    assert.ok(plan != null);
    assert.ok(Array.isArray(plan.steps));
    assert.ok(typeof plan.totalCapabilityCount === "number");
    assert.ok(Array.isArray(plan.startupOrder));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator prepare registers all bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    orchestrator.prepare();

    // After prepare, all bootstrap services should be registered
    assert.ok(registry.isInitialized("aiops.model-gateway.bootstrap"));
    assert.ok(registry.isInitialized("aiops.prompt-engine.bootstrap"));
    assert.ok(registry.isInitialized("aiops.compliance.bootstrap"));
    assert.ok(registry.isInitialized("aiops.harness.bootstrap"));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup returns AiOperationsRuntimeStartupResult", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new AiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.ok(typeof result.ready === "boolean");
    assert.ok(Array.isArray(result.startupOrder));
    assert.ok(Array.isArray(result.initializedServiceIds));
    assert.ok(Array.isArray(result.steps));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup result has correct startupOrder", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.deepEqual(result.startupOrder, ["model-gateway", "prompt-engine", "compliance", "harness"]);
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup result steps have correct structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    for (const step of result.steps) {
      assert.ok(typeof step.stepId === "string");
      assert.ok(typeof step.bootstrapServiceId === "string");
      assert.ok(typeof step.capabilityCount === "number");
      assert.ok(typeof step.initialized === "boolean");
      assert.ok(Array.isArray(step.initializedDependencyServiceIds));
    }
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup result ready is true when all steps initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.ready, true);
    assert.ok(result.steps.every((step) => step.initialized));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup first step has no dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.steps[0]?.stepId, "model-gateway");
    assert.equal(result.steps[0]?.initializedDependencyServiceIds.length, 0);
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup second step depends on first", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.steps[1]?.stepId, "prompt-engine");
    assert.deepEqual(result.steps[1]?.initializedDependencyServiceIds, ["aiops.model-gateway.bootstrap"]);
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator startup includes all bootstrap service IDs", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const expectedServiceIds = [
      "aiops.model-gateway.bootstrap",
      "aiops.prompt-engine.bootstrap",
      "aiops.compliance.bootstrap",
      "aiops.harness.bootstrap",
    ];

    for (const serviceId of expectedServiceIds) {
      assert.ok(result.initializedServiceIds.includes(serviceId), `Missing service: ${serviceId}`);
    }
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator snapshotReadiness returns AiOperationsReadinessSnapshot", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const snapshot = orchestrator.snapshotReadiness();

    assert.ok(typeof snapshot.runtimeCatalogInitialized === "boolean");
    assert.ok(typeof snapshot.startupPlanInitialized === "boolean");
    assert.ok(typeof snapshot.orchestratorInitialized === "boolean");
    assert.ok(Array.isArray(snapshot.capabilityReadiness));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator snapshotReadiness shows all capabilities ready after startup", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.orchestratorInitialized, true);
    assert.ok(snapshot.capabilityReadiness.every((step) => step.initialized));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator snapshotReadiness capabilityReadiness has correct stepIds", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    const stepIds = snapshot.capabilityReadiness.map((c) => c.stepId);
    assert.deepEqual(stepIds, ["model-gateway", "prompt-engine", "compliance", "harness"]);
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeOrchestrator snapshotReadiness capabilityReadiness has correct bootstrapServiceIds", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    const bootstrapServiceIds = snapshot.capabilityReadiness.map((c) => c.bootstrapServiceId);
    assert.deepEqual(bootstrapServiceIds, [
      "aiops.model-gateway.bootstrap",
      "aiops.prompt-engine.bootstrap",
      "aiops.compliance.bootstrap",
      "aiops.harness.bootstrap",
    ]);
  } finally {
    await registry.reset();
  }
});

test("registerAiOperationsRuntimeOrchestrator registers orchestrator service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerAiOperationsRuntimeOrchestrator(registry);

    assert.ok(registry.isInitialized(AI_OPERATIONS_RUNTIME_ORCHESTRATOR_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});

test("registerAiOperationsRuntimeOrchestrator also registers catalog and plan", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerAiOperationsRuntimeOrchestrator(registry);

    assert.ok(registry.isInitialized(AI_OPERATIONS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(AI_OPERATIONS_STARTUP_PLAN_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsStartupExecutionStep interface fields are correct", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const step = result.steps[0]!;
    assert.ok(typeof step.stepId === "string");
    assert.ok(typeof step.bootstrapServiceId === "string");
    assert.ok(typeof step.capabilityCount === "number");
    assert.ok(typeof step.initialized === "boolean");
    assert.ok(Array.isArray(step.initializedDependencyServiceIds));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsRuntimeStartupResult interface fields are correct", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.ok(typeof result.ready === "boolean");
    assert.ok(Array.isArray(result.startupOrder));
    assert.ok(Array.isArray(result.initializedServiceIds));
    assert.ok(Array.isArray(result.steps));
  } finally {
    await registry.reset();
  }
});

test("AiOperationsReadinessSnapshot interface fields are correct", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerAiOperationsRuntimeOrchestrator(registry);
    orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.ok(typeof snapshot.runtimeCatalogInitialized === "boolean");
    assert.ok(typeof snapshot.startupPlanInitialized === "boolean");
    assert.ok(typeof snapshot.orchestratorInitialized === "boolean");
    assert.ok(Array.isArray(snapshot.capabilityReadiness));

    for (const cap of snapshot.capabilityReadiness) {
      assert.ok(typeof cap.stepId === "string");
      assert.ok(typeof cap.bootstrapServiceId === "string");
      assert.ok(typeof cap.initialized === "boolean");
    }
  } finally {
    await registry.reset();
  }
});
