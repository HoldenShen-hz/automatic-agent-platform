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
  buildScaleOpsRuntimeCatalog,
} from "../../src/scale-ops-runtime-catalog.js";
import {
  ScaleOpsRuntimeOrchestrator,
  registerScaleOpsRuntimeOrchestrator,
  SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID,
} from "../../src/scale-ops-runtime-orchestrator.js";

test("ScaleOpsRuntimeOrchestrator constructor creates instance with default registry", () => {
  const orchestrator = new ScaleOpsRuntimeOrchestrator();
  assert.ok(orchestrator instanceof ScaleOpsRuntimeOrchestrator);
});

test("ScaleOpsRuntimeOrchestrator prepare registers all bootstrap services", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();

    assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
    assert.equal(plan.steps.length, 2);
    assert.equal(plan.startupOrder[0], "scale-ecosystem");
    assert.equal(plan.startupOrder[1], "ops-maturity");
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator prepare registers scale-ecosystem first then ops-maturity", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const plan = orchestrator.prepare();

    const scaleStep = plan.steps.find((s) => s.stepId === "scale-ecosystem");
    const opsStep = plan.steps.find((s) => s.stepId === "ops-maturity");

    assert.ok(scaleStep);
    assert.ok(opsStep);
    assert.deepEqual(scaleStep.dependsOnStepIds, []);
    assert.deepEqual(opsStep.dependsOnStepIds, ["scale-ecosystem"]);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup returns startup result with ready true", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    assert.equal(result.ready, true);
    assert.deepEqual(result.startupOrder, ["scale-ecosystem", "ops-maturity"]);
    assert.ok(result.initializedServiceIds.length > 0);
    assert.ok(result.steps.length === 2);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup marks steps as initialized", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const scaleStep = result.steps.find((s) => s.stepId === "scale-ecosystem");
    const opsStep = result.steps.find((s) => s.stepId === "ops-maturity");

    assert.ok(scaleStep);
    assert.ok(opsStep);
    assert.equal(scaleStep.initialized, true);
    assert.equal(opsStep.initialized, true);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator startup captures correct dependency service ids", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    const result = orchestrator.startup();

    const scaleStep = result.steps.find((s) => s.stepId === "scale-ecosystem");
    const opsStep = result.steps.find((s) => s.stepId === "ops-maturity");

    assert.ok(scaleStep);
    assert.ok(opsStep);
    assert.deepEqual(scaleStep.initializedDependencyServiceIds, []);
    assert.deepEqual(opsStep.initializedDependencyServiceIds, [SCALE_BOOTSTRAP_SERVICE_ID]);
  } finally {
    await registry.reset();
  }
});

test("ScaleOpsRuntimeOrchestrator snapshotReadiness reports initialization state", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = new ScaleOpsRuntimeOrchestrator(registry);
    orchestrator.startup();

    const snapshot = orchestrator.snapshotReadiness();

    assert.equal(snapshot.runtimeCatalogInitialized, true);
    assert.equal(snapshot.startupPlanInitialized, true);
    assert.equal(snapshot.capabilityReadiness.length, 2);
    assert.equal(snapshot.capabilityReadiness.every((c) => c.initialized), true);
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeOrchestrator registers orchestrator service", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    const orchestrator = registerScaleOpsRuntimeOrchestrator(registry);
    assert.ok(orchestrator instanceof ScaleOpsRuntimeOrchestrator);
    assert.equal(registry.isInitialized(SCALE_OPS_RUNTIME_ORCHESTRATOR_SERVICE_ID), true);
  } finally {
    await registry.reset();
  }
});

test("registerScaleOpsRuntimeOrchestrator registers with correct dependencies", async () => {
  const registry = ServiceRegistry.getInstance();
  try {
    registerScaleOpsRuntimeOrchestrator(registry);
    assert.ok(registry.isInitialized(SCALE_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(OPS_MATURITY_BOOTSTRAP_SERVICE_ID));
    assert.ok(registry.isInitialized(SCALE_OPS_RUNTIME_CATALOG_SERVICE_ID));
  } finally {
    await registry.reset();
  }
});
