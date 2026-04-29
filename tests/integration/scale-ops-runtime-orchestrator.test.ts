import assert from "node:assert/strict";
import test from "node:test";

import { ServiceRegistry } from "../../src/platform/shared/lifecycle/service-registry.js";
import {
  SCALE_BOOTSTRAP_SERVICE_ID,
  registerScaleBootstrap,
} from "../../src/scale-ecosystem/scale-bootstrap.js";
import {
  OPS_MATURITY_BOOTSTRAP_SERVICE_ID,
  registerOpsMaturityBootstrap,
} from "../../src/ops-maturity/ops-maturity-bootstrap.js";
import {
  registerScaleOpsRuntimeCatalog,
  SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID,
} from "../../src/scale-ops-runtime-catalog.js";
import {
  SCALE_OPS_STARTUP_PLAN_SERVICE_ID,
  registerScaleOpsStartupPlan,
} from "../../src/scale-ops-startup-plan.js";
import {
  ScaleOpsRuntimeOrchestrator,
  registerScaleOpsRuntimeOrchestrator,
  SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
  type ScaleOpsStartupExecutionStep,
  type ScaleOpsRuntimeStartupResult,
  type ScaleOpsReadinessSnapshot,
} from "../../src/scale-ops-runtime-orchestrator.js";

test("ScaleOpsRuntimeOrchestrator end-to-end startup produces correct result", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, ["scale-ecosystem", "ops-maturity"]);
    assert.ok(result.initializedServiceIds.length >= 2);
    assert.ok(result.steps.length === 2);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup order respects dependency graph", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const scaleIndex = result.startupOrder.indexOf("scale-ecosystem");
    const opsIndex = result.startupOrder.indexOf("ops-maturity");
    assert.ok(scaleIndex < opsIndex);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup initializes all bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    for (const step of result.steps) {
      assert.equal(step.initialized, true);
      assert.ok(step.bootstrapServiceId.length > 0);
      assert.ok(step.capabilityCount > 0);
    }
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup result has correct step structure", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    for (const step of result.steps) {
      assert.ok(step.stepId === "scale-ecosystem" || step.stepId === "ops-maturity");
      assert.ok(typeof step.bootstrapServiceId === "string");
      assert.ok(typeof step.capabilityCount === "number");
      assert.ok(typeof step.initialized === "boolean");
      assert.ok(Array.isArray(step.initializedDependencyServiceIds));
    }
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator snapshotReadiness reflects startup state", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    orchestrator.startup();

    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.capabilityReadiness.length, 2);
    assert.ok(snapshot.capabilityReadiness.every((c) => c.initialized === true));
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator snapshotReadiness capabilityReadiness entries match steps", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const startupResult = orchestrator.startup();
    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(startupResult.steps.length, snapshot.capabilityReadiness.length);

    for (let i = 0; i < startupResult.steps.length; i++) {
      const step = startupResult.steps[i];
      const readiness = snapshot.capabilityReadiness[i];
      assert.equal(step.stepId, readiness.stepId);
      assert.equal(step.bootstrapServiceId, readiness.bootstrapServiceId);
      assert.equal(step.initialized, readiness.initialized);
    }
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeOrchestrator creates orchestrator with all dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);

    assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
    assert.ok(registry.isInitialized(SCALE_OPS_STARTUP_PLAN_SERVICE_ID));
    assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID));

    const result = orchestrator.startup();
    assert.equal(result.ready, true);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator prepare allows subsequent startup", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    orchestrator.prepare();

    const result = orchestrator.startup();
    assert.equal(result.ready, true);
    assert.equal(result.steps.length, 2);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup is idempotent (safe to call twice)", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result1 = orchestrator.startup();
    const result2 = orchestrator.startup();

    assert.deepEqual(result1.startupOrder, result2.startupOrder);
    assert.equal(result1.ready, result2.ready);
    assert.equal(result1.steps.length, result2.steps.length);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator snapshotReadiness works without prior startup", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const snapshot = orchestrator.snapshotReadiness();

    assert.ok(Array.isArray(snapshot.capabilityReadiness));
    assert.ok(snapshot.capabilityReadiness.length > 0);
    assert.ok(typeof snapshot.runtimeCatalogInitialized === "boolean");
    assert.ok(typeof snapshot.startupPlanInitialized === "boolean");
    assert.ok(typeof snapshot.orchestratorInitialized === "boolean");
  } finally {
    await registry.reset();
  }
});
